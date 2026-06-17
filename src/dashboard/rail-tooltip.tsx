"use client"

import * as React from "react"
import { cn } from "../lib/utils"

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
 * Quiet, instant-ish styled tooltip for the icon-only rail. CSS-only (no
 * portal, no extra deps): the trigger wraps in a `group` and the label is an
 * absolutely-positioned sibling to the RIGHT, revealed on `group-hover` /
 * `group-focus-within` after a short delay. Matches the `--popover` / border
 * tokens so it reads as Tangle Quiet chrome rather than a native `title`.
 *
 * Replaces reliance on the native `title` attribute for the collapsed rail
 * (no ~1.5s delay, themeable, keyboard-focus reachable). Hidden via
 * `aria-hidden` since the trigger already carries an accessible name.
 */
export function RailTooltip({ label, children, disabled, className }: RailTooltipProps) {
  if (disabled) return <>{children}</>
  return (
    <span className={cn("group/tip relative flex", className)}>
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 translate-x-1 whitespace-nowrap",
          "rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground",
          "opacity-0 shadow-[var(--shadow-dropdown)] transition-[opacity,transform] duration-150 ease-out",
          "group-hover/tip:translate-x-0 group-hover/tip:opacity-100 group-hover/tip:delay-300",
          "group-focus-within/tip:translate-x-0 group-focus-within/tip:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  )
}
