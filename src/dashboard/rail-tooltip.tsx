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
  "rounded-md border border-[var(--md3-outline-variant)] bg-surface-container-highest shadow-[var(--shadow-dropdown),var(--edge-highlight)]"

export interface RailTooltipProps {
  /** Tooltip text shown to the right of the trigger. */
  label: string
  /** A second, quieter line under the label that may wrap, e.g. what a nav item is for. */
  description?: string
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
 *
 * `disabled` suppresses the tooltip but NOT the wrapper. Returning a fragment
 * instead changes the rendered element type, and React reconciles by type: the
 * trigger inside would be torn down and rebuilt every time the rail toggles
 * between icon-only and labeled. A rebuilt element replays its CSS entrance, so
 * the whole nav would re-stagger on a collapse that moved nothing off screen.
 * One element type, both states.
 */
export function RailTooltip({ label, description, children, disabled, className }: RailTooltipProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const tooltipRef = React.useRef<HTMLSpanElement>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)

  // Descriptions can wrap beyond a phone drawer's right edge. Measure the
  // actual floating surface and keep the whole explanation in the viewport.
  React.useLayoutEffect(() => {
    if (!description || !coords || !tooltipRef.current) return
    const { offsetWidth: width, offsetHeight: height } = tooltipRef.current
    const left = Math.max(8, Math.min(coords.left, window.innerWidth - width - 8))
    const top = Math.max(height / 2 + 8, Math.min(coords.top, window.innerHeight - height / 2 - 8))
    if (left !== coords.left || top !== coords.top) setCoords({ left, top })
  }, [coords, description])

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // A tooltip left open when the rail expands has nothing to anchor to, and a
  // pending open must die with it. Clearing `coords` alone is not enough: the
  // wrapper stays mounted across the toggle (that is the whole point of the
  // one-element-type rule above), so the unmount cleanup never runs and a timer
  // armed a moment before `disabled` went true still fires. It then writes
  // coordinates for a control that is no longer tooltipped — invisible while
  // `disabled` holds, and a tooltip that appears unbidden, at a stale position,
  // the moment `disabled` goes false again.
  React.useEffect(() => {
    if (!disabled) return
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setCoords(null)
  }, [disabled])

  const open = () => {
    if (disabled) return
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
      // `shrink-0` because the wrapper now stands between the rail's scrolling
      // flex column and a trigger that carries `shrink-0` itself; without it the
      // wrapper absorbs the squeeze the trigger refuses and the row overflows.
      className={cn("relative flex shrink-0", className)}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocusCapture={open}
      onBlurCapture={close}
    >
      {children}
      {!disabled && coords !== null && typeof document !== "undefined" &&
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
              ref={tooltipRef}
              role="tooltip"
              aria-hidden="true"
              className={cn(
                // Appears in place beside the trigger after the open delay, so
                // it scales up rather than travelling — @see .agent-pop-in.
                "agent-pop-in block px-2 py-1 text-xs font-medium text-popover-foreground",
                description ? "w-max max-w-[min(16rem,calc(100vw-1rem))]" : "whitespace-nowrap",
                RAIL_FLOATING_SURFACE,
              )}
            >
              <span className={description ? "block break-words" : "block whitespace-nowrap"}>{label}</span>
              {description ? <span className="mt-0.5 block font-normal leading-snug text-muted-foreground">{description}</span> : null}
            </span>
          </span>,
          document.body,
        )}
    </span>
  )
}
