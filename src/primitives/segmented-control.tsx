"use client"

import * as React from "react"
import { cn } from "../lib/utils"

/**
 * Visually lightweight segmented control for single-value selection.
 *
 * Uses role="radiogroup" / role="radio" because this is a value-selector
 * with no associated panels — not a tab interface. Arrow keys navigate
 * between options (with wrapping), Home/End jump to first/last.
 *
 * Design rules baked into the default variant:
 *   - Only the SELECTED segment shows a surface colour + accent text.
 *   - Unselected segments have NO background — they're plain-text labels
 *     that darken on hover. This keeps the selected segment as the
 *     single visual anchor instead of the whole group competing with
 *     itself.
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
  const optionRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map())

  const hasMatch = options.some((o) => o.value === value)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (options.length === 0) return
    // When no option matches value, start navigation from the first option
    let idx = options.findIndex((o) => o.value === value)
    if (idx === -1) idx = 0
    let next: number | undefined
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + options.length) % options.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = options.length - 1
    if (next !== undefined) {
      e.preventDefault()
      if (options[next].value !== value) {
        onValueChange(options[next].value)
      }
      optionRefs.current.get(options[next].value)?.focus()
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex gap-1",
        variant === "row" &&
          "flex-wrap items-center rounded-lg border border-border bg-card p-1",
        variant === "tabs" &&
          "flex-nowrap items-end border-b border-border pb-0 overflow-x-auto",
        className,
      )}
    >
      {options.map((option, i) => {
        const active = option.value === value
        const focusable = active || (!hasMatch && i === 0)
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) optionRefs.current.set(option.value, el)
              else optionRefs.current.delete(option.value)
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={focusable ? 0 : -1}
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
