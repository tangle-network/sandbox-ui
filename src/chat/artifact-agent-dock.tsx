"use client";

import * as React from "react";
import { Sparkles, Send, Square, X } from "lucide-react";
import { ChatMessage, type MessageRole } from "@tangle-network/ui/chat";
import { cn } from "../lib/utils";

// ── Public types ─────────────────────────────────────────────────────────────

export type ArtifactKind = string;

export interface ArtifactScope {
  kind: ArtifactKind;
  key: string;
  /** Short label shown in the dock header. Defaults to a generated one from kind/key. */
  label?: string;
}

export interface ArtifactDockMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: Date;
}

export type ArtifactDockStreamEvent =
  | { type: "delta"; text: string }
  | { type: "error"; message: string };

/**
 * Consumer-supplied adapter. Keeps the dock decoupled from any specific app's
 * API surface — every consumer wires its own thread-ensure, message-load, and
 * NDJSON stream-send.
 */
export interface ArtifactAgentDockTransport {
  /** Get-or-create the canonical thread for this scope. */
  ensureThread(scope: ArtifactScope): Promise<{ id: string }>;
  /** Load prior messages, in chronological order. Optional — returns []. */
  loadMessages?(threadId: string): Promise<ArtifactDockMessage[]>;
  /** Stream a user turn. Yield delta events; the dock concatenates them. */
  sendStream(args: {
    threadId: string;
    content: string;
    signal: AbortSignal;
  }): AsyncIterable<ArtifactDockStreamEvent>;
}

