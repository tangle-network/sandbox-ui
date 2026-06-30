import * as React from "react";

/**
 * Returns a ref; calls `onOutside` when a mousedown lands outside that element.
 * For self-contained popovers/menus that close on an outside click without a
 * portal-based primitive.
 */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}
