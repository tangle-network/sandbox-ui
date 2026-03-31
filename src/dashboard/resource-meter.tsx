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
  return "bg-[var(--brand-cool)]"
}

export function ResourceMeter({ label, value, max = 100, unit, icon, className }: ResourceMeterProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const barColor = getBarColor(percent)

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wide">
        <span className="flex items-center gap-1 text-[var(--text-secondary)]">
          {icon}
          {label}
        </span>
        <span className="tabular-nums">
          {unit ? `${value}${unit} / ${max}${unit}` : `${Math.round(percent)}%`}
        </span>
      </div>
      <div className="h-1.5 w-full bg-[var(--depth-1)] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
