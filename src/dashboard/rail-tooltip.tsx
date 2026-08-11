"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "../lib/utils"

/**
 * Shared surface treatment for rail popovers (this tooltip and the rail
 * flyouts): a rounded, bordered, shadowed card on the highest container
 * surface. Centralized so the floating-UI styles can't drift apart.
 */
export const RAIL_FLOATING_SURFACE =
  "rounded-md border border-[var(--md3-outline-variant)] bg-surface-container-highest shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]"

export interface RailTooltipProps {
  /** Tooltip text shown to the right of the trigger. */
  label: string
  /** The trigger element (icon button / link). */
  children: React.ReactNode
  /** Disable the tooltip (e.g. when the rail is expanded and the label is inline). */
  disabled?: boolean
  className?: string
}

/**
 * Quiet styled tooltip for the icon-only rail, rendered in a portal anchored to
 * the RIGHT of the trigger. The portal is essential: the rail's nav is a
 * vertical scroll container (`overflow-y-auto`), which the CSS spec forces to
 * also clip horizontally — an in-flow tooltip would be cut off at the rail's
 * edge. Positioned via `getBoundingClientRect` on hover/focus, shown after a
 * short delay, and `pointer-events-none` so it never interferes with the
 * trigger. Hidden from the a11y tree (`aria-hidden`) since the trigger already
 * carries an accessible name.
 */
export function RailTooltip({ label, children, disabled, className }: RailTooltipProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  if (disabled) return <>{children}</>

  const open = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setCoords({ top: r.top + r.height / 2, left: r.right + 8 })
    }, 250)
  }
  const close = () => {
    if (timer.current) clearTimeout(timer.current)
    setCoords(null)
  }

  return (
    <span
      ref={ref}
      className={cn("relative flex", className)}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocusCapture={open}
      onBlurCapture={close}
    >
      {children}
      {coords !== null && typeof document !== "undefined" &&
        createPortal(
          // Two elements, because the centering transform and the entrance
          // transform cannot share one: `.agent-pop-in` fills forwards to
          // `transform: none`, which would eat the `translateY(-50%)` and leave
          // every tooltip half a line low. The outer span owns the position, the
          // inner one owns the motion.
          <span
            style={{ position: "fixed", top: coords.top, left: coords.left, transform: "translateY(-50%)" }}
            className="pointer-events-none z-[70]"
          >
            <span
              role="tooltip"
              aria-hidden="true"
              className={cn(
                // Appears in place beside the trigger after the open delay, so
                // it scales up rather than travelling — @see .agent-pop-in.
                "agent-pop-in block whitespace-nowrap px-2 py-1 text-xs font-medium text-popover-foreground",
                RAIL_FLOATING_SURFACE,
              )}
            >
              {label}
            </span>
          </span>,
          document.body,
        )}
    </span>
  )
}
