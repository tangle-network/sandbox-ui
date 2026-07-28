import type { ReasoningEffort } from '@tangle-network/agent-interface';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionMessage, SessionPart, TextPart, ToolPart, ReasoningPart } from '@tangle-network/ui/types';
import { encodeTextForWire } from './wire-encoding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal session info returned by the listing API. */
export interface SessionInfo {
  id: string;
  title: string;
  parentID?: string;
}

export interface UseSessionStreamOptions {
  /** Base URL of the session proxy (e.g. "http://localhost:9100"). */
  apiUrl: string;
  /** Bearer token for authentication. */
  token: string | null;
  /** Session ID to stream events for. */
  sessionId: string;
  /** Only connect when true. Defaults to true. */
  enabled?: boolean;
}

/**
 * Per-message overrides forwarded to the sidecar's send-message endpoint.
 * Every field is optional — omitted fields fall back to the session's
 * backend configuration. Matches `SendMessageRequestSchema` on the sidecar.
 */
export interface SendMessageOptions {
  /** Backend agent identifier override (e.g. a named opencode agent). */
  agent?: string;
  /** Per-turn model override; session backend supplies apiKey/baseUrl. */
  model?: { providerID: string; modelID: string };
  /** Per-turn system prompt override. */
  system?: string;
  /** Thinking-effort hint; the sidecar maps it to a thinking-token budget. The full canonical
   *  `ReasoningEffort` (`@tangle-network/agent-interface`) — the UI shows only the levels the
   *  selected harness/model actually supports (a capability filter), never a hard-coded subset. */
  reasoningEffort?: ReasoningEffort;
}

export interface UseSessionStreamResult {
  /** All messages in the session (fetched + streaming). */
  messages: SessionMessage[];
  /** Part map: messageId → SessionPart[]. */
  partMap: Record<string, SessionPart[]>;
  /** Whether the agent is currently streaming a response. */
  isStreaming: boolean;
  /** Send a text message to the agent, with optional per-turn overrides. */
  send: (text: string, options?: SendMessageOptions) => Promise<void>;
  /** Abort the current agent execution. */
  abort: () => Promise<void>;
  /** Refetch full message history from the API. */
  refetch: () => Promise<void>;
  /** Connection or stream error, if any. */
  error: string | null;
  /** Whether the SSE connection is active. */
  connected: boolean;
}

// ---------------------------------------------------------------------------
// API message shape (what the sidecar returns)
// ---------------------------------------------------------------------------

interface ApiMessagePart {
  type: string;
  text?: string;
  tool?: string;
  id?: string;
  state?: {
    status?: string;
    input?: unknown;
    output?: unknown;
    error?: string;
    metadata?: Record<string, unknown>;
  };
  time?: { start?: number; end?: number };
}

interface ApiMessage {
  info: { id: string; role: string; timestamp?: string };
  parts: ApiMessagePart[];
  source?: string;
}

/**
 * A message this client sent that the backend's history has not replaced yet.
 *
 * The session bus emits `message.updated` only for the assistant's reply, so a
 * user message first reaches this hook through the `session.idle` refetch —
 * after the agent has finished answering it. Echoing locally on send is what
 * puts it on screen immediately; the echo is carried here until the turn ends
 * so an unrelated refetch (a history resync, or the previous turn's refetch
 * still in flight) cannot wipe it back off.
 *
 * An echo belongs to the session that produced it, and only that session's turn
 * ending retires it — so the map is emptied whenever the hook is pointed at a
 * different session.
 */
