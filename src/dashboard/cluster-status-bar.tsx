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
      <div className="glass-panel-heavy overflow-hidden rounded-full px-6 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-8 border-primary/20 shadow-sm backdrop-blur-2xl">
        
        <div className="flex items-center gap-6">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[var(--md3-primary)] [&_svg]:h-[18px] [&_svg]:w-[18px]">
                {item.icon}
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--md3-on-surface-variant)] uppercase tracking-wider font-bold">
                  {item.label}
                </span>
                <span className={cn("text-xs font-bold text-foreground", item.valueClass)}>
                  {item.value}
                </span>
              </div>
            </div>
          ))}
        </div>

        {latency && (
          <>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </div>
              <span className="text-xs font-mono text-green-400 font-bold">{latency}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
