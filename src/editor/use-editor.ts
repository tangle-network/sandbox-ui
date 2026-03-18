"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useCallback, useEffect, useState } from "react";
import { type Collaborator, useEditorContext } from "./editor-provider";

/**
 * Hook to get the current connection state and helpers.
 */
export function useEditorConnection() {
  const { connectionState, isSynced, connect, disconnect } = useEditorContext();

  const isConnected =
    connectionState === "connected" || connectionState === "synced";
  const isConnecting = connectionState === "connecting";
  const isDisconnected = connectionState === "disconnected";

  return {
    /** Current connection state string */
    state: connectionState,
    /** Whether connected to the server (connected or synced) */
    isConnected,
    /** Whether currently attempting to connect */
    isConnecting,
    /** Whether disconnected from the server */
    isDisconnected,
    /** Whether the document is synced with the server */
    isSynced,
    /** Connect to the collaboration server */
    connect,
    /** Disconnect from the collaboration server */
    disconnect,
  };
}

/**
 * Hook to get the list of active collaborators.
 */
export function useCollaborators() {
  const { collaborators } = useEditorContext();

  const count = collaborators.length;
  const hasOthers = count > 0;

  return {
    /** List of active collaborators (excluding self) */
    collaborators,
    /** Number of other collaborators */
    count,
    /** Whether there are other collaborators present */
    hasOthers,
  };
}

/**
 * Hook to track a specific collaborator's presence.
 */
export function useCollaboratorPresence(userId: string): Collaborator | null {
  const { collaborators } = useEditorContext();

  return collaborators.find((c) => c.user.userId === userId) ?? null;
}

/**
 * Hook to sync local state with the Y.Doc.
 * Useful for persisting editor metadata.
 */
export function useYjsState<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const { doc } = useEditorContext();
  const [value, setLocalValue] = useState<T>(initialValue);

  // Get or create the metadata map
  const metaMap = doc.getMap<T>("metadata");

  // Sync from Y.Map on mount and changes
  useEffect(() => {
    const updateValue = () => {
      const stored = metaMap.get(key);
      if (stored !== undefined) {
        setLocalValue(stored);
      }
    };

    updateValue();
    metaMap.observe(updateValue);

    return () => {
      metaMap.unobserve(updateValue);
    };
  }, [metaMap, key]);

  // Set value in Y.Map
  const setValue = useCallback(
    (newValue: T) => {
      doc.transact(() => {
        metaMap.set(key, newValue);
      });
    },
    [doc, metaMap, key],
  );

  return [value, setValue];
}

/**
 * Hook to track document changes.
 * Returns true if there are unsaved changes since the last save.
 */
export function useDocumentChanges(onSave?: () => Promise<void>) {
  const { doc } = useEditorContext();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Track changes
  useEffect(() => {
    const handleUpdate = () => {
      setIsDirty(true);
    };

    doc.on("update", handleUpdate);

    return () => {
      doc.off("update", handleUpdate);
    };
  }, [doc]);

  // Save function
  const save = useCallback(async () => {
    if (!onSave || isSaving) return;

    setIsSaving(true);
    try {
      await onSave();
      setIsDirty(false);
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }, [onSave, isSaving]);

  return {
    /** Whether there are unsaved changes */
    isDirty,
    /** Whether save is in progress */
    isSaving,
    /** When the document was last saved */
    lastSaved,
    /** Save the document */
    save,
  };
}

/**
 * Hook to get awareness state for presence features.
 * Provides lower-level access to the Hocuspocus awareness.
 */
export function useAwareness(): {
  localState: Record<string, unknown>;
  setLocalState: (state: Record<string, unknown>) => void;
  setLocalStateField: (field: string, value: unknown) => void;
  awareness: HocuspocusProvider["awareness"] | undefined;
} {
  const { provider } = useEditorContext();
  const [localState, setLocalStateValue] = useState<Record<string, unknown>>(
    {},
  );

  const awareness = provider?.awareness;

  // Sync local state
  useEffect(() => {
    if (!awareness) return;

    const updateState = () => {
      setLocalStateValue(awareness.getLocalState() ?? {});
    };

    updateState();
    awareness.on("change", updateState);

    return () => {
      awareness.off("change", updateState);
    };
  }, [awareness]);

  // Set local state
  const setLocalState = useCallback(
    (state: Record<string, unknown>) => {
      if (!awareness) return;

      // Merge with existing state
      const current = awareness.getLocalState() ?? {};
      awareness.setLocalState({ ...current, ...state });
    },
    [awareness],
  );

  // Set a single field
  const setLocalStateField = useCallback(
    (field: string, value: unknown) => {
      if (!awareness) return;
      awareness.setLocalStateField(field, value);
    },
    [awareness],
  );

  return {
    /** Current local awareness state */
    localState,
    /** Set the entire local state (merges with existing) */
    setLocalState,
    /** Set a single field in the local state */
    setLocalStateField,
    /** The raw awareness instance */
    awareness,
  };
}
