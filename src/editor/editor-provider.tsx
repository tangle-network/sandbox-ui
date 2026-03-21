"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Y from "yjs";

/**
 * Connection state for the Hocuspocus provider.
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "synced";

/**
 * Collaborator information from awareness.
 */
export interface Collaborator {
  clientId: number;
  user: {
    name: string;
    color: string;
    userId?: string;
  };
}

/**
 * Editor context value exposed to children.
 */
export interface EditorContextValue {
  /** The Y.Doc instance for collaboration */
  doc: Y.Doc;
  /** The Hocuspocus provider instance */
  provider: HocuspocusProvider | null;
  /** Current connection state */
  connectionState: ConnectionState;
  /** List of active collaborators */
  collaborators: Collaborator[];
  /** Whether the document is synced with the server */
  isSynced: boolean;
  /** Connect to the collaboration server */
  connect: () => void;
  /** Disconnect from the collaboration server */
  disconnect: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

/**
 * User information for presence/awareness.
 */
export interface EditorUser {
  name: string;
  color?: string;
  userId?: string;
}

export interface EditorTokenRefreshResult {
  token: string;
  expiresAt?: number;
}

/**
 * Props for EditorProvider.
 */
export interface EditorProviderProps {
  /** WebSocket URL for the Hocuspocus server */
  websocketUrl: string;
  /** Document name (e.g., "doc:my-document") */
  documentName: string;
  /** JWT token for authentication */
  token: string;
  /** Unix timestamp (seconds) when the current token expires */
  tokenExpiresAt?: number;
  /** Current user information for awareness */
  user: EditorUser;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnect attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Callback when connection state changes */
  onConnectionChange?: (state: ConnectionState) => void;
  /** Callback when sync completes */
  onSync?: () => void;
  /** Callback on authentication error */
  onAuthError?: (error: Error) => void;
  /** Optional token refresh callback used before reconnect/auth retry */
  onRefreshToken?: () => Promise<EditorTokenRefreshResult | string>;
  /** Children components */
  children: ReactNode;
}

/**
 * Generate a random color for user presence.
 */
function generateUserColor(): string {
  const colors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#96CEB4", // Green
    "#FFEAA7", // Yellow
    "#DDA0DD", // Plum
    "#98D8C8", // Mint
    "#F7DC6F", // Gold
    "#BB8FCE", // Purple
    "#85C1E9", // Sky
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * EditorProvider wraps children with Hocuspocus collaboration context.
 * Manages WebSocket connection, Y.Doc, and awareness state.
 */
export function EditorProvider({
  websocketUrl,
  documentName,
  token,
  tokenExpiresAt,
  user,
  autoConnect = true,
  autoReconnect = true,
  maxReconnectAttempts = 5,
  onConnectionChange,
  onSync,
  onAuthError,
  onRefreshToken,
  children,
}: EditorProviderProps) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isSynced, setIsSynced] = useState(false);

  // Use refs to avoid recreating provider on every render
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const tokenRef = useRef(token);
  const tokenExpiryRef = useRef<number | undefined>(tokenExpiresAt);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  tokenRef.current = token;
  tokenExpiryRef.current = tokenExpiresAt;

  // Initialize Y.Doc once
  if (!docRef.current) {
    docRef.current = new Y.Doc();
  }
  const doc = docRef.current;

  // User color (generate once per session)
  const userColor = useMemo(
    () => user.color ?? generateUserColor(),
    [user.color],
  );

  // Update connection state and notify callback
  const updateConnectionState = useCallback(
    (state: ConnectionState) => {
      setConnectionState(state);
      onConnectionChange?.(state);
    },
    [onConnectionChange],
  );

