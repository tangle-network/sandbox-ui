"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface ClusterStatusItem {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
  valueClass?: string
}

export interface ClusterStatusBarProps {
  items: ClusterStatusItem[]
  latency?: string
  className?: string
}

export function ClusterStatusBar({ items, latency, className }: ClusterStatusBarProps) {
  if (!items?.length) return null;

  return (
    <div className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-max max-w-[90vw] animate-in slide-in-from-bottom flex justify-center", className)}>
      <div className="flex items-center gap-4 overflow-x-auto rounded-full border border-[var(--md3-outline-variant)] bg-surface-container px-5 py-2.5 shadow-sm">
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span aria-hidden className="h-5 w-px shrink-0 bg-border" />}
            <div className="flex shrink-0 items-center gap-2">
              {item.icon ? (
                <span className="flex shrink-0 items-center text-[var(--md3-primary)] [&_svg]:h-[18px] [&_svg]:w-[18px]">
                  {item.icon}
                </span>
              ) : null}
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--md3-on-surface-variant)]">
                  {item.label}
                </span>
                <span className={cn("text-sm font-bold tabular-nums text-foreground", item.valueClass)}>
                  {item.value}
                </span>
              </div>
            </div>
          </React.Fragment>
        ))}

        {latency && (
          <>
            <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
            <div className="flex shrink-0 items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                {/* The ping is what says the latency figure beside it is being
                    refreshed rather than frozen at its last value. */}
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" data-motion="essential" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="font-mono text-xs font-bold text-green-400">{latency}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
