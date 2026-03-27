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
  /** Tear down and reconnect. */
  reconnect: () => void;
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
  onDataRef.current = onData;
  const connectStreamRef = useRef<((sessionId: string) => Promise<void>) | null>(null);

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
    setIsConnected(false);
  }, [apiUrl, token, abortStream]);

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
        throw new Error(`SSE stream failed: ${streamRes.status}`);
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
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Stream connection failed';
        setError(message);
        setIsConnected(false);

        // Don't retry on client errors (4xx) — they won't resolve on retry
        const is4xx = /\b4\d{2}\b/.test(message);
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

  // -- Send command ----------------------------------------------------------

  const sendCommand = useCallback(async (command: string) => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    const res = await fetch(`${apiUrl}/terminals/${sid}/input`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ data: command }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Input failed: ${res.status}`);
    }
  }, [apiUrl, token]);

  // -- Lifecycle -------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  return { isConnected, error, sendCommand, reconnect: connect };
}
