"use client";

import * as React from "react";

/**
 * SSE Event data structure
 */
export interface SSEEvent<T = unknown> {
  id?: string;
  event: string;
  data: T;
  timestamp: number;
}

/**
 * Connection state for SSE streams
 */
export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

/**
 * SSE stream options
 */
export interface UseSSEStreamOptions<T = unknown> {
  /** URL to connect to */
  url: string;
  /** Authorization header value */
  authToken?: string;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 5) */
  maxRetries?: number;
  /** Base delay between reconnects in ms (default: 1000) */
  reconnectDelay?: number;
  /** Event types to listen for (default: all) */
  eventTypes?: string[];
  /** Callback for each event */
  onEvent?: (event: SSEEvent<T>) => void;
  /** Callback on connection state change */
  onStateChange?: (state: ConnectionState) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Whether to start connected (default: true) */
  enabled?: boolean;
}

/**
 * SSE stream result
 */
export interface UseSSEStreamResult<T = unknown> {
  /** Current connection state */
  state: ConnectionState;
  /** All received events */
  events: SSEEvent<T>[];
  /** Most recent event */
  lastEvent: SSEEvent<T> | null;
  /** Error if any */
  error: Error | null;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Clear events buffer */
  clearEvents: () => void;
  /** Retry count */
  retryCount: number;
  /** Time since last event (ms) */
  timeSinceLastEvent: number;
}