  // Update collaborators from awareness
  const updateCollaborators = useCallback(
    (awareness: HocuspocusProvider["awareness"]) => {
      if (!awareness) return;

      const states = awareness.getStates();
      const collabs: Collaborator[] = [];

      states.forEach((state: Record<string, unknown>, clientId: number) => {
        // Skip our own client
        if (clientId === awareness.clientID) return;

        if (state.user) {
          collabs.push({
            clientId,
            user: state.user as Collaborator["user"],
          });
        }
      });

      setCollaborators(collabs);
    },
    [],
  );

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current != null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!onRefreshToken) {
      return null;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      const next = await onRefreshToken();
      const resolvedToken = typeof next === "string" ? next : next.token;
      const resolvedExpiry =
        typeof next === "string" ? undefined : next.expiresAt;

      tokenRef.current = resolvedToken;
      tokenExpiryRef.current = resolvedExpiry;
      return resolvedToken;
    })()
      .catch((error) => {
        onAuthError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [onAuthError, onRefreshToken]);

  const scheduleTokenRefresh = useCallback(() => {
    clearRefreshTimer();

    if (
      !tokenExpiryRef.current ||
      !onRefreshToken ||
      typeof window === "undefined"
    ) {
      return;
    }

    const refreshAtMs = tokenExpiryRef.current * 1000 - 60_000;
    const delay = refreshAtMs - Date.now();

    if (delay <= 0) {
      void refreshToken();
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      void refreshToken();
    }, delay);
  }, [clearRefreshTimer, onRefreshToken, refreshToken]);

  // Connect to the collaboration server
  const connect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.connect();
      return;
    }

    updateConnectionState("connecting");

    const provider = new HocuspocusProvider({
      url: websocketUrl,
      name: documentName,
      document: doc,
      token: async () => tokenRef.current,
      // @ts-expect-error -- connect is valid at runtime but missing from type defs
      connect: true,

      onConnect: () => {
        reconnectAttemptsRef.current = 0;
        updateConnectionState("connected");
        scheduleTokenRefresh();
      },

      onSynced: () => {
        setIsSynced(true);
        updateConnectionState("synced");
        onSync?.();
      },

      onDisconnect: () => {
        updateConnectionState("disconnected");
        setIsSynced(false);
        clearRefreshTimer();

        // Auto-reconnect logic
        if (
          autoReconnect &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            1000 * 2 ** reconnectAttemptsRef.current,
            30000,
          );
          setTimeout(() => {
            if (providerRef.current && !(providerRef.current as any).isConnected) {
              providerRef.current.connect();
            }
          }, delay);
        }
      },

      onAuthenticationFailed: ({ reason }: { reason?: string }) => {
        const error = new Error(reason ?? "Authentication failed");
        updateConnectionState("disconnected");
        clearRefreshTimer();

        if (onRefreshToken) {
          void refreshToken().then((nextToken) => {
            if (nextToken && providerRef.current) {
              providerRef.current.connect();
              return;
            }

            onAuthError?.(error);
          });
          return;
        }

        onAuthError?.(error);
      },

      onAwarenessUpdate: () => {
        updateCollaborators(provider.awareness);
      },
    });

    // Set local user awareness
    provider.awareness?.setLocalStateField("user", {
      name: user.name,
      color: userColor,
      userId: user.userId,
    });

    providerRef.current = provider;
  }, [
    websocketUrl,
    documentName,
    doc,
    user.name,
    user.userId,
    userColor,
    autoReconnect,
    maxReconnectAttempts,
    clearRefreshTimer,
    updateConnectionState,
    updateCollaborators,
    onSync,
    onAuthError,
    onRefreshToken,
    refreshToken,
    scheduleTokenRefresh,
  ]);

  // Disconnect from the collaboration server
  const disconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.disconnect();
      updateConnectionState("disconnected");
    }
  }, [updateConnectionState]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      // Cleanup on unmount
      clearRefreshTimer();
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };
  }, [autoConnect, clearRefreshTimer, connect]);

  // Context value
  const contextValue = useMemo<EditorContextValue>(
    () => ({
      doc,
      provider: providerRef.current,
      connectionState,
      collaborators,
      isSynced,
      connect,
      disconnect,
    }),
    [doc, connectionState, collaborators, isSynced, connect, disconnect],
  );

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

/**
 * Hook to access the editor context.
 * Must be used within an EditorProvider.
 */
export function useEditorContext(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return context;
}
