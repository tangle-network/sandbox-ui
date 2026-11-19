import { useCallback, useState } from 'react';

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

interface SessionStatus {
  sessionId: string;
  connection: 'disconnected' | 'connected' | 'reconnecting';
  isStreaming: boolean;
  error: string | null;
  errorCode: string | null;
}

function initialStatus(sessionId: string): SessionStatus {
  return { sessionId, connection: 'disconnected', isStreaming: false, error: null, errorCode: null };
}

export function errorStatus(err: unknown, fallback: string) {
  return { error: err instanceof Error ? err.message : fallback, errorCode: err instanceof SessionStreamError ? err.code : null };
}

export function useSessionStatus(sessionId: string) {
  const [status, setStatus] = useState(() => initialStatus(sessionId));
  if (status.sessionId !== sessionId) setStatus(initialStatus(sessionId));
  const updateStatus = useCallback((patch: Partial<Omit<SessionStatus, 'sessionId'>>) => {
    setStatus(current => current.sessionId === sessionId ? { ...current, ...patch } : current);
  }, [sessionId]);
  return [status, updateStatus] as const;
}
