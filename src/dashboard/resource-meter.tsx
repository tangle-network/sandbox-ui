"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface ResourceMeterProps {
  label: string
  value: number
  max?: number
  unit?: string
  icon?: React.ReactNode
  className?: string
}

function getBarColor(percent: number): string {
  if (percent >= 90) return "bg-[var(--code-error)]"
  if (percent >= 70) return "bg-[var(--surface-warning-text)]"
  return "bg-primary"
}

export function ResourceMeter({ label, value, max = 100, unit, icon, className }: ResourceMeterProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const barColor = getBarColor(percent)

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex shrink-0 items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
        {icon}
        {label}
      </span>
      <div className="h-1.5 min-w-0 flex-1 bg-card rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">
        {unit ? `${value}${unit}/${max}${unit}` : `${Math.round(percent)}%`}
      </span>
    </div>
  )
}
