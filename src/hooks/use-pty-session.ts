import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePtySessionOptions {
  /** Base URL of the sidecar (e.g. "http://localhost:9100"). */
  apiUrl: string;
  /** Bearer token for authentication. */
  token: string;
  /** Called with raw PTY output (may contain ANSI escape codes). */
  onData: (data: string) => void;
  /**
   * Stable id identifying this terminal connection to the sidecar.
   * Reused on every connect/reconnect so the sidecar restores the same
   * PTY session (within its reconnect window) instead of spawning a
   * fresh shell. When omitted, a random id is generated per connect —
   * so the session does not survive a remount.
   */
  connectionId?: string;
}

export interface UsePtySessionReturn {
  /** Whether the underlying transport is connected and receiving data. */
  isConnected: boolean;
  /** Connection or API error, if any. */
  error: string | null;
  /** Send a command to the PTY session. */
  sendCommand: (command: string) => Promise<void>;
  /** Safely resize the remote PTY. */
  resizeTerminal: (cols: number, rows: number) => Promise<void>;
  /** Tear down and reconnect. */
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Input queue
// ---------------------------------------------------------------------------

/**
 * Waiter bound to a single `sendCommand` call. Each call appends its
 * payload to the current pending batch and registers a waiter; the
 * drain loop resolves/rejects all waiters in a batch together based on
 * the outcome of the single send that dispatched it.
 */
interface InputWaiter {
  resolve: () => void;
  reject: (err: unknown) => void;
}

interface PendingBatch {
  data: string;
  waiters: InputWaiter[];
}

function createEmptyBatch(): PendingBatch {
  return { data: '', waiters: [] };
}

// ---------------------------------------------------------------------------
// WebSocket transport
// ---------------------------------------------------------------------------

/**
 * Time we wait for `new WebSocket(...)` to reach OPEN before falling
 * back to the HTTP+SSE transport. The cold terminal-WS upgrade can
 * traverse several proxy hops (browser → app worker → sandbox edge →
 * orchestrator dial → host-agent → sidecar) and take a few seconds to
 * establish; the budget must cover that so the direct WS path — the
 * only one that sends `init` — wins instead of dropping through to the
 * fallback dial on a cold connect.
 */
const WS_OPEN_TIMEOUT_MS = 10000;

/** Convert an http(s) base URL into the matching ws(s) URL. */
function toWsUrl(apiUrl: string, sessionId: string): string | null {
  try {
    const base = typeof window !== 'undefined' ? window.location.href : undefined;
    const url = new URL(`${apiUrl}/terminals/${sessionId}/ws`, base);
    if (url.protocol === 'https:') url.protocol = 'wss:';
    else if (url.protocol === 'http:') url.protocol = 'ws:';
    else return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Encode the bearer token as a WebSocket subprotocol identifier.
 *
 * Browsers cannot set the `Authorization` header on a WebSocket
 * upgrade. The naive workaround — putting the token in a query
 * parameter — is a real security risk: query strings are routinely
 * captured in edge-proxy access logs, browser DevTools network
 * panels, referrer headers on internal links, and log-aggregation
 * systems where they may be retained for years. Move the token to
 * `Sec-WebSocket-Protocol` instead, which is a request *header* and
 * is treated like other auth headers by the same systems (i.e. not
 * surfaced in URL-shaped logs).
 *
 * Per RFC 7230 a subprotocol identifier is a `token`, which excludes
 * `+`, `/`, and `=`. Bearer tokens minted by the sandbox API are
 * not guaranteed to satisfy that grammar, so we base64url-encode the
 * value first. The matching server reverses the encoding before
 * validating.
 *
 * Per RFC 6455 §4.2.2, if the server doesn't recognize any of the
 * offered subprotocols it omits `Sec-WebSocket-Protocol` from the
 * response and the connection is established as if no subprotocol
 * was requested. Sending `bearer.<…>` is therefore non-disruptive
 * against backends that don't yet consume it — they can authenticate
 * the user via a same-origin session cookie, and a future backend
 * change can start consuming the subprotocol to extend WS auth to
 * non-cookie consumers.
 */
const BEARER_SUBPROTOCOL_PREFIX = 'bearer.';

function toBearerSubprotocol(token: string): string | null {
  if (typeof btoa === 'undefined') return null;
  let encoded: string;
  try {
    encoded = btoa(token);
  } catch {
    // `btoa` rejects strings whose characters exceed U+00FF. Bearer
    // tokens minted by the sandbox API are ASCII, so this branch is
    // not expected in production; surrender so the caller falls
    // back to HTTP+SSE rather than opening a malformed WS.
    return null;
  }
  // base64url: drop padding, swap `+`/`/` for `-`/`_`.
  return `${BEARER_SUBPROTOCOL_PREFIX}${encoded
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;
}

const DEFAULT_TERMINAL_COLS = 80;
const DEFAULT_TERMINAL_ROWS = 24;

function createTerminalConnectionId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `terminal-${cryptoApi.randomUUID()}`;
  }
  return `terminal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a PTY session against the sidecar terminal API.
 *
 * Transport:
 *   1. Try the current sidecar WebSocket contract directly:
 *      GET /terminals/:id/ws, then send `{"type":"init",...}`.
 *      - Server → client: BINARY frames carrying PTY output; TEXT frames
 *        carrying lifecycle/control messages.
 *      - Client → server: TEXT frames carrying JSON input/resize messages.
 *   2. If direct WS does not reach OPEN within WS_OPEN_TIMEOUT_MS, or it
 *      errors before opening, fall back to the older terminal contract:
 *      - POST /terminals creates the session.
 *      - GET /terminals/:id/ws tries the older WS transport.
 *      - GET /terminals/:id/stream (SSE for output)
 *      - POST /terminals/:id/input (one batched POST at a time)
 *      - PATCH /terminals/:id (resize)
 *   3. DELETE /terminals/:id closes sessions created by the older REST API.
 *
 * The WS path eliminates the per-keystroke HTTP round-trip that
 * dominates typing latency through edge proxies; the HTTP+SSE path is
 * preserved as a fallback so the hook keeps working against
 * deployments that have not yet shipped the WS endpoint.
 */
export function usePtySession({ apiUrl, token, onData, connectionId: providedConnectionId }: UsePtySessionOptions): UsePtySessionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  // Monotonic token bumped once per `connect()` call. Each cycle captures
  // its value and bails when it no longer matches, so a superseded cycle
  // stops instead of running the fallback. This must NOT key off the
  // connection id: a caller-supplied stable `connectionId` is identical
  // across concurrent cycles (StrictMode double-invoke, token refresh
  // mid-handshake), so an id comparison cannot tell cycles apart.
  const connectGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const onDataRef = useRef(onData);
  // Latest token, read at dial/request time. Kept in a ref — NOT a
  // dependency — so a freshly minted token (the connection endpoint
  // mints a new one on every call, incl. the dev double-invoke and the
  // periodic refresh) does not re-run the connect effect and tear down
  // a live/connecting socket. The token only matters at handshake time.
  const tokenRef = useRef(token);
  const connectStreamRef = useRef<((sessionId: string) => Promise<void>) | null>(null);
  const reconnectRef = useRef<(() => void) | null>(null);
  const shouldDeleteSessionRef = useRef(false);
  const transportReadyRef = useRef(false);
  const colsRef = useRef(DEFAULT_TERMINAL_COLS);
  const rowsRef = useRef(DEFAULT_TERMINAL_ROWS);

  // Active WebSocket, if the WS transport won the race in `connect`.
  // Null when running on the SSE+POST fallback.
  const wsRef = useRef<WebSocket | null>(null);

  // Tracks the in-flight handshake so cleanup can abort a CONNECTING
  // socket. `wsRef` only gets the socket once `onopen` fires, so
  // without a separate pending handle a prop change during the
  // handshake window leaves the socket orphaned. The orphan would
  // later complete its handshake against a session that's already
  // been DELETEd, briefly take over `wsRef` in its own `onopen`, and
  // schedule a duplicate SSE stream against the new session via its
  // eventual `onclose`.
  const pendingWsRef = useRef<WebSocket | null>(null);

  // Input serialization: at most one input dispatch is in flight per
  // session. Keystrokes that arrive while a request is in flight are
  // concatenated into `pendingBatchRef` and dispatched as a single
  // follow-up. Without this, xterm's onData fires one unordered fetch
  // per keystroke, which under modest typing speed produces >1s lag and
  // scrambled characters because (a) each POST pays the proxy/TLS
  // round-trip separately and (b) the sidecar receives the N concurrent
  // requests in arrival order, not keystroke order. Coalescing collapses
  // bursts into O(RTT) requests and guarantees the server sees one write
  // at a time per terminal. The same queue is reused on the WS path so
  // that a single send carries every byte that arrived during the
  // previous tick — this is mostly a noop on WS (sends are local) but
  // keeps the API contract identical across transports.
  const pendingBatchRef = useRef<PendingBatch>(createEmptyBatch());
  const drainPromiseRef = useRef<Promise<void> | null>(null);
  // Session-scoped controller used to cancel in-flight input POSTs when
  // `cleanup` runs, so a batch that was swapped out of `pendingBatchRef`
  // and is awaiting its fetch does not settle invisibly to `cleanup` —
  // its waiters reject via the drain's catch path instead.
  const inputAbortRef = useRef<AbortController | null>(null);
  // Indirection ref so `connect` (declared above `ensureDrainRunning`)
  // can poke the input queue once the sessionId lands, without forcing
  // `ensureDrainRunning` into `connect`'s dep array — which would churn
  // the `useEffect` that owns terminal creation.
  const ensureDrainRunningRef = useRef<(() => void) | null>(null);

  const rejectPendingInput = useCallback((reason: string) => {
    const batch = pendingBatchRef.current;
    if (batch.waiters.length === 0) {
      pendingBatchRef.current = createEmptyBatch();
      return;
    }
    pendingBatchRef.current = createEmptyBatch();
    const err = new Error(reason);
    for (const w of batch.waiters) w.reject(err);
  }, []);

  // -- Abort SSE stream only (does NOT delete the terminal session) ----------

  const abortStream = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const closeWs = useCallback(() => {
    // Tear down both the active OPEN socket (in `wsRef`) AND any
    // socket still handshaking (in `pendingWsRef`). Closing during
    // CONNECTING aborts the handshake so the orphan never reaches
    // `onopen`; the matching identity-checked clear in the handlers
    // below ensures a late event from this WS no longer mutates
    // shared state.
    const active = wsRef.current;
    if (active) {
      wsRef.current = null;
      try {
        active.close();
      } catch {
        // Older Safari throws if close() races a connection failure;
        // the socket is already gone in that case so swallow.
      }
    }
    const pending = pendingWsRef.current;
    if (pending) {
      pendingWsRef.current = null;
      try {
        pending.close();
      } catch {
        // already gone
      }
    }
  }, []);

  // -- Full cleanup: abort transports + delete terminal session --------------

  const cleanup = useCallback(() => {
    abortStream();
    closeWs();
    // Abort any in-flight input POST. Its waiters are not visible to
    // `rejectPendingInput` (they live on a batch the drain loop already
    // swapped out of `pendingBatchRef`), so without this they would
    // settle based on a response that is no longer meaningful once the
    // session has been deleted.
    if (inputAbortRef.current) {
      inputAbortRef.current.abort();
      inputAbortRef.current = null;
    }
    transportReadyRef.current = false;
    if (sessionIdRef.current) {
      const sid = sessionIdRef.current;
      const shouldDeleteSession = shouldDeleteSessionRef.current;
      sessionIdRef.current = null;
      shouldDeleteSessionRef.current = false;
      if (shouldDeleteSession) {
        fetch(`${apiUrl}/terminals/${sid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          credentials: 'include',
        }).catch(() => {});
      }
    }
    // Reject any keystrokes that were buffered waiting for a session.
    // Without this, waiters enqueued between `connect` starting and
    // `cleanup` running would stay pending indefinitely.
    rejectPendingInput('Terminal session is not connected');
    setIsConnected(false);
  }, [apiUrl, abortStream, closeWs, rejectPendingInput]);

  // -- Try WebSocket transport ------------------------------------------------
  //
  // Resolves with `true` if the WS reaches OPEN and is now driving
  // input/output for the session, or `false` if the WS could not be
  // constructed, errored before opening, or did not open before
  // WS_OPEN_TIMEOUT_MS elapsed. The caller falls back to SSE+POST when
  // this returns `false`.

  const connectWs = useCallback((
    sessionId: string,
    options: { initOnOpen?: boolean } = {},
  ): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (typeof WebSocket === 'undefined') {
        resolve(false);
        return;
      }
      const wsUrl = toWsUrl(apiUrl, sessionId);
      if (!wsUrl) {
        resolve(false);
        return;
      }
      const subprotocol = toBearerSubprotocol(tokenRef.current);
      if (!subprotocol) {
        resolve(false);
        return;
      }

      let ws: WebSocket;
      try {
        // Pass the bearer token in the WebSocket subprotocol header
        // rather than the URL query string. See `toBearerSubprotocol`
        // for the encoding contract and the security rationale.
        ws = new WebSocket(wsUrl, [subprotocol]);
      } catch {
        resolve(false);
        return;
      }
      ws.binaryType = 'arraybuffer';
      // Register the handshaking socket so a prop-change-driven
      // `cleanup()` can abort it before it ever reaches `onopen`.
      // The slot is identity-checked when later events fire so a WS
      // that's been displaced by a newer connectWs call cannot clear
      // the new WS's pending entry.
      pendingWsRef.current = ws;

      let opened = false;
      let settled = false;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimer);
        resolve(ok);
      };

      const handshakeTimer = setTimeout(() => {
        if (opened) return;
        // The WS never reached OPEN. Kill the socket so it doesn't
        // race the SSE fallback later, then surrender.
        try {
          ws.close();
        } catch {
          // already gone
        }
        settle(false);
      }, WS_OPEN_TIMEOUT_MS);

      ws.onopen = () => {
        opened = true;
        // If `pendingWsRef` no longer points at us, this WS was
        // cleaned up while handshaking and a newer connect cycle has
        // taken over. Spec-compliant runtimes don't fire `onopen`
        // after a CONNECTING-time `close()`, but treat it as
        // defense-in-depth: never let an orphan handshake overwrite
        // the active wsRef or flip `isConnected` on the new
        // transport's behalf.
        if (pendingWsRef.current !== ws || !mountedRef.current) {
          try {
            ws.close();
          } catch {
            // already gone
          }
          settle(false);
          return;
        }
        pendingWsRef.current = null;
        if (options.initOnOpen) {
          try {
            ws.send(JSON.stringify({
              type: 'init',
              cols: colsRef.current,
              rows: rowsRef.current,
            }));
          } catch {
            try {
              ws.close();
            } catch {
              // already gone
            }
            settle(false);
            return;
          }
        }
        wsRef.current = ws;
        transportReadyRef.current = true;
        setIsConnected(true);
        setError(null);
        retryCountRef.current = 0;
        settle(true);
      };

      ws.onmessage = (ev) => {
        if (!mountedRef.current) return;
        const data = ev.data;
        let text: string;
        if (typeof data === 'string') {
          text = data;
        } else if (data instanceof ArrayBuffer) {
          text = new TextDecoder().decode(data);
        } else if (ArrayBuffer.isView(data)) {
          text = new TextDecoder().decode(data);
        } else {
          // Blob (older runtimes that didn't honor binaryType). Defer to
          // a microtask read; xterm tolerates the small extra delay.
          (data as Blob).text().then((t) => {
            if (mountedRef.current) onDataRef.current(t);
          }).catch(() => {});
          return;
        }
        if (typeof data === 'string') {
          try {
            const event = JSON.parse(text);
            if (event?.type === 'ready') {
              return;
            }
            if (event?.type === 'error') {
              const message = typeof event.message === 'string'
                ? event.message
                : 'Terminal WebSocket error';
              setError(message);
              return;
            }
            if (event?.type === 'exit') {
              setIsConnected(false);
              return;
            }
          } catch {
            // Not a lifecycle/control JSON frame; forward as PTY output.
          }
        }
        if (text) onDataRef.current(text);
      };

      ws.onerror = () => {
        // `error` always precedes `close`. Defer state changes to
        // `onclose` so we don't double-fire fallback or reconnect.
      };

      ws.onclose = () => {
        // Identity-checked clear of the pending slot. If the slot
        // already moved on to a newer connectWs cycle (e.g. cleanup
        // ran while we were handshaking) we mustn't clobber the
        // newer WS's entry.
        if (pendingWsRef.current === ws) {
          pendingWsRef.current = null;
        }
        // Snapshot whether THIS socket is the active transport before
        // we touch any shared state. In real browsers `onclose` is
        // emitted asynchronously, so a prop change that closed this
        // WS while it was OPEN can have already advanced the hook to
        // a new session (cleanup() nulled wsRef, then a new connect()
        // populated it with a different ws). Without this snapshot
        // the orphaned `setIsConnected(false)` and reconnect-timer
        // scheduling below would corrupt the active transport's
        // state — opening a duplicate SSE stream against the new
        // session and flickering isConnected.
        const wasActive = wsRef.current === ws;
        if (wasActive) {
          wsRef.current = null;
          transportReadyRef.current = false;
        }
        if (!opened) {
          // Never reached OPEN — surrender so the caller falls back.
          settle(false);
          return;
        }
        // Lost the connection mid-session. The drain loop's own
        // try/catch around `ws.send` rejects any batch that was in
        // flight when the socket dropped; subsequent batches fall
        // through to the HTTP path because `wsRef.current` was nulled
        // above. Drop the connected flag and schedule a reconnect
        // through the same SSE retry policy as the HTTP path — but
        // only if this WS was still the active transport, otherwise
        // we're an orphan from a torn-down connect cycle.
        if (!wasActive || !mountedRef.current) return;
        setIsConnected(false);
        if (sessionIdRef.current) {
          retryTimerRef.current = setTimeout(() => {
            if (mountedRef.current && sessionIdRef.current) {
              if (shouldDeleteSessionRef.current) {
                connectStreamRef.current?.(sessionIdRef.current);
              } else {
                reconnectRef.current?.();
              }
            }
          }, 1000);
        }
      };
    });
  }, [apiUrl]);

  // -- Connect SSE stream to an existing terminal session --------------------

  const connectStream = useCallback(async (sessionId: string) => {
    abortStream();
    setError(null);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const streamRes = await fetch(`${apiUrl}/terminals/${sessionId}/stream`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        credentials: 'include',
        signal: controller.signal,
      });

      if (!streamRes.ok || !streamRes.body) {
        const err = new Error(`SSE stream failed: ${streamRes.status}`);
        (err as Error & { httpStatus?: number }).httpStatus = streamRes.status;
        throw err;
      }

      if (mountedRef.current) {
        transportReadyRef.current = true;
        setIsConnected(true);
        setError(null);
        retryCountRef.current = 0;
        ensureDrainRunningRef.current?.();
      }

      const reader = streamRes.body.getReader();
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
          for (const line of frame.split('\n')) {
            if (line.startsWith('data:')) {
              const raw = line.slice(5).trim();
              if (!raw) continue;
              try {
                const event = JSON.parse(raw);
                if (event.type === 'data.stdout' || event.type === 'data.stderr') {
                  const text = event.properties?.text ?? '';
                  if (text && mountedRef.current) {
                    onDataRef.current(text);
                  }
                }
              } catch {
                // Not JSON — forward raw (backwards compat with raw PTY streams)
                if (mountedRef.current) {
                  onDataRef.current(raw);
                }
              }
            }
          }
        }
      }

      // Stream ended cleanly (server closed connection) — reconnect to existing session
      if (mountedRef.current) {
        transportReadyRef.current = false;
        setIsConnected(false);
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current && sessionIdRef.current) {
            connectStreamRef.current?.(sessionIdRef.current);
          }
        }, 1000);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Stream connection failed';
        setError(message);
        transportReadyRef.current = false;
        setIsConnected(false);

        // Don't retry on client errors (4xx) — they won't resolve on retry
        const httpStatus = (err as Error & { httpStatus?: number }).httpStatus;
        const is4xx = httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500;
        const MAX_RETRIES = 8;
        if (!is4xx && retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(3000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current++;
          retryTimerRef.current = setTimeout(() => {
            if (mountedRef.current && sessionIdRef.current) {
              connectStreamRef.current?.(sessionIdRef.current);
            }
          }, delay);
        }
      }
    }
  }, [apiUrl, abortStream]);

  onDataRef.current = onData;
  tokenRef.current = token;
  connectStreamRef.current = connectStream;

  // -- Full connect: create terminal + open transport ------------------------

  const connect = useCallback(async () => {
    cleanup();
    const myGen = ++connectGenRef.current;
    retryCountRef.current = 0;
    setError(null);

    try {
      // Reuse the caller-supplied stable id when present so the sidecar
      // restores the same PTY across remounts; otherwise mint a throwaway
      // id (session does not survive a remount).
      const connectionId = providedConnectionId ?? createTerminalConnectionId();
      if (!mountedRef.current) return;
      sessionIdRef.current = connectionId;
      shouldDeleteSessionRef.current = false;
      transportReadyRef.current = false;
      inputAbortRef.current = new AbortController();

      const directWsOk = await connectWs(connectionId, { initOnOpen: true });
      if (!mountedRef.current || connectGenRef.current !== myGen) return;

      ensureDrainRunningRef.current?.();

      if (directWsOk) {
        return;
      }

      sessionIdRef.current = null;
      transportReadyRef.current = false;
      if (inputAbortRef.current) {
        inputAbortRef.current.abort();
        inputAbortRef.current = null;
      }

      const res = await fetch(`${apiUrl}/terminals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to create terminal: ${res.status}`);
      }

      const body = await res.json();
      const sessionId: string = body.data?.sessionId ?? body.sessionId;
      if (!sessionId) throw new Error('No sessionId in response');

      if (!mountedRef.current) return;
      sessionIdRef.current = sessionId;
      shouldDeleteSessionRef.current = true;
      transportReadyRef.current = false;
      // Paired with the abort in `cleanup`. Lives for the duration of
      // the session so any input POST issued by the drain loop is
      // cancellable synchronously with session teardown.
      inputAbortRef.current = new AbortController();

      // Try the WebSocket transport first. Falls back to SSE+POST if
      // the WS does not open quickly — the existing input queue keeps
      // any keystrokes already buffered from being lost in the swap.
      // `initOnOpen` is required: the sidecar WS contract rejects any
      // first frame that is not `init`, so this dial must send it too.
      const wsOk = await connectWs(sessionId, { initOnOpen: true });
      // Bail if the hook unmounted OR a newer connect cycle has taken
      // over. Without this supersession check, a stale connect would
      // fall through to `connectStream(sessionId)` against a session
      // that's already been DELETEd, opening an SSE stream that briefly
      // competes with the new transport.
      if (!mountedRef.current || connectGenRef.current !== myGen) return;

      // Flush any keystrokes that arrived between mount and now. They
      // were accepted into `pendingBatchRef` but the drain loop exited
      // early because sessionIdRef was still null. Runs for both
      // transports; the drain checks readyState to pick its dispatch.
      ensureDrainRunningRef.current?.();

      if (wsOk) {
        // WS is now driving I/O. Don't open the SSE stream — the WS
        // delivers output directly via onmessage. If the WS later drops
        // mid-session, its onclose schedules a reconnect that goes
        // through the SSE path so we degrade gracefully on flaky links.
        return;
      }

      await connectStream(sessionId);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Terminal connection failed';
        setError(message);
        transportReadyRef.current = false;
        setIsConnected(false);
      }
    }
  }, [apiUrl, providedConnectionId, cleanup, connectWs, connectStream]);
  reconnectRef.current = connect;

  // -- Resize terminal -------------------------------------------------------

  const resizeTerminal = useCallback(async (cols: number, rows: number) => {
    if (cols > 0) colsRef.current = cols;
    if (rows > 0) rowsRef.current = rows;

    const sid = sessionIdRef.current;
    if (!sid || cols <= 0 || rows <= 0) return;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        return;
      } catch (err) {
        // Send failed (socket racing close, backpressure errored, etc.).
        // Fall through to the HTTP path so the resize is still applied.
        console.warn('Terminal resize over WS failed; falling back to HTTP', err);
      }
    }

    try {
      const res = await fetch(`${apiUrl}/terminals/${sid}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ cols, rows }),
      });
      if (!res.ok) {
        console.error('Failed to resize terminal:', res.status);
      }
    } catch (err) {
      console.error('Failed to resize terminal', err);
    }
  }, [apiUrl]);

  // -- Send command ----------------------------------------------------------
  //
  // `sendCommand` is called once per keystroke by xterm's onData handler
  // without any awaiting between calls. To prevent N concurrent dispatches
  // from racing through the network to the sidecar, we serialize dispatch
  // and coalesce any keystrokes that arrive while a request is in flight.

  const drainInputQueue = useCallback(async () => {
    while (pendingBatchRef.current.data.length > 0) {
      const sid = sessionIdRef.current;
      if (!sid || !transportReadyRef.current) {
        // No session yet (mount-time race: xterm is already accepting
        // input while `connect()` is still awaiting POST /terminals) or
        // we're between sessions after cleanup. Leave the buffer intact
        // and exit — `connect` calls `ensureDrainRunning` once the new
        // session is ready, and `cleanup` explicitly rejects any
        // still-pending waiters. This avoids both the pre-fix behavior
        // (silently swallowing keystrokes) and spurious "not connected"
        // rejections during the first few ms after mount.
        return;
      }

      const batch = pendingBatchRef.current;
      pendingBatchRef.current = createEmptyBatch();

      // WebSocket fast path. ws.send is synchronous — it queues into
      // the socket's outbound buffer and returns immediately, so we
      // don't await anything and the loop spins through any concurrent
      // enqueues without yielding to the event loop. The single-batch
      // contract from the HTTP path is preserved (each batch's waiters
      // settle together based on this one send).
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'input', data: batch.data }));
          for (const w of batch.waiters) w.resolve();
        } catch (err) {
          for (const w of batch.waiters) w.reject(err);
        }
        continue;
      }

      // HTTP fallback path. Same shape as before: one POST at a time,
      // body is the coalesced batch, waiters settle together.
      try {
        const res = await fetch(`${apiUrl}/terminals/${sid}/input`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenRef.current}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: batch.data }),
          signal: inputAbortRef.current?.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Input failed: ${res.status}`);
        }
        for (const w of batch.waiters) w.resolve();
      } catch (err) {
        // When `cleanup` aborts the controller mid-fetch, surface the
        // same "not connected" error that `rejectPendingInput` raises
        // so consumers see a single consistent rejection shape.
        const isAbort = (err as Error | undefined)?.name === 'AbortError';
        const rejection = isAbort
          ? new Error('Terminal session is not connected')
          : err;
        if (!isAbort) console.error('Failed to send command', err);
        for (const w of batch.waiters) w.reject(rejection);
        // Continue the loop: if the failure was transient, subsequent
        // batches may succeed. Permanent failures (session gone, 4xx,
        // aborted) will re-surface on the next iteration via the same
        // code path — when `cleanup` aborted, `sessionIdRef` is now
        // null so the next iteration exits immediately.
      }
    }
  }, [apiUrl]);

  const ensureDrainRunning = useCallback(() => {
    if (drainPromiseRef.current) return;
    // Wrap the drain so we can null out the slot and re-check atomically.
    // Between the drain loop observing an empty queue and the `.finally`
    // below clearing `drainPromiseRef`, a new waiter can slip in and see
    // the slot as "busy". We detect that here and restart, rather than
    // letting the waiter sit forever.
    //
    // The session/transport-ready guard prevents a microtask starvation
    // loop when `sendCommand` runs before `connect` has set the session:
    // `drainInputQueue` exits immediately (sid null), the `.finally`
    // fires as a microtask, sees pending data, and schedules another
    // `run()` — which also exits immediately, schedules another finally,
    // and so on. Each iteration enqueues a fresh microtask, starving
    // the event loop and preventing the in-flight `POST /terminals`
    // macrotask from ever being dispatched. Only restart when there is
    // actually a session to drain into; `connect` pokes
    // `ensureDrainRunningRef.current?.()` once the sessionId lands,
    // and the drain picks up the buffered keystrokes from there.
    const run = (): Promise<void> =>
      drainInputQueue().finally(() => {
        if (
          pendingBatchRef.current.data.length > 0 &&
          sessionIdRef.current &&
          transportReadyRef.current
        ) {
          drainPromiseRef.current = run();
        } else {
          drainPromiseRef.current = null;
        }
      });
    drainPromiseRef.current = run();
  }, [drainInputQueue]);
  ensureDrainRunningRef.current = ensureDrainRunning;

  const sendCommand = useCallback((command: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      // Empty payloads keep the previous contract (resolve with no
      // network traffic) and avoid churning the queue.
      if (command.length === 0) {
        resolve();
        return;
      }
      pendingBatchRef.current.data += command;
      pendingBatchRef.current.waiters.push({ resolve, reject });
      ensureDrainRunning();
    });
  }, [ensureDrainRunning]);

  // -- Lifecycle -------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  return { isConnected, error, sendCommand, resizeTerminal, reconnect: connect };
}