export interface ArtifactAgentDockProps {
  scope: ArtifactScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transport: ArtifactAgentDockTransport;
  defaultPrompt?: string;
  /** Toast handler for non-fatal errors. Falls back to console.error. */
  onError?: (message: string) => void;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultScopeLabel(scope: ArtifactScope): string {
  if (scope.label) return scope.label;
  // Common kind labels — consumers can override via scope.label for anything custom.
  switch (scope.kind) {
    case "vault-file":
      return scope.key.split("/").pop() ?? scope.key;
    case "sequence":
      return `Sequence ${scope.key.slice(0, 8)}`;
    case "content":
      return `Content ${scope.key.slice(0, 8)}`;
    case "image":
      return `Image ${scope.key.slice(0, 8)}`;
    case "video":
      return `Video ${scope.key.slice(0, 8)}`;
    case "project":
      return "Project chat";
    case "workspace":
      return "Workspace chat";
    default:
      return scope.key;
  }
}

function normalizeRole(role: string): MessageRole {
  return role === "assistant" || role === "system" ? role : "user";
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * ArtifactAgentDock — slide-in right-rail chat scoped to a single artifact.
 *
 * Renders a persistent, per-artifact conversation surface that streams via a
 * consumer-supplied transport. Mount alongside any artifact view (file editor,
 * sequence editor, asset preview) to give every artifact its own dedicated
 * agent conversation without forking the chat UI per app.
 *
 * Behavior:
 * - On open, calls `transport.ensureThread(scope)` to get the canonical thread
 *   id and `transport.loadMessages(threadId)` to populate prior turns.
 * - On submit, calls `transport.sendStream(...)` and concatenates delta events
 *   into a single streaming assistant message; renders inline.
 * - Composer: Enter sends, Shift+Enter newline, Cancel during stream supported.
 * - Accessibility: scope `aria-label` on the panel, `aria-pressed` is the
 *   consumer's job on whatever button toggles `open`.
 */
export function ArtifactAgentDock({
  scope,
  open,
  onOpenChange,
  transport,
  defaultPrompt,
  onError,
  className,
}: ArtifactAgentDockProps) {
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ArtifactDockMessage[]>([]);
  const [composer, setComposer] = React.useState(defaultPrompt ?? "");
  const [streamContent, setStreamContent] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const reportError = React.useCallback(
    (message: string) => {
      if (onError) onError(message);
      else if (typeof console !== "undefined") console.error("[ArtifactAgentDock]", message);
    },
    [onError],
  );

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      try {
        const { id } = await transport.ensureThread(scope);
        if (cancelled) return;
        setThreadId(id);
        if (transport.loadMessages) {
          const prior = await transport.loadMessages(id);
          if (cancelled) return;
          setMessages(
            prior.map((m) => ({
              ...m,
              role: normalizeRole(m.role),
              createdAt: m.createdAt instanceof Date ? m.createdAt : m.createdAt ? new Date(m.createdAt) : undefined,
            })),
          );
        } else {
          setMessages([]);
        }
      } catch (err) {
        reportError(err instanceof Error ? err.message : "Failed to open artifact chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [open, scope.kind, scope.key, transport, reportError]);

  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, streamContent]);

  const send = React.useCallback(async () => {
    const text = composer.trim();
    if (!text || !threadId || sending) return;

    const userMsg: ArtifactDockMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setComposer("");
    setSending(true);
    setStreamContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantContent = "";
    let streamFailed = false;

    try {
      for await (const event of transport.sendStream({ threadId, content: text, signal: controller.signal })) {
        if (event.type === "delta") {
          assistantContent += event.text;
          setStreamContent(assistantContent);
        } else if (event.type === "error") {
          streamFailed = true;
          reportError(event.message);
        }
      }

      if (assistantContent && !streamFailed) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assist-${Date.now()}`,
            role: "assistant",
            content: assistantContent,
            createdAt: new Date(),
          },
        ]);
      }
      setStreamContent("");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      reportError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [composer, threadId, sending, transport, reportError]);

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    setSending(false);
    setStreamContent("");
  }, []);

  if (!open) return null;

  const heading = defaultScopeLabel(scope);

  return (
    <aside
      className={cn(
        "flex h-full w-[420px] min-w-[360px] max-w-[480px] flex-col border-l border-border bg-card/95 shadow-xl",
        className,
      )}
      aria-label={`Agent chat about ${heading}`}
    >
      <header className="flex items-center justify-between border-b border-border bg-background/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Discussing</div>
            <div className="truncate text-sm font-semibold text-foreground">{heading}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close artifact chat"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">Loading conversation…</div>
        ) : messages.length === 0 && !streamContent ? (
          <div className="px-3 py-12 text-center">
            <Sparkles className="mx-auto mb-3 h-5 w-5 text-muted-foreground/40" />
            <p className="text-sm text-foreground">Ask the agent about this {scope.kind === "vault-file" ? "document" : scope.kind}.</p>
            <p className="mt-1 text-xs text-muted-foreground">It can read the current contents and propose edits, rewrites, or follow-ups.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <ChatMessage key={m.id} role={m.role} content={m.content} timestamp={m.createdAt} />
            ))}
            {streamContent && <ChatMessage role="assistant" content={streamContent} isStreaming />}
          </div>
        )}
      </div>

      <form
        className="border-t border-border bg-background/60 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !sending) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Ask about ${heading}…`}
            rows={2}
            disabled={!threadId}
            className="min-h-[44px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          />
          {sending ? (
            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!composer.trim() || !threadId}
              aria-label="Send"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </aside>
  );
}

// ── Optional helper transport — fetch + NDJSON pattern most consumers want ───

/**
 * Build a transport that hits the Tangle product convention: POST
 * /api/threads with body.scope = ArtifactScope to ensure the canonical
 * thread; GET /api/threads/:id/messages to load history; POST /api/chat
 * with body = {workspaceId, threadId, content} and an NDJSON event stream
 * to send. Most consumers can use this as-is; advanced ones can supply
 * their own transport object.
 *
 * The expected NDJSON event shape:
 *   { type: "message.part.delta", data: { text: string } }   // assistant chunk
 *   { type: "error", data: { message: string, ... } }        // surface error
 *
 * Other event types are ignored — consumers that need tool-call rendering
 * or other event semantics should ship a richer transport.
 */
export function createFetchTransport(opts: {
  workspaceId: string;
  threadsUrl?: string;
  chatUrl?: string;
  /** Optional fetch override (auth headers, baseURL, etc.). */
  fetchImpl?: typeof fetch;
}): ArtifactAgentDockTransport {
  const threadsUrl = opts.threadsUrl ?? "/api/threads";
  const chatUrl = opts.chatUrl ?? "/api/chat";
  const f: typeof fetch = opts.fetchImpl ?? ((...args) => fetch(...args));
  const workspaceId = opts.workspaceId;

  return {
    async ensureThread(scope) {
      const url = threadsUrl.includes("?")
        ? `${threadsUrl}&workspaceId=${encodeURIComponent(workspaceId)}`
        : `${threadsUrl}?workspaceId=${encodeURIComponent(workspaceId)}`;
      const res = await f(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, scope, ensureScoped: true }),
      });
      if (!res.ok) throw new Error(`Thread ensure failed (${res.status})`);
      const data = (await res.json()) as { thread?: { id: string }; id?: string };
      const id = data.thread?.id ?? data.id;
      if (!id) throw new Error("Malformed ensure response");
      return { id };
    },
    async loadMessages(threadId) {
      const res = await f(`${threadsUrl}/${encodeURIComponent(threadId)}/messages`);
      if (!res.ok) return [];
      const data = (await res.json()) as {
        messages?: Array<{ id: string; role: string; content: string; createdAt: string }>;
      };
      return (data.messages ?? []).map((m) => ({
        id: m.id,
        role: normalizeRole(m.role),
        content: m.content,
        createdAt: new Date(m.createdAt),
      }));
    },
    sendStream({ threadId, content, signal }) {
      return (async function* () {
        const res = await f(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, threadId, content }),
          signal,
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          yield { type: "error", message: text || `Send failed (${res.status})` };
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as { type?: string; data?: Record<string, unknown> };
              if (event.type === "message.part.delta" && event.data) {
                const text = event.data.text;
                if (typeof text === "string" && text.length > 0) {
                  yield { type: "delta", text };
                }
              } else if (event.type === "error" && event.data) {
                const message = typeof event.data.message === "string" ? event.data.message : "Stream error";
                yield { type: "error", message };
              }
            } catch {
              // Skip malformed line.
            }
          }
        }
      })();
    },
  };
}
