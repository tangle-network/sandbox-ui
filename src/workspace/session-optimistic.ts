import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionSidebarItem } from "./session-sidebar";

/**
 * Optimistic session/thread list: reflect a just-created / renamed / deleted
 * item in the sidebar INSTANTLY, before the server loader round-trips.
 *
 * The shell loader is the source of truth and reconciles in the background
 * (typically the app calls `useRevalidator().revalidate()` after its mutation
 * fetch settles). Until that lands, a local mirror of the loader items carries
 * the optimistic edit so a delete / rename / new-thread does not feel broken
 * for the duration of a D1 round-trip.
 *
 * Two ways to drive it, usable together:
 *   1. A window `CustomEvent` (default name {@link SESSION_CREATED_EVENT}) — the
 *      surface that creates a thread (often a different route from the sidebar's
 *      route) dispatches it; the sidebar prepends the item with no prop wiring.
 *   2. The imperative {@link SessionOptimisticController} returned here — the
 *      sidebar's own action handlers (rename / delete / pin) call it directly.
 */

/** Default window-event name for "a session/thread was just created". */
export const SESSION_CREATED_EVENT = "sandbox-thread-created";

/**
 * Payload of a {@link SESSION_CREATED_EVENT}. Only `id` + `title` are required;
 * everything else mirrors {@link SessionSidebarItem}. `updatedAt` defaults to
 * now so the new item sorts to the top.
 */
export interface SessionCreatedDetail
  extends Partial<Omit<SessionSidebarItem, "id" | "title">> {
  id: string;
  title: string;
}

/** Dispatch the shared "session created" event so any mounted sidebar updates. */
export function dispatchSessionCreated(
  detail: SessionCreatedDetail,
  eventName: string = SESSION_CREATED_EVENT,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/** Imperative handle for driving optimistic edits from a mutation handler. */
export interface SessionOptimisticController {
  /** Prepend (or move to top) an item — call before the create fetch settles. */
  add: (item: SessionCreatedDetail) => void;
  /** Patch an existing item in place — e.g. a rename or category change. */
  update: (id: string, patch: Partial<SessionSidebarItem>) => void;
  /** Drop an item — call before the delete fetch settles. */
  remove: (id: string) => void;
  /** Discard all optimistic edits and snap back to the loader items. */
  reset: () => void;
}

export interface UseOptimisticSessionItemsOptions {
  /**
   * Listen for the shared window create-event and prepend its item. Set `false`
   * to drive optimistic state purely through the imperative controller.
   * Defaults to `true`.
   */
  listenForCreate?: boolean;
  /** Override the window event name to listen for. */
  eventName?: string;
}

function toItem(detail: SessionCreatedDetail): SessionSidebarItem {
  return { updatedAt: new Date(), ...detail };
}

/**
 * Mirror `items` with optimistic add/update/remove on top. The mirror re-syncs
 * whenever `items` changes (the loader is authoritative), so an optimistic edit
 * is naturally superseded once the server result arrives.
 */
export function useOptimisticSessionItems(
  items: SessionSidebarItem[],
  options: UseOptimisticSessionItemsOptions = {},
): { items: SessionSidebarItem[]; controller: SessionOptimisticController } {
  const { listenForCreate = true, eventName = SESSION_CREATED_EVENT } = options;
  const [optimisticItems, setOptimisticItems] = useState(items);
  // Loader items are authoritative: re-sync the mirror when they change, which
  // also reconciles away any optimistic edit the server has now confirmed.
  useEffect(() => {
    setOptimisticItems(items);
  }, [items]);

  const add = useCallback((detail: SessionCreatedDetail) => {
    const next = toItem(detail);
    setOptimisticItems((prev) => [next, ...prev.filter((item) => item.id !== next.id)]);
  }, []);
  const update = useCallback((id: string, patch: Partial<SessionSidebarItem>) => {
    setOptimisticItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);
  const remove = useCallback((id: string) => {
    setOptimisticItems((prev) => prev.filter((item) => item.id !== id));
  }, []);
  const reset = useCallback(() => setOptimisticItems(items), [items]);

  // Keep `add` reachable from the event listener without re-subscribing on every
  // render (add is stable, but the listener closes over it via a ref to be safe).
  const addRef = useRef(add);
  addRef.current = add;
  useEffect(() => {
    if (!listenForCreate || typeof window === "undefined") return;
    function onCreated(event: Event) {
      const detail = (event as CustomEvent).detail as SessionCreatedDetail | undefined;
      if (!detail?.id || !detail.title) return;
      addRef.current(detail);
    }
    window.addEventListener(eventName, onCreated);
    return () => window.removeEventListener(eventName, onCreated);
  }, [listenForCreate, eventName]);

  return {
    items: optimisticItems,
    controller: { add, update, remove, reset },
  };
}
