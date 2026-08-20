import type { ReasoningEffort } from '@tangle-network/agent-interface';
import { createParser } from 'eventsource-parser';
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

/**
 * A sandbox-level condition that degrades the session without ending it.
 *
 * Distinct from `error`, which reports a turn that failed: the session here is
 * running and will answer, it is just missing something the caller asked for.
 * Reported separately so it is not cleared by the next successful turn — the
 * condition outlives the turn that revealed it.
 */
export interface SessionDegradation {
  /** Which capability is degraded. A union so this can grow without a break. */
  readonly kind: 'hub-connections';
  /** Machine-readable cause. */
  readonly reason: string;
  /** Operator/user-facing sentence, authored by the sidecar. */
  readonly message: string;
  /** How many connections the session asked for and did not get. */
  readonly connectionCount: number;
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
  /**
   * Sandbox-level degradations observed on this stream, or `null`.
   *
   * Today the only one is a Hub credential the sandbox could not present, which
   * leaves the agent with an EMPTY toolbelt while the session otherwise runs
   * normally. Without surfacing it, that state is indistinguishable to the user
   * from having connected no integrations at all — so a caller that renders a
   * transcript should render this too.
   */
  degradation: SessionDegradation | null;
}

export class SessionStreamError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'SessionStreamError';
    this.code = code;
    this.status = status;
  }
}

export const SESSION_STREAM_RECONNECT_DELAY_MS = 1000;

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
  canonicalMessageId?: string;
  executionId?: string;
}

