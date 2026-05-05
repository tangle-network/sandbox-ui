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
 * back to HTTP+SSE. Kept short because a working sidecar/CF Worker WS
 * upgrade resolves in well under 200ms; anything longer points at a
 * proxy that doesn't speak WebSocket and we want SSE to take over fast.
 */
const WS_OPEN_TIMEOUT_MS = 1500;

/** Convert an http(s) base URL into the matching ws(s) URL. */
function toWsUrl(apiUrl: string, sessionId: string, token: string): string | null {
  try {
    const url = new URL(`${apiUrl}/terminals/${sessionId}/ws`);
    if (url.protocol === 'https:') url.protocol = 'wss:';
    else if (url.protocol === 'http:') url.protocol = 'ws:';
    else return null;
    // Browsers cannot set Authorization headers on WS upgrades, so the
    // token rides as a query parameter. The matching server route reads
    // it from the query and validates the same way the REST routes
    // validate the bearer header.
    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    return null;
  }
}

// Encode stdin text as a UTF-8 binary frame. Distinguishes input from
// JSON control frames purely by frame type — no in-band marker — so a
// user typing `{` does not collide with a control message.
//
// `connectWs` surrenders the WS path entirely when `TextEncoder` is
// missing (see the guard there), so the hook falls back to HTTP+SSE
// rather than running with a half-broken WS. The runtime check below
// is therefore unreachable in practice — kept as defense-in-depth so a
// future refactor that removes the guard fails loudly with a clear
// message instead of silently sending stdin as a TEXT frame, which the
// server treats as a JSON control channel and would drop wholesale.
const stdinEncoder =
  typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function encodeStdin(text: string): ArrayBufferView {
  if (!stdinEncoder) {
    throw new Error(
      'TextEncoder is unavailable; WebSocket transport cannot encode stdin',
    );
  }
  return stdinEncoder.encode(text);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a PTY session against the sidecar terminal API.
 *
 * Transport:
 *   1. POST /terminals creates the session.
 *   2. The hook tries WebSocket: GET /terminals/:id/ws (Upgrade).
 *      - Server → client: TEXT frames carrying raw PTY output.
 *      - Client → server: BINARY frames carrying stdin (UTF-8); TEXT
 *        frames carrying JSON control messages (`{"type":"resize",...}`).
 *   3. If the WS does not reach OPEN within WS_OPEN_TIMEOUT_MS, or it
 *      errors before opening, the hook falls back to SSE+POST:
 *      - GET /terminals/:id/stream (SSE for output)
 *      - POST /terminals/:id/input (one batched POST at a time)
 *      - PATCH /terminals/:id (resize)
 *   4. DELETE /terminals/:id closes the session (both transports).
 *
 * The WS path eliminates the per-keystroke HTTP round-trip that
 * dominates typing latency through edge proxies; the HTTP+SSE path is
 * preserved as a fallback so the hook keeps working against
 * deployments that have not yet shipped the WS endpoint.
 */
export function usePtySession({ apiUrl, token, onData }: UsePtySessionOptions): UsePtySessionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const onDataRef = useRef(onData);
  const connectStreamRef = useRef<((sessionId: string) => Promise<void>) | null>(null);

  // Active WebSocket, if the WS transport won the race in `connect`.
  // Null when running on the SSE+POST fallback.
  const wsRef = useRef<WebSocket | null>(null);

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
    const ws = wsRef.current;
    if (!ws) return;
    wsRef.current = null;
    // readyState may be CONNECTING or OPEN. Either way close() is safe;
    // the browser sends a close frame if the socket is open and tears
    // down the underlying connection if it is still handshaking.
    try {
      ws.close();
    } catch {
      // Older Safari throws if close() races a connection failure; the
      // socket is already gone in that case so swallow.
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
    if (sessionIdRef.current) {
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      fetch(`${apiUrl}/terminals/${sid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      }).catch(() => {});
    }
    // Reject any keystrokes that were buffered waiting for a session.
    // Without this, waiters enqueued between `connect` starting and
    // `cleanup` running would stay pending indefinitely.
    rejectPendingInput('Terminal session is not connected');
    setIsConnected(false);
  }, [apiUrl, token, abortStream, closeWs, rejectPendingInput]);

  // -- Try WebSocket transport ------------------------------------------------
  //
  // Resolves with `true` if the WS reaches OPEN and is now driving
  // input/output for the session, or `false` if the WS could not be
  // constructed, errored before opening, or did not open before
  // WS_OPEN_TIMEOUT_MS elapsed. The caller falls back to SSE+POST when
  // this returns `false`.

  const connectWs = useCallback((sessionId: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      // Both globals are required to drive the WS transport: WebSocket
      // for the wire and TextEncoder for stdin framing (see encodeStdin).
      // If either is missing, surrender so the caller falls back to the
      // HTTP+SSE path rather than opening a socket we can't write to.
      // We probe `stdinEncoder` rather than `typeof TextEncoder` because
      // the encoder is captured once at module load — a runtime polyfill
      // landing after import would lie to a `typeof` check while
      // `encodeStdin` still throws.
      if (typeof WebSocket === 'undefined' || stdinEncoder === null) {
        resolve(false);
        return;
      }
      const wsUrl = toWsUrl(apiUrl, sessionId, token);
      if (!wsUrl) {
        resolve(false);
        return;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        resolve(false);
        return;
      }
      ws.binaryType = 'arraybuffer';

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
        if (!mountedRef.current) {
          // Hook unmounted during the handshake — close cleanly and
          // report failure so `connect`'s caller doesn't try to use a
          // socket against a torn-down session.
          try {
            ws.close();
          } catch {
            // already gone
          }
          settle(false);
          return;
        }
        wsRef.current = ws;
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
        if (text) onDataRef.current(text);
      };

      ws.onerror = () => {
        // `error` always precedes `close`. Defer state changes to
        // `onclose` so we don't double-fire fallback or reconnect.
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (!opened) {
          // Never reached OPEN — surrender so the caller falls back.
          settle(false);
          return;
        }
        // Lost the connection mid-session. Reject any in-flight input
        // so the drain loop doesn't write to a closed socket, drop the
        // connected flag, and schedule a reconnect through the same
        // SSE retry policy as the HTTP path.
        if (!mountedRef.current) return;
        setIsConnected(false);
        if (sessionIdRef.current) {
          retryTimerRef.current = setTimeout(() => {
            if (mountedRef.current && sessionIdRef.current) {
              connectStreamRef.current?.(sessionIdRef.current);
            }
          }, 1000);
        }
      };
    });
  }, [apiUrl, token]);

  // -- Connect SSE stream to an existing terminal session --------------------

  const connectStream = useCallback(async (sessionId: string) => {
    abortStream();
    setError(null);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const streamRes = await fetch(`${apiUrl}/terminals/${sessionId}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        signal: controller.signal,
      });

      if (!streamRes.ok || !streamRes.body) {
        const err = new Error(`SSE stream failed: ${streamRes.status}`);
        (err as Error & { httpStatus?: number }).httpStatus = streamRes.status;
        throw err;
      }

      if (mountedRef.current) {
        setIsConnected(true);
        setError(null);
        retryCountRef.current = 0;
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
  }, [apiUrl, token, abortStream]);

  onDataRef.current = onData;
  connectStreamRef.current = connectStream;

  // -- Full connect: create terminal + open transport ------------------------

  const connect = useCallback(async () => {
    cleanup();
    retryCountRef.current = 0;
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/terminals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
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
      // Paired with the abort in `cleanup`. Lives for the duration of
      // the session so any input POST issued by the drain loop is
      // cancellable synchronously with session teardown.
      inputAbortRef.current = new AbortController();

      // Try the WebSocket transport first. Falls back to SSE+POST if
      // the WS does not open quickly — the existing input queue keeps
      // any keystrokes already buffered from being lost in the swap.
      const wsOk = await connectWs(sessionId);
      if (!mountedRef.current) return;

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
        setIsConnected(false);
      }
    }
  }, [apiUrl, token, cleanup, connectWs, connectStream]);

  // -- Resize terminal -------------------------------------------------------

  const resizeTerminal = useCallback(async (cols: number, rows: number) => {
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
          Authorization: `Bearer ${token}`,
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
  }, [apiUrl, token]);

  // -- Send command ----------------------------------------------------------
  //
  // `sendCommand` is called once per keystroke by xterm's onData handler
  // without any awaiting between calls. To prevent N concurrent dispatches
  // from racing through the network to the sidecar, we serialize dispatch
  // and coalesce any keystrokes that arrive while a request is in flight.

  const drainInputQueue = useCallback(async () => {
    while (pendingBatchRef.current.data.length > 0) {
      const sid = sessionIdRef.current;
      if (!sid) {
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
          ws.send(encodeStdin(batch.data));
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
            Authorization: `Bearer ${token}`,
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
  }, [apiUrl, token]);

  const ensureDrainRunning = useCallback(() => {
    if (drainPromiseRef.current) return;
    // Wrap the drain so we can null out the slot and re-check atomically.
    // Between the drain loop observing an empty queue and the `.finally`
    // below clearing `drainPromiseRef`, a new waiter can slip in and see
    // the slot as "busy". We detect that here and restart, rather than
    // letting the waiter sit forever.
    //
    // The `sessionIdRef.current` guard prevents a microtask starvation
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
        if (pendingBatchRef.current.data.length > 0 && sessionIdRef.current) {
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