interface PendingEcho {
  message: SessionMessage;
  parts: SessionPart[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapApiMessage(msg: ApiMessage, counterRef: { current: number }): { message: SessionMessage; parts: SessionPart[] } {
  const created = msg.info.timestamp ? new Date(msg.info.timestamp).getTime() : Date.now();
  const message: SessionMessage = {
    id: msg.info.id,
    role: msg.info.role as 'user' | 'assistant' | 'system',
    time: { created },
    _insertionIndex: counterRef.current++,
  };

  const parts: SessionPart[] = (msg.parts ?? []).map((p, i) => {
    if (p.type === 'tool' && p.tool) {
      return {
        type: 'tool',
        id: p.id ?? `${msg.info.id}-tool-${i}`,
        tool: p.tool,
        state: {
          status: (p.state?.status as 'pending' | 'running' | 'completed' | 'error') ?? 'completed',
          input: p.state?.input,
          output: p.state?.output,
          error: p.state?.error,
          metadata: p.state?.metadata,
          time: p.time,
        },
      } satisfies ToolPart;
    }
    if (p.type === 'reasoning') {
      return {
        type: 'reasoning',
        text: p.text ?? '',
        time: p.time,
      } satisfies ReasoningPart;
    }
    return { type: 'text', text: p.text ?? '' } satisfies TextPart;
  });

  return { message, parts };
}

async function fetchJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (init?.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...init, headers: { ...headers, ...init?.headers }, credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Streams chat messages from a sidecar session gateway via SSE.
 *
 * Fetches existing message history on mount, then subscribes to SSE for
 * real-time updates. Maps the sidecar's message format to agent-ui's
 * SessionMessage + partMap format.
 */
export function useSessionStream({
  apiUrl,
  token,
  sessionId,
  enabled = true,
}: UseSessionStreamOptions): UseSessionStreamResult {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [partMap, setPartMap] = useState<Record<string, SessionPart[]>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingMsgIdRef = useRef<string | null>(null);
  const insertionCounterRef = useRef(0);
  const echoCounterRef = useRef(0);
  const pendingEchoesRef = useRef<Map<string, PendingEcho>>(new Map());
  const handleSSEEventRef = useRef<((type: string, raw: Record<string, unknown>) => void) | null>(null);

  // ── Echo lifetime ───────────────────────────────────────────────────

  // Only the producing session's turn ending retires its echoes, so pointing
  // the hook at another session strands them. Dropping them on the identity
  // change is what keeps a later return to the original session from
  // re-applying an echo whose canonical copy is in the history by then.
  useEffect(() => {
    pendingEchoesRef.current.clear();
  }, [sessionId]);

  // ── Fetch full message history ──────────────────────────────────────

  const refetch = useCallback(async () => {
    if (!token || !sessionId || !apiUrl) return;
    try {
      const url = `${apiUrl}/session/sessions/${encodeURIComponent(sessionId)}/messages?limit=200`;
      const data = await fetchJson<ApiMessage[] | { messages: ApiMessage[] }>(url, token);
      const apiMessages = Array.isArray(data) ? data : (data.messages ?? []);

      const newMessages: SessionMessage[] = [];
      const newPartMap: Record<string, SessionPart[]> = {};

      for (const apiMsg of apiMessages) {
        const { message, parts } = mapApiMessage(apiMsg, insertionCounterRef);
        newMessages.push(message);
        newPartMap[message.id] = parts;
      }

      // History is authoritative for everything the backend has recorded, but
      // an in-flight turn's user message may not be in it yet — carry those
      // echoes across so the sender's message does not blink out mid-turn.
      // They are the newest messages by construction, hence appended last.
      const echoes = [...pendingEchoesRef.current.values()];

      setMessages([...newMessages, ...echoes.map((echo) => echo.message)]);
      setPartMap({
        ...newPartMap,
        ...Object.fromEntries(echoes.map((echo) => [echo.message.id, echo.parts])),
      });
      streamingMsgIdRef.current = null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch messages';
      setError(msg);
    }
  }, [apiUrl, token, sessionId]);

  // ── SSE connection ──────────────────────────────────────────────────

  const connectSSE = useCallback(async () => {
    if (!token || !sessionId || !apiUrl || !enabled) return;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const url = `${apiUrl}/session/events?sessionId=${encodeURIComponent(sessionId)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`SSE connection failed: ${res.status}`);
      setConnected(true);
      setError(null);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          if (!frame.trim()) continue;

          let eventType = 'message';
          const dataLines: string[] = [];

          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }

          if (dataLines.length === 0) continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(dataLines.join('\n'));
          } catch {
            continue;
          }

          handleSSEEventRef.current?.(eventType, parsed);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'SSE connection error';
      setError(msg);
      setConnected(false);

      // Auto-reconnect
      if (!controller.signal.aborted) {
        reconnectTimerRef.current = setTimeout(() => connectSSE(), 3000);
      }
    }
  }, [apiUrl, token, sessionId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SSE event handler ──────────────────────────────────────────────

  const handleSSEEvent = useCallback((type: string, raw: Record<string, unknown>) => {
    // Unwrap sidecar event envelope — sidecar sends { type, properties: { info|part } }
    const envelope = raw?.properties as Record<string, unknown> | undefined;
    const props: Record<string, unknown> = envelope?.info as Record<string, unknown>
      ?? envelope?.part as Record<string, unknown>
      ?? envelope
      ?? raw;

    if (type === 'message.updated') {
      // A new or updated message — create/update the message entry
      const id = (props.id as string) ?? (props.messageId as string) ?? '';
      const role = (props.role as string) ?? 'assistant';
      if (!id) return;

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === id);
        if (exists) return prev;
        return [
          ...prev,
          {
            id,
            role: role as 'user' | 'assistant' | 'system',
            time: { created: Date.now() },
            _insertionIndex: insertionCounterRef.current++,
          },
        ];
      });

      if (role === 'assistant') {
        streamingMsgIdRef.current = id;
        setIsStreaming(true);
      }
    } else if (type === 'message.part.updated') {
      // A part within the current streaming message was updated
      const msgId = streamingMsgIdRef.current;
      if (!msgId) return;

      const partType = (props.type as string) ?? 'text';
      setIsStreaming(true);

      setPartMap((prev) => {
        const existing = prev[msgId] ?? [];
        const updated = [...existing];

        if (partType === 'text') {
          const text = (props.text as string) ?? (props.content as string) ?? '';
          const idx = updated.findIndex((p) => p.type === 'text');
          const textPart: TextPart = { type: 'text', text };
          if (idx >= 0) {
            updated[idx] = textPart;
          } else {
            updated.push(textPart);
          }
        } else if (partType === 'tool') {
          const toolId = (props.id as string) ?? (props.toolId as string) ?? `tool-${Date.now()}`;
          const toolName = (props.tool as string) ?? (props.name as string) ?? 'unknown';
          const state = (props.state as ToolPart['state']) ?? { status: 'running' as const };
          const toolPart: ToolPart = {
            type: 'tool',
            id: toolId,
            tool: toolName,
            state: {
              status: (state.status as ToolPart['state']['status']) ?? 'running',
              input: state.input,
              output: state.output,
              error: state.error,
              metadata: state.metadata,
              time: state.time,
            },
          };
          const idx = updated.findIndex((p) => p.type === 'tool' && (p as ToolPart).id === toolId);
          if (idx >= 0) {
            updated[idx] = toolPart;
          } else {
            updated.push(toolPart);
          }
        } else if (partType === 'reasoning') {
          const text = (props.text as string) ?? '';
          const idx = updated.findIndex((p) => p.type === 'reasoning');
          const reasoningPart: ReasoningPart = { type: 'reasoning', text };
          if (idx >= 0) {
            updated[idx] = reasoningPart;
          } else {
            updated.push(reasoningPart);
          }
        }

        return { ...prev, [msgId]: updated };
      });
    } else if (type === 'session.idle') {
      setIsStreaming(false);
      streamingMsgIdRef.current = null;
      // The turn is over, so its messages are in the backend's history now:
      // retire the echoes so the refetch below installs the canonical copies.
      // Retiring before the refetch keeps an echo created while it is in
      // flight (the composer unlocks on this event) out of the retired set.
      pendingEchoesRef.current.clear();
      // Refetch to get canonical message state
      refetch();
    } else if (type === 'session.error') {
      setIsStreaming(false);
      streamingMsgIdRef.current = null;
      const errorMsg = (props.error as string) ?? (props.message as string) ?? 'Agent error';
      setError(errorMsg);
      pendingEchoesRef.current.clear();
      refetch();
    }
  }, [refetch]);

  handleSSEEventRef.current = handleSSEEvent;

  // ── Send message ───────────────────────────────────────────────────

  /**
   * Sends the text and echoes it into the transcript immediately.
   *
   * The echo is what makes the sender's own message visible during the turn:
   * the session bus carries `message.updated` only for the assistant's reply,
   * so the user's message otherwise first surfaces in the `session.idle`
   * refetch — after the agent has finished answering it. The echo carries a
   * client-minted id and never has to agree with the backend's, because it is
   * retired wholesale when the turn ends rather than matched against a
   * canonical message.
   */
  const send = useCallback(async (text: string, options?: SendMessageOptions) => {
    if (!token || !sessionId || !apiUrl) return;

    const echoId = `local-echo-${echoCounterRef.current++}`;
    const echo: PendingEcho = {
      message: {
        id: echoId,
        role: 'user',
        time: { created: Date.now() },
        _insertionIndex: insertionCounterRef.current++,
      },
      parts: [{ type: 'text', text } satisfies TextPart],
    };
    pendingEchoesRef.current.set(echoId, echo);
    setMessages((prev) => [...prev, echo.message]);
    setPartMap((prev) => ({ ...prev, [echoId]: echo.parts }));
    // The turn is in flight from the user's point of view the moment they hit
    // send; composers gate their submit on this.
    setIsStreaming(true);

    try {
      const url = `${apiUrl}/session/sessions/${encodeURIComponent(sessionId)}/messages`;
      await fetchJson<unknown>(url, token, {
        method: 'POST',
        body: JSON.stringify({
          // The sidecar base64-decodes every text part at the route boundary;
          // a raw-UTF-8 part is rejected 400 (or mis-decoded). See wire-encoding.ts.
          parts: [{ type: 'text', text: encodeTextForWire(text) }],
          ...(options?.agent ? { agent: options.agent } : {}),
          ...(options?.model ? { model: options.model } : {}),
          ...(options?.system ? { system: options.system } : {}),
          ...(options?.reasoningEffort
            ? { reasoningEffort: options.reasoningEffort }
            : {}),
        }),
      });
    } catch (err) {
      // The turn was never admitted, so no backend copy will arrive to replace
      // the echo: drop it instead of leaving a message the session never saw.
      pendingEchoesRef.current.delete(echoId);
      setMessages((prev) => prev.filter((message) => message.id !== echoId));
      setPartMap((prev) => {
        if (!(echoId in prev)) return prev;
        const next = { ...prev };
        delete next[echoId];
        return next;
      });
      // Release the composer only when this was the sole turn in flight. Not
      // every caller gates on `isStreaming` — an in-transcript action button
      // can send mid-run — and clearing the flag under a live turn would
      // unlock the composer and drop its progress indicator.
      if (pendingEchoesRef.current.size === 0) setIsStreaming(false);
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
    }
  }, [apiUrl, token, sessionId]);

  // ── Abort ──────────────────────────────────────────────────────────

  const abort = useCallback(async () => {
    if (!token || !sessionId || !apiUrl) return;
    try {
      const url = `${apiUrl}/session/sessions/${encodeURIComponent(sessionId)}/abort`;
      await fetchJson<unknown>(url, token, { method: 'POST' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to abort';
      setError(msg);
    }
  }, [apiUrl, token, sessionId]);

  // ── Lifecycle ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled || !token || !sessionId) return;
    refetch();
    connectSSE();
    return () => {
      abortRef.current?.abort();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      setConnected(false);
    };
  }, [enabled, token, sessionId, refetch, connectSSE]);

  return { messages, partMap, isStreaming, send, abort, refetch, error, connected };
}