/**
 * React hook for consuming SSE streams with automatic reconnection,
 * event buffering, and state management.
 *
 * @example
 * ```tsx
 * const { events, state, lastEvent } = useSSEStream({
 *   url: '/api/v1/tasks/123/stream',
 *   authToken: 'Bearer xxx',
 *   onEvent: (e) => console.log('Event:', e),
 * });
 *
 * return (
 *   <div>
 *     <p>Status: {state}</p>
 *     {events.map((e, i) => (
 *       <div key={i}>{e.event}: {JSON.stringify(e.data)}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useSSEStream<T = unknown>(
  options: UseSSEStreamOptions<T>,
): UseSSEStreamResult<T> {
  const {
    url,
    authToken,
    autoReconnect = true,
    maxRetries = 5,
    reconnectDelay = 1000,
    eventTypes,
    onEvent,
    onStateChange,
    onError,
    headers,
    enabled = true,
  } = options;

  const [state, setState] = React.useState<ConnectionState>("disconnected");
  const [events, setEvents] = React.useState<SSEEvent<T>[]>([]);
  const [lastEvent, setLastEvent] = React.useState<SSEEvent<T> | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [lastEventTime, setLastEventTime] = React.useState<number>(Date.now());
  const [timeSinceLastEvent, setTimeSinceLastEvent] = React.useState(0);

  const retryCountRef = React.useRef(0);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const reconnectTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lastEventIdRef = React.useRef<string | undefined>(undefined);

  // Update time since last event
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimeSinceLastEvent(Date.now() - lastEventTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastEventTime]);

  // Notify state changes
  React.useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const handleEvent = React.useCallback(
    (eventType: string, data: T, id?: string) => {
      const event: SSEEvent<T> = {
        id,
        event: eventType,
        data,
        timestamp: Date.now(),
      };

      if (id) {
        lastEventIdRef.current = id;
      }

      setLastEventTime(Date.now());
      setLastEvent(event);
      setEvents((prev) => {
        const next = [...prev, event];
        return next.length > 1000 ? next.slice(-1000) : next;
      });
      onEvent?.(event);
    },
    [onEvent],
  );

  const disconnect = React.useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState("disconnected");
  }, []);

  const connect = React.useCallback(() => {
    // Cleanup existing connection
    disconnect();

    if (!url || !enabled) {
      return;
    }

    setState("connecting");
    setError(null);

    // Build URL with Last-Event-ID if available
    const connectUrl = new URL(url, window.location.origin);
    if (lastEventIdRef.current) {
      connectUrl.searchParams.set("lastEventId", lastEventIdRef.current);
    }

    // Use fetch-based SSE for custom headers support
    if (authToken || headers) {
      abortControllerRef.current = new AbortController();

      const fetchHeaders: Record<string, string> = {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        ...headers,
      };

      if (authToken) {
        fetchHeaders.Authorization = authToken.startsWith("Bearer ")
          ? authToken
          : `Bearer ${authToken}`;
      }

      if (lastEventIdRef.current) {
        fetchHeaders["Last-Event-ID"] = lastEventIdRef.current;
      }

      fetch(connectUrl.toString(), {
        headers: fetchHeaders,
        signal: abortControllerRef.current.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          if (!response.body) {
            throw new Error("Response body is null");
          }

          setState("connected");
          retryCountRef.current = 0;

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            let currentEvent = "";
            let currentData = "";
            let currentId: string | undefined;

            for (const line of lines) {
              if (line.startsWith("event:")) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                currentData += (currentData ? "\n" : "") + line.slice(5).trim();
              } else if (line.startsWith("id:")) {
                currentId = line.slice(3).trim();
              } else if (line === "" && currentData) {
                // Empty line = end of event
                try {
                  const parsedData = JSON.parse(currentData) as T;
                  const eventType = currentEvent || "message";

                  if (!eventTypes || eventTypes.includes(eventType)) {
                    handleEvent(eventType, parsedData, currentId);
                  }
                } catch {
                  // Handle non-JSON data
                  if (
                    !eventTypes ||
                    eventTypes.includes(currentEvent || "message")
                  ) {
                    handleEvent(
                      currentEvent || "message",
                      currentData as T,
                      currentId,
                    );
                  }
                }

                currentEvent = "";
                currentData = "";
                currentId = undefined;
              }
            }
          }

          // Stream ended - reconnect if enabled
          if (autoReconnect && enabled) {
            setState("reconnecting");
            const delay = reconnectDelay * 2 ** retryCountRef.current;
            reconnectTimeoutRef.current = setTimeout(
              () => {
                retryCountRef.current += 1;
                connect();
              },
              Math.min(delay, 30000),
            );
          } else {
            setState("disconnected");
          }
        })
        .catch((err) => {
          if (err.name === "AbortError") {
            return; // Intentional disconnect
          }

          setError(err);
          onError?.(err);
          setState("error");

          // Reconnect on error
          if (autoReconnect && enabled && retryCountRef.current < maxRetries) {
            setState("reconnecting");
            const delay = reconnectDelay * 2 ** retryCountRef.current;
            reconnectTimeoutRef.current = setTimeout(
              () => {
                retryCountRef.current += 1;
                connect();
              },
              Math.min(delay, 30000),
            );
          }
        });
    } else {
      // Use native EventSource for simple cases
      const es = new EventSource(connectUrl.toString());
      eventSourceRef.current = es;

      es.onopen = () => {
        setState("connected");
        retryCountRef.current = 0;
      };

      es.onerror = () => {
        const err = new Error("EventSource connection error");
        setError(err);
        onError?.(err);

        if (autoReconnect && enabled && retryCountRef.current < maxRetries) {
          setState("reconnecting");
          es.close();
          const delay = reconnectDelay * 2 ** retryCountRef.current;
          reconnectTimeoutRef.current = setTimeout(
            () => {
              retryCountRef.current += 1;
              connect();
            },
            Math.min(delay, 30000),
          );
        } else {
          setState("error");
        }
      };

      // Listen for specific event types or default 'message'
      const types = eventTypes || ["message"];
      for (const type of types) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as T;
            handleEvent(type, data, e.lastEventId);
          } catch {
            handleEvent(type, e.data as T, e.lastEventId);
          }
        });
      }

      // Also listen for unnamed events
      if (!eventTypes) {
        es.onmessage = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as T;
            handleEvent("message", data, e.lastEventId);
          } catch {
            handleEvent("message", e.data as T, e.lastEventId);
          }
        };
      }
    }
  }, [
    url,
    authToken,
    headers,
    enabled,
    autoReconnect,
    maxRetries,
    reconnectDelay,
    eventTypes,
    handleEvent,
    onError,
    disconnect,
  ]);

  // Auto-connect on mount and url/enabled change
  React.useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => disconnect();
  }, [enabled, connect, disconnect]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearEvents = React.useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  return {
    state,
    events,
    lastEvent,
    error,
    connect,
    disconnect,
    clearEvents,
    retryCount: retryCountRef.current,
    timeSinceLastEvent,
  };
}

/**
 * Typed event types for common streaming scenarios
 */
export interface TaskStreamEvent {
  task_id: string;
  status?: string;
  progress?: number;
  message?: string;
  result?: unknown;
  error?: string;
}

export interface AgentStreamEvent {
  type:
    | "message.updated"
    | "tool_call"
    | "tool_result"
    | "llm_response"
    | "error"
    | "session.idle"
    | "execution.started"
    | "execution.result";
  data: unknown;
  timestamp?: number;
}

export interface TerminalStreamEvent {
  type: "output" | "input" | "error" | "exit";
  data: string;
  timestamp: number;
}

export interface AutomationStreamEvent {
  automation_id: string;
  event_id?: string;
  status?: string;
  variant_id?: string;
  output?: string;
  action_result?: unknown;
  error?: string;
}

export interface BotStreamEvent {
  bot_id: string;
  type: "balance" | "trade" | "decision" | "log" | "error";
  data: unknown;
  timestamp: number;
}
