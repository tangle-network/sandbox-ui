"use client"

import * as React from "react"
import { Skeleton } from "@tangle-network/ui/primitives"
import { timeAgo } from "@tangle-network/ui/utils"
import { cn } from "../lib/utils"

export interface ActivityItem {
  /** Stable key. */
  id: string
  icon?: React.ReactNode
  title: string
  detail?: string
  /** Wall-clock ms. Drives ordering and the relative timestamp. */
  timestamp?: number
}

export interface ActivityFeedProps {
  title?: string
  action?: React.ReactNode
  items: ActivityItem[]
  loading?: boolean
  /** Caps the rendered rows after sorting newest-first. Default 6. */
  maxItems?: number
  emptyLabel?: string
  className?: string
}

/**
 * Newest-first list of recent sandbox activity (commits, snapshots,
 * lifecycle events). Items are sorted by `timestamp` descending here so
 * callers can merge heterogeneous sources without pre-sorting.
 */
export function ActivityFeed({
  title = "Recent activity",
  action,
  items,
  loading = false,
  maxItems = 6,
  emptyLabel = "No recent activity",
  className,
}: ActivityFeedProps) {
  const sorted = React.useMemo(
    () =>
      [...items]
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, maxItems),
    [items, maxItems],
  )

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold text-foreground text-sm">
          {title}
        </h3>
        {action}
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              {item.icon && (
                <span className="mt-0.5 shrink-0 text-muted-foreground">
                  {item.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground text-sm">
                  {item.title}
                </p>
                {item.detail && (
                  <p className="truncate text-muted-foreground text-xs">
                    {item.detail}
                  </p>
                )}
              </div>
              {item.timestamp != null && (
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                  {timeAgo(item.timestamp)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
