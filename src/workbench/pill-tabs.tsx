"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface PillTabItem<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
}

export interface PillTabsProps<T extends string> {
  items: ReadonlyArray<PillTabItem<T>>
  value: T
  onChange: (value: T) => void
  className?: string
  "aria-label"?: string
}

/**
 * Sliding-pill segmented control. Reimplemented from blueprint-agent's
 * framer-motion `PillTabs` with a measured CSS transform instead — no motion
 * dependency. A `ResizeObserver` re-measures on container resize and font
 * load so the indicator tracks the active tab exactly. Token-swapped onto the
 * sandbox-ui surface ladder.
 */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: PillTabsProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tabRefs = React.useRef(new Map<T, HTMLButtonElement>())
  const [indicator, setIndicator] = React.useState<{ left: number; width: number } | null>(null)

  const measure = React.useCallback(() => {
    const container = containerRef.current
    const active = tabRefs.current.get(value)
    if (!container || !active) return
    const c = container.getBoundingClientRect()
    const a = active.getBoundingClientRect()
    setIndicator({ left: a.left - c.left, width: a.width })
  }, [value])

  React.useLayoutEffect(() => {
    measure()
  }, [measure, items])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(container)
    // Re-measure after fonts settle (tab widths shift once the mono/sans
    // faces swap in), without depending on the FontFaceSet API existing.
    const raf = requestAnimationFrame(measure)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [measure])

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-full border border-[var(--md3-outline-variant)] bg-surface-container-low p-1",
        className,
      )}
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-surface-container-high shadow-[var(--shadow-card)] ring-1 ring-[var(--md3-outline-variant)] transition-[transform,width] duration-200 ease-out"
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width, left: 0 }}
        />
      )}
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(el) => {
              if (el) tabRefs.current.set(item.value, el)
              else tabRefs.current.delete(item.value)
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              selected
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.icon && <span className="flex h-3.5 w-3.5 items-center justify-center">{item.icon}</span>}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
