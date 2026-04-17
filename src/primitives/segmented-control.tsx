"use client"

import * as React from "react"
import { cn } from "../lib/utils"

/**
 * Visually lightweight segmented control for tab-like selection.
 *
 * Design rules baked into the default variant:
 *   - Only the SELECTED segment shows a surface colour + accent text.
 *   - Unselected segments have NO background — they're plain-text labels
 *     that darken on hover. This keeps the selected segment as the
 *     single visual anchor instead of the whole group competing with
 *     itself.
 *
 * Used by the Team page team-switcher and by the sandboxes scope filter
 * (`All | Personal | <team>`). Those two consumers previously rendered
 * bespoke button styles that highlighted EVERY segment — this primitive
 * was extracted specifically to fix that regression.
 */
export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: React.ReactNode
  /** Rendered right of the label, typically a count or status pill. */
  adornment?: React.ReactNode
}

export interface SegmentedControlProps<T extends string = string> {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  /**
   * Layout:
   *   - "row"   — horizontal pill bar (default, fits in a header region)
   *   - "tabs"  — horizontal with a bottom border so the selected pill
   *              reads as a classic tab (used on the Team page)
   */
  variant?: "row" | "tabs"
  className?: string
  "aria-label"?: string
}

export function SegmentedControl<T extends string = string>({
  value,
  onValueChange,
  options,
  variant = "row",
  className,
  ...rest
}: SegmentedControlProps<T>) {
  const tabRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map())

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (options.length === 0) return
    const idx = options.findIndex((o) => o.value === value)
    if (idx === -1) return
    let next: number | undefined
    if (e.key === "ArrowRight") next = (idx + 1) % options.length
    else if (e.key === "ArrowLeft") next = (idx - 1 + options.length) % options.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = options.length - 1
    if (next !== undefined) {
      e.preventDefault()
      onValueChange(options[next].value)
      tabRefs.current.get(options[next].value)?.focus()
    }
  }

  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex flex-wrap gap-1",
        variant === "row" &&
          "items-center rounded-lg border border-border bg-card p-1",
        variant === "tabs" &&
          "items-end border-b border-border pb-0",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) tabRefs.current.set(option.value, el)
              else tabRefs.current.delete(option.value)
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              if (!active) onValueChange(option.value)
            }}
            className={cn(
              "relative inline-flex items-center gap-2 whitespace-nowrap text-sm transition-colors",
              variant === "row" && "rounded-md px-3 py-1.5",
              variant === "tabs" && "rounded-none border-b-2 px-4 py-2",
              // Active styling is the ONLY styled state — unselected
              // segments stay transparent on purpose so they don't
              // compete visually with the selection.
              active
                ? variant === "row"
                  ? "bg-[var(--accent-surface)] text-[var(--accent-text)] font-semibold"
                  : "border-[var(--accent-text)] text-[var(--accent-text)] font-semibold"
                : variant === "row"
                  ? "border border-transparent text-muted-foreground hover:text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{option.label}</span>
            {option.adornment && (
              <span
                className={cn(
                  "text-xs",
                  active ? "text-[var(--accent-text)]/80" : "text-muted-foreground",
                )}
              >
                {option.adornment}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
