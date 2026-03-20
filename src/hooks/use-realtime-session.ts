import { createElement, useEffect, useMemo, useRef, useState } from "react";
import type { SdkSessionEvent } from "./use-sdk-session";
import {
  bumpActiveSessionActivity,
  registerActiveSession,
  setActiveSessionAttention,
  setActiveSessionConnection,
  setActiveSessionError,
  setActiveSessionRunning,
  setForegroundActiveSession,
  unregisterActiveSession,
  updateActiveSessionMeta,
  type ActiveSessionConnectionState,
  type ActiveSessionTransportMode,
  type RegisterActiveSessionOptions,
} from "../stores/active-sessions-store";

export interface RealtimeSessionOptions extends RegisterActiveSessionOptions {
  connectUrl?: string | null;
  enabled?: boolean;
  foreground?: boolean;
  keepRegistered?: boolean;
  reconnect?: boolean;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
  transportMode?: ActiveSessionTransportMode;
  onEvent?: (event: SdkSessionEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export interface RealtimeSessionState {
  connectionState: ActiveSessionConnectionState;
  lastError: string | null;
  reconnectAttempts: number;
  isConnected: boolean;
}

export interface RealtimeSessionTarget extends RealtimeSessionOptions {
  key?: string;
}

export interface RealtimeSessionRegistryProps {
  sessions: RealtimeSessionTarget[];
}

function parseEvent(message: string): SdkSessionEvent | null {
  try {
    const parsed = JSON.parse(message) as SdkSessionEvent;
    return typeof parsed?.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function eventTimestamp(event: SdkSessionEvent): number | null {
  const rootTimestamp = (event as { timestamp?: unknown }).timestamp;
  if (typeof rootTimestamp === "number" && Number.isFinite(rootTimestamp)) {
    return rootTimestamp;
  }

  const raw = event.data?.timestamp ?? event.data?.ts ?? event.data?.time ?? event.data?.eventAt;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function resolveErrorMessage(event: SdkSessionEvent): string | null {
  const message = event.data?.message;
  return typeof message === "string" && message.length > 0 ? message : null;
}

function updateStoreFromEvent(sessionId: string, event: SdkSessionEvent): void {
  const lastEventAt = eventTimestamp(event) ?? Date.now();
  bumpActiveSessionActivity(sessionId, { lastEventAt });

  if (event.type === "session.run.started") {
    setActiveSessionRunning(sessionId, true, { lastEventAt });
    return;
  }

  if (event.type === "session.run.completed" || event.type === "done" || event.type === "result") {
    setActiveSessionRunning(sessionId, false, { lastEventAt });
    return;
  }

  if (event.type === "session.attention") {
    setActiveSessionAttention(sessionId, true, { lastEventAt });
    return;
  }

  if (event.type === "error" || event.type === "session.run.failed") {
    setActiveSessionError(sessionId, resolveErrorMessage(event) ?? "Session error");
    return;
  }
}

export function useRealtimeSession({
  sessionId,
  projectId = null,
  projectLabel,
  title,
  href,
  metadata,
  connectUrl,
  enabled = true,
  foreground = true,
  keepRegistered = true,
  reconnect = true,
  reconnectIntervalMs = 1500,
  maxReconnectAttempts = Infinity,
  transportMode = "websocket",
  onEvent,
  onOpen,
  onClose,
  onError,
}: RealtimeSessionOptions): RealtimeSessionState {
  const [connectionState, setConnectionState] = useState<ActiveSessionConnectionState>("disconnected");
  const [lastError, setLastError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);

  const registration = useMemo<RegisterActiveSessionOptions>(
    () => ({
      sessionId,
      projectId,
      projectLabel,
      title,
      href,
      metadata,
    }),
    [href, metadata, projectId, projectLabel, sessionId, title],
  );

  useEffect(() => {
    if (!sessionId || !keepRegistered) return undefined;
    registerActiveSession(registration);
    return () => {
      unregisterActiveSession(sessionId);
    };
  }, [keepRegistered, registration, sessionId]);

  useEffect(() => {
    if (!sessionId || !keepRegistered) return;
    updateActiveSessionMeta(sessionId, {
      projectId,
      projectLabel,
      title,
      href,
      metadata,
    });
  }, [href, keepRegistered, metadata, projectId, projectLabel, sessionId, title]);

  useEffect(() => {
    if (!sessionId || !foreground) return undefined;
    setForegroundActiveSession(sessionId);
    return () => {
      setForegroundActiveSession(null);
    };
  }, [foreground, sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId || !connectUrl || typeof window === "undefined") {
      setConnectionState("disconnected");
      if (sessionId) {
        setActiveSessionConnection(sessionId, {
          connectionState: "disconnected",
          reconnectState: "idle",
          transportMode,
        });
      }
      return undefined;
    }

    shouldReconnectRef.current = true;

    const clearReconnectTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const connect = () => {
      clearReconnectTimer();
      setConnectionState(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");
      setActiveSessionConnection(sessionId, {
        connectionState: reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting",
        reconnectState: reconnectAttemptsRef.current > 0 ? "reconnecting" : "idle",
        transportMode,
        lastError: null,
      });

      const socket = new window.WebSocket(connectUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setLastError(null);
        setConnectionState("connected");
        registerActiveSession(registration);
        setActiveSessionConnection(sessionId, {
          connectionState: "connected",
          reconnectState: "idle",
          transportMode,
          lastError: null,
          lastEventAt: Date.now(),
        });
        onOpen?.();
      };

      socket.onmessage = (message) => {
        const event = parseEvent(message.data);
        if (!event) return;
        registerActiveSession(registration);
        updateStoreFromEvent(sessionId, event);
        onEvent?.(event);
      };

      socket.onerror = () => {
        const nextError = "Realtime session connection error";
        setLastError(nextError);
        setConnectionState("error");
        setActiveSessionConnection(sessionId, {
          connectionState: "error",
          reconnectState: reconnect ? "reconnecting" : "failed",
          transportMode,
          lastError: nextError,
        });
        onError?.(new Error(nextError));
      };

      socket.onclose = () => {
        socketRef.current = null;
        onClose?.();

        if (!shouldReconnectRef.current || !reconnect) {
          setConnectionState("disconnected");
          setActiveSessionConnection(sessionId, {
            connectionState: "disconnected",
            reconnectState: "idle",
            transportMode,
          });
          return;
        }

        reconnectAttemptsRef.current += 1;
        setReconnectAttempts(reconnectAttemptsRef.current);

        if (reconnectAttemptsRef.current > maxReconnectAttempts) {
          setConnectionState("error");
          setActiveSessionConnection(sessionId, {
            connectionState: "error",
            reconnectState: "failed",
            transportMode,
            lastError: "Unable to reconnect to realtime session",
          });
          return;
        }

        setConnectionState("reconnecting");
        timerRef.current = window.setTimeout(connect, reconnectIntervalMs);
      };
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close();
      }
    };
  }, [
    connectUrl,
    enabled,
    maxReconnectAttempts,
    onClose,
    onError,
    onEvent,
    onOpen,
    reconnect,
    reconnectIntervalMs,
    registration,
    sessionId,
    transportMode,
  ]);

  return {
    connectionState,
    lastError,
    reconnectAttempts,
    isConnected: connectionState === "connected",
  };
}

function RealtimeSessionRegistryItem(props: RealtimeSessionTarget) {
  useRealtimeSession({
    ...props,
    foreground: props.foreground ?? false,
  });
  return null;
}

export function RealtimeSessionRegistry({ sessions }: RealtimeSessionRegistryProps) {
  return sessions.map((session) =>
    createElement(RealtimeSessionRegistryItem, {
      key: session.key ?? session.sessionId,
      ...session,
    }),
  );
}
