"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

interface AnchoredPopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Element the popover positions against (usually the trigger's wrapper). */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Side the popover opens toward, relative to the anchor. */
  side: "top" | "bottom";
  children: React.ReactNode;
  className?: string;
}

/**
 * Body-portaled popover for the self-contained (non-Radix) pickers. Composer
 * control strips scroll horizontally and sit under overlapping siblings, so an
 * inline `position:absolute` panel gets clipped by the strip's overflow and
 * loses hit-testing to later stacking contexts — portaling to `document.body`
 * with viewport-fixed coordinates sidesteps both. Position tracks the anchor
 * on scroll/resize while open; callers keep ownership of open state, outside
 * clicks (pass the returned node to `useClickOutside` extras), and contents.
 */
export const AnchoredPopover = React.forwardRef<HTMLDivElement, AnchoredPopoverProps>(
  function AnchoredPopover({ anchorRef, side, children, className, style, ...rest }, forwardedRef) {
    const innerRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };
    const [position, setPosition] = React.useState<React.CSSProperties | null>(null);

    const place = React.useCallback(() => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = innerRef.current?.offsetWidth ?? 0;
      const margin = 8;
      const left = Math.max(
        margin,
        Math.min(rect.left, window.innerWidth - width - margin),
      );
      setPosition(
        side === "top"
          ? { left, bottom: window.innerHeight - rect.top + margin }
          : { left, top: rect.bottom + margin },
      );
    }, [anchorRef, side]);

    React.useLayoutEffect(() => {
      place();
      window.addEventListener("resize", place);
      // Capture-phase so scrolls inside nested containers reposition too.
      window.addEventListener("scroll", place, true);
      return () => {
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
      };
    }, [place]);

    return createPortal(
      <div
        {...rest}
        ref={setRefs}
        className={cn("fixed z-50", className)}
        // pointerEvents inline (not a class): an open Radix layer disables
        // pointer events on document.body via inline style, and this panel
        // must stay interactive when a picker inside such a layer (e.g. the
        // collapsed controls panel) opens it.
        style={{
          ...style,
          pointerEvents: "auto",
          ...(position ?? { visibility: "hidden", left: 0, top: 0 }),
        }}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
