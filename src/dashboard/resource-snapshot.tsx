"use client"

import * as React from "react"
import { Skeleton } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { ResourceMeter } from "./resource-meter"

export interface ResourceSnapshotItem {
  /** Stable React key; falls back to `label` plus row index when omitted. */
  id?: string
  label: string
  /** Current value, in the same unit as `max`. */
  value: number
  /** Full-scale value. Omit to treat `value` as a 0-100 percent. */
  max?: number
  /** Unit suffix for the default `value{unit}/max{unit}` readout. */
  unit?: string
  /** Right-hand readout override (e.g. "1.2 GB / 4 GB"). */
  valueLabel?: string
  icon?: React.ReactNode
}

export interface ResourceSnapshotProps {
  title?: string
  /** Right-aligned header slot, e.g. a "View metrics" link. */
  action?: React.ReactNode
  items: ResourceSnapshotItem[]
  loading?: boolean
  /** When set, replaces the meters with an error line. */
  error?: string | null
  className?: string
}

/**
 * Compact at-a-glance resource panel: a stack of {@link ResourceMeter}
 * rows for an instantaneous CPU / memory / disk read. Time-series detail
 * belongs in a dedicated metrics view; this is the snapshot.
 */
export function ResourceSnapshot({
  title = "Resources",
  action,
  items,
  loading = false,
  error = null,
  className,
}: ResourceSnapshotProps) {
  const rowCount = items.length > 0 ? items.length : 3
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold text-foreground text-sm">
          {title}
        </h3>
        {action}
      </div>
      {error ? (
        <p className="text-[var(--surface-danger-text)] text-xs">{error}</p>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: rowCount }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <ResourceMeter
              key={item.id ?? `${item.label}-${idx}`}
              label={item.label}
              value={item.value}
              max={item.max}
              unit={item.unit}
              valueLabel={item.valueLabel}
              icon={item.icon}
            />
          ))}
        </div>
      )}
    </div>
  )
}
