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
  /** Whether the SSE stream is connected and receiving data. */
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
 * the outcome of the single POST that dispatched it.
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
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a PTY session against the sidecar terminal API.
 *
 * Protocol:
 * - POST /terminals              → create session → { data: { sessionId } }
 * - GET  /terminals/{id}/stream  → SSE output (raw PTY with ANSI codes)
 * - POST /terminals/{id}/input   → send input     { data: "..." }
 * - DELETE /terminals/{id}       → close session
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

  // Input serialization: at most one POST /terminals/:id/input is in
  // flight per session. Keystrokes that arrive while a request is in
  // flight are concatenated into `pendingBatchRef` and dispatched as a
  // single follow-up POST. Without this, xterm's onData fires one
  // unordered fetch per keystroke, which under modest typing speed
  // produces >1s lag and scrambled characters because (a) each POST
  // pays the proxy/TLS round-trip separately and (b) the sidecar
  // receives the N concurrent requests in arrival order, not keystroke
  // order. Coalescing collapses bursts into O(RTT) requests and
  // guarantees the server sees one write at a time per terminal.
  const pendingBatchRef = useRef<PendingBatch>(createEmptyBatch());
  const drainPromiseRef = useRef<Promise<void> | null>(null);
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

  // -- Full cleanup: abort stream + delete terminal session ------------------

  const cleanup = useCallback(() => {
    abortStream();
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
  }, [apiUrl, token, abortStream, rejectPendingInput]);

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

  // -- Full connect: create terminal + open SSE stream -----------------------

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

      // Flush any keystrokes that arrived between mount and now. They
      // were accepted into `pendingBatchRef` but the drain loop exited
      // early because sessionIdRef was still null.
      ensureDrainRunningRef.current?.();

      await connectStream(sessionId);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Terminal connection failed';
        setError(message);
        setIsConnected(false);
      }
    }
  }, [apiUrl, token, cleanup, connectStream]);

  // -- Resize terminal -------------------------------------------------------

  const resizeTerminal = useCallback(async (cols: number, rows: number) => {
    const sid = sessionIdRef.current;
    if (!sid || cols <= 0 || rows <= 0) return;

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
  // without any awaiting between calls. To prevent N concurrent POSTs from
  // racing through the network to the sidecar, we serialize dispatch and
  // coalesce any keystrokes that arrive while a request is in flight.

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

      try {
        const res = await fetch(`${apiUrl}/terminals/${sid}/input`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ data: batch.data }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Input failed: ${res.status}`);
        }
        for (const w of batch.waiters) w.resolve();
      } catch (err) {
        console.error('Failed to send command', err);
        for (const w of batch.waiters) w.reject(err);
        // Continue the loop: if the failure was transient, subsequent
        // batches may succeed. Permanent failures (session gone, 4xx)
        // will re-surface on the next iteration via the same code path.
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
    const run = (): Promise<void> =>
      drainInputQueue().finally(() => {
        if (pendingBatchRef.current.data.length > 0) {
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
