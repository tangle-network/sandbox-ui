import * as React from "react";

/**
 * Returns a ref; calls `onOutside` when a mousedown lands outside that element
 * and outside every element in `extras`. For self-contained popovers/menus
 * that close on an outside click; `extras` covers body-portaled panels, whose
 * DOM nodes are not descendants of the returned ref.
 */
export function useClickOutside<T extends HTMLElement>(
  onOutside: () => void,
  extras?: ReadonlyArray<React.RefObject<HTMLElement | null>>,
) {
  const ref = React.useRef<T | null>(null);
  const extrasRef = React.useRef(extras);
  extrasRef.current = extras;
  React.useEffect(() => {
    function handler(event: MouseEvent) {
      const target = event.target as Node;
      if (!ref.current || ref.current.contains(target)) return;
      if (extrasRef.current?.some((extra) => extra.current?.contains(target))) return;
      onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}
