"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface ClusterStatusItem {
  icon?: React.ReactNode
  label: string
  value: string
  valueClass?: string
}

export interface ClusterStatusBarProps {
  items: ClusterStatusItem[]
  latency?: string
  className?: string
}

export function ClusterStatusBar({ items, latency, className }: ClusterStatusBarProps) {
  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 lg:left-64 right-0 h-9 bg-[var(--depth-1)] border-t border-[var(--border-subtle)] flex items-center justify-between px-6 z-30",
        className,
      )}
    >
      <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {item.icon && (
              <span className="text-[var(--text-muted)] [&_svg]:h-3 [&_svg]:w-3">{item.icon}</span>
            )}
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {item.label}:{" "}
              <span className={cn("text-[var(--text-secondary)]", item.valueClass)}>{item.value}</span>
            </span>
          </div>
        ))}
      </div>
      {latency && (
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Latency:{" "}
            <span className="text-[var(--text-secondary)]">{latency}</span>
          </span>
          <div className="flex gap-0.5 h-3 items-end">
            <div className="w-0.5 h-1 bg-[var(--brand-cool)]" />
            <div className="w-0.5 h-2 bg-[var(--brand-cool)]" />
            <div className="w-0.5 h-1.5 bg-[var(--brand-cool)]" />
            <div className="w-0.5 h-3 bg-[var(--brand-cool)]" />
            <div className="w-0.5 h-2.5 bg-[var(--brand-cool)]" />
          </div>
        </div>
      )}
    </footer>
  )
}
