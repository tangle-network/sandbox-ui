"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface ClusterStatusItem {
  icon: string
  label: string
  value: string
  valueClass?: string
}

export interface ClusterStatusBarProps {
  items: ClusterStatusItem[]
  latency?: string
  className?: string
}

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  )
}

export function ClusterStatusBar({ items, latency, className }: ClusterStatusBarProps) {
  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 lg:left-64 right-0 h-10 bg-surface-container-highest/80 backdrop-blur-md border-t border-outline-variant/5 flex items-center justify-between px-6 z-30",
        className,
      )}
    >
      <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <MaterialIcon name={item.icon} className="text-[14px] text-md3-primary" />
            <span className="text-[10px] font-mono text-on-surface-variant">
              {item.label}: <span className={cn("text-white", item.valueClass)}>{item.value}</span>
            </span>
          </div>
        ))}
      </div>
      {latency && (
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] font-mono text-on-surface-variant">
            System Latency: <span className="text-white">{latency}</span>
          </span>
          <div className="flex gap-0.5 h-3 items-end">
            <div className="w-0.5 h-1 bg-md3-primary" />
            <div className="w-0.5 h-2 bg-md3-primary" />
            <div className="w-0.5 h-1.5 bg-md3-primary" />
            <div className="w-0.5 h-3 bg-md3-primary" />
            <div className="w-0.5 h-2.5 bg-md3-primary" />
          </div>
        </div>
      )}
    </footer>
  )
}