interface SessionPartsState {
  values: Record<string, SessionPart[]>;
  sourceIds: Record<string, string[]>;
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

interface ErrorDetails {
  code?: string;
  message?: string;
}

function readErrorDetails(value: unknown): ErrorDetails {
  if (typeof value === 'string') return { message: value };
  if (!value || typeof value !== 'object') return {};

  const record = value as Record<string, unknown>;
  const nested = readErrorDetails(record.error);
  return {
    code:
      (typeof record.code === 'string' ? record.code : undefined)
      ?? nested.code,
    message:
      (typeof record.message === 'string' ? record.message : undefined)
      ?? nested.message,
  };
}

function formatError(details: ErrorDetails, fallback: string): string {
  const message = details.message ?? fallback;
  return details.code && !message.includes(details.code)
    ? `${message} (${details.code})`
    : message;
}

async function responseError(res: Response, prefix: string): Promise<SessionStreamError> {
  let details: ErrorDetails = {};
  try {
    details = readErrorDetails(await res.json());
  } catch {
    // Some proxies return an empty or non-JSON body. The HTTP status remains
    // actionable and is never hidden behind a successful-looking result.
  }

  const code = details.code ?? `HTTP_${res.status}`;
  const fallback = `${prefix}: HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
  return new SessionStreamError(
    code,
    formatError(details, fallback),
    res.status,
  );
}

async function fetchJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (init?.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...init, headers: { ...headers, ...init?.headers }, credentials: 'include' });
  if (!res.ok) throw await responseError(res, 'Request failed');
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
  const [partsState, setPartsState] = useState<SessionPartsState>({
    values: {},
    sourceIds: {},
  });
  const partMap = partsState.values;
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  // Stamped with the session it was reported for, and read back only when that
  // matches the session being rendered. Clearing it in an effect instead would
  // commit one frame of the PREVIOUS session's degradation against the new one
  // — briefly accusing a healthy session of having no integrations — because a
  // passive effect runs after that render is already on screen.
  const [degradationState, setDegradationState] = useState<{
    sessionId: string;
    value: SessionDegradation;
  } | null>(null);
  const degradation =
    degradationState?.sessionId === sessionId ? degradationState.value : null;

  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAssistantMessageIdsRef = useRef<Set<string>>(new Set());
  const completedExecutionIdsRef = useRef<Set<string>>(new Set());
  const lastEventIdRef = useRef('');
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
    activeAssistantMessageIdsRef.current.clear();
    completedExecutionIdsRef.current.clear();
    lastEventIdRef.current = '';
    // Deliberately NOT clearing the degradation here. The stamp above already
    // keeps it out of another session, and a passive effect could only clear it
    // AFTER the new session's first render was committed — one frame of the
    // previous session's warning shown against the new one. Retaining it also
    // means switching back to a degraded session restores its notice, which is
    // right: that session's toolbelt is still empty, and the event that said so
    // was emitted once, at spawn.
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
      const canonicalIds = new Set(newMessages.map((message) => message.id));
      const echoes = [...pendingEchoesRef.current.entries()]
        .filter(([, echo]) =>
          !echo.canonicalMessageId || !canonicalIds.has(echo.canonicalMessageId),
        )
        .map(([, echo]) => echo);

      for (const [echoId, echo] of pendingEchoesRef.current) {
        if (echo.canonicalMessageId && canonicalIds.has(echo.canonicalMessageId)) {
          pendingEchoesRef.current.delete(echoId);
        }
      }

      setMessages([...newMessages, ...echoes.map((echo) => echo.message)]);
      setPartsState({
        values: {
          ...newPartMap,
          ...Object.fromEntries(echoes.map((echo) => [echo.message.id, echo.parts])),
        },
        sourceIds: {},
      });
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
      const eventQuery = new URLSearchParams({ sessionId });
      const activeExecutionIds = [...activeAssistantMessageIdsRef.current];
      if (activeExecutionIds.length === 1) {
        eventQuery.set('executionId', activeExecutionIds[0]);
      } else if (activeExecutionIds.length > 1) {
        // One EventSource cursor cannot identify a position in multiple
        // execution buffers. Ask the sidecar to replay every active turn from
        // its beginning; cumulative message snapshots are folded idempotently.
        eventQuery.set('replayExecutionIds', activeExecutionIds.join(','));
      }
      if (lastEventIdRef.current) {
        // Query cursors avoid a browser CORS preflight while preserving the
        // same resume semantics as Last-Event-ID on the sidecar.
        eventQuery.set('since', lastEventIdRef.current);
      }
      const url = `${apiUrl}/session/events?${eventQuery.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) throw await responseError(res, 'Live response connection failed');
      setConnected(true);
      setError(null);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let parserFailure: SessionStreamError | null = null;
      const parser = createParser({
        onEvent(event) {
          if (event.id) lastEventIdRef.current = event.id;
          if (!event.data) return;

          try {
            const parsed = JSON.parse(event.data) as Record<string, unknown>;
            handleSSEEventRef.current?.(event.event ?? 'message', parsed);
          } catch {
            parserFailure = new SessionStreamError(
              'INVALID_SESSION_EVENT',
              'The live response stream sent malformed data.',
            );
          }
        },
        onError(parseError) {
          parserFailure = new SessionStreamError(
            'INVALID_EVENT_STREAM',
            `The live response stream could not be parsed: ${parseError.message}`,
          );
        },
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
        if (parserFailure) throw parserFailure;
      }

      const tail = decoder.decode();
      if (tail) parser.feed(tail);
      parser.reset({ consume: true });
      if (parserFailure) throw parserFailure;
      throw new SessionStreamError(
        'SESSION_STREAM_CLOSED',
        'The live response stream closed before the session ended. Reconnecting…',
      );
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'SSE connection error';
      setError(msg);
      setConnected(false);

      // Auto-reconnect
      if (!controller.signal.aborted) {
        reconnectTimerRef.current = setTimeout(
          () => connectSSE(),
          SESSION_STREAM_RECONNECT_DELAY_MS,
        );
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
    const associatePendingEcho = (executionId: string) => {
      for (const echo of pendingEchoesRef.current.values()) {
        if (!echo.executionId) {
          echo.executionId = executionId;
          return;
        }
      }
    };
    const retireExecution = (executionId: string): boolean => {
      if (!executionId) {
        const activeExecutionIds = [...activeAssistantMessageIdsRef.current];
        if (activeExecutionIds.length === 1) {
          return retireExecution(activeExecutionIds[0]);
        }
        if (activeExecutionIds.length > 1) {
          // An unattributed terminal cannot safely choose which concurrent
          // turn ended. Keep both live and surface the event error instead of
          // silently terminating an unrelated response.
          return true;
        }
        pendingEchoesRef.current.clear();
        return false;
      }

      completedExecutionIdsRef.current.add(executionId);
      activeAssistantMessageIdsRef.current.delete(executionId);
      for (const [echoId, echo] of pendingEchoesRef.current) {
        if (
          echo.executionId === executionId
          || (!echo.executionId && pendingEchoesRef.current.size === 1)
        ) {
          pendingEchoesRef.current.delete(echoId);
        }
      }
      return activeAssistantMessageIdsRef.current.size > 0;
    };

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
        associatePendingEcho(id);
        if (!completedExecutionIdsRef.current.has(id)) {
          activeAssistantMessageIdsRef.current.add(id);
          setIsStreaming(true);
        }
      }
    } else if (type === 'message.part.updated') {
      // Part events can arrive before message.updated. Their own message id is
      // authoritative; relying on a global "current message" silently drops
      // the first visible output and corrupts overlapping assistant turns.
      const msgId =
        (props.messageID as string)
        ?? (props.messageId as string)
        ?? '';
      if (!msgId) return;

      const partType = (props.type as string) ?? 'text';
      const sourcePartId =
        (props.id as string)
        ?? `${partType}-${msgId}`;
      associatePendingEcho(msgId);
      if (!completedExecutionIdsRef.current.has(msgId)) {
        activeAssistantMessageIdsRef.current.add(msgId);
        setIsStreaming(true);
      }
      setMessages((prev) => {
        if (prev.some((message) => message.id === msgId)) return prev;
        return [
          ...prev,
          {
            id: msgId,
            role: 'assistant',
            time: { created: Date.now() },
            _insertionIndex: insertionCounterRef.current++,
          },
        ];
      });

      setPartsState((prev) => {
        const existing = prev.values[msgId] ?? [];
        const sourceIds = prev.sourceIds[msgId] ?? [];
        const updated = [...existing];
        const updatedSourceIds = [...sourceIds];
        const knownIndex = sourceIds.indexOf(sourcePartId);

        if (partType === 'text') {
          const text = (props.text as string) ?? (props.content as string) ?? '';
          const textPart: TextPart = { type: 'text', text };
          if (knownIndex >= 0) {
            updated[knownIndex] = textPart;
          } else {
            updatedSourceIds.push(sourcePartId);
            updated.push(textPart);
          }
        } else if (partType === 'tool') {
          const toolId = (props.id as string) ?? (props.toolId as string) ?? sourcePartId;
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
          if (knownIndex >= 0) {
            updated[knownIndex] = toolPart;
          } else {
            updatedSourceIds.push(sourcePartId);
            updated.push(toolPart);
          }
        } else if (partType === 'reasoning') {
          const text = (props.text as string) ?? '';
          const reasoningPart: ReasoningPart = { type: 'reasoning', text };
          if (knownIndex >= 0) {
            updated[knownIndex] = reasoningPart;
          } else {
            updatedSourceIds.push(sourcePartId);
            updated.push(reasoningPart);
          }
        } else {
          return prev;
        }

        return {
          values: { ...prev.values, [msgId]: updated },
          sourceIds: { ...prev.sourceIds, [msgId]: updatedSourceIds },
        };
      });
    } else if (type === 'session.idle') {
      const executionId =
        (props.executionId as string)
        ?? (props.executionID as string)
        ?? '';
      const stillStreaming = retireExecution(executionId);
      setIsStreaming(stillStreaming);
      // The turn is over, so its messages are in the backend's history now:
      // retire the echoes so the refetch below installs the canonical copies.
      // Retiring before the refetch keeps an echo created while it is in
      // flight (the composer unlocks on this event) out of the retired set.
      if (!stillStreaming) refetch();
    } else if (type === 'hub.connections.degraded') {
      // The session started with NO Hub integrations because the sandbox's Hub
      // credential was rejected. It is NOT a turn failure — the agent runs and
      // answers, just without the tenant's tools — so it must not go through
      // `setError`, which the next successful turn would clear.
      setDegradationState({
        // The session this handler was built for. A frame arriving late on a
        // replaced stream therefore stamps the OLD session and can never be
        // read back against the new one.
        sessionId,
        value: {
          kind: 'hub-connections',
          reason: typeof props.reason === 'string' ? props.reason : 'unknown',
          message:
            typeof props.message === 'string'
              ? props.message
              : 'This session started with no Hub integrations attached.',
          connectionCount:
            typeof props.connectionCount === 'number'
              ? props.connectionCount
              : 0,
        },
      });
    } else if (type === 'session.error') {
      const executionId =
        (props.executionId as string)
        ?? (props.executionID as string)
        ?? '';
      const stillStreaming = retireExecution(executionId);
      setIsStreaming(stillStreaming);
      setError(formatError(readErrorDetails(props), 'Agent response failed'));
      if (!stillStreaming) refetch();
    }
  }, [refetch, sessionId]);

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
    if (!token || !sessionId || !apiUrl || !enabled) {
      const admissionError = new SessionStreamError(
        'CHAT_NOT_READY',
        'Chat is not ready yet. Wait for the session connection and try again.',
      );
      setError(admissionError.message);
      throw admissionError;
    }
    if (!connected) {
      const admissionError = new SessionStreamError(
        'CHAT_DISCONNECTED',
        'Chat is reconnecting. Your message was not sent.',
      );
      setError(admissionError.message);
      throw admissionError;
    }
    if (
      pendingEchoesRef.current.size > 0
      || activeAssistantMessageIdsRef.current.size > 0
    ) {
      const admissionError = new SessionStreamError(
        'CHAT_BUSY',
        'The agent is still responding. Wait for this turn to finish before sending another message.',
      );
      setError(admissionError.message);
      throw admissionError;
    }
    setError(null);

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
    setPartsState((prev) => ({
      values: { ...prev.values, [echoId]: echo.parts },
      sourceIds: prev.sourceIds,
    }));
    // The turn is in flight from the user's point of view the moment they hit
    // send; composers gate their submit on this.
    setIsStreaming(true);

    try {
      const url = `${apiUrl}/session/sessions/${encodeURIComponent(sessionId)}/messages`;
      const response = await fetchJson<{
        info?: { id?: string };
        userMessageId?: string;
      }>(url, token, {
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
      if (response.userMessageId) {
        const pending = pendingEchoesRef.current.get(echoId);
        if (pending) pending.canonicalMessageId = response.userMessageId;
      }
      const executionId = response.info?.id;
      if (executionId) {
        const pending = pendingEchoesRef.current.get(echoId);
        if (pending) pending.executionId = executionId;
        if (!completedExecutionIdsRef.current.has(executionId)) {
          activeAssistantMessageIdsRef.current.add(executionId);
        }
      }
    } catch (err) {
      // The turn was never admitted, so no backend copy will arrive to replace
      // the echo: drop it instead of leaving a message the session never saw.
      pendingEchoesRef.current.delete(echoId);
      setMessages((prev) => prev.filter((message) => message.id !== echoId));
      setPartsState((prev) => {
        if (!(echoId in prev.values)) return prev;
        const values = { ...prev.values };
        const sourceIds = { ...prev.sourceIds };
        delete values[echoId];
        delete sourceIds[echoId];
        return { values, sourceIds };
      });
      // Release the composer only when nothing else is running. A detached
      // turn can still be streaming even though this admission failed.
      if (
        pendingEchoesRef.current.size === 0
        && activeAssistantMessageIdsRef.current.size === 0
      ) {
        setIsStreaming(false);
      }
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
      throw err;
    }
  }, [apiUrl, connected, enabled, token, sessionId]);

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

  return {
    messages,
    partMap,
    isStreaming,
    send,
    abort,
    refetch,
    error,
    connected,
    degradation,
  };
}
