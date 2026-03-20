"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface ResourceMeterProps {
  label: string
  value: number
  max?: number
  unit?: string
  icon?: string
  className?: string
}

function getColorByUsage(percent: number): string {
  if (percent >= 90) return "from-red-500 to-red-300"
  if (percent >= 70) return "from-yellow-500 to-yellow-300"
  if (percent >= 40) return "from-blue-500 to-blue-300"
  return "from-green-500 to-green-300"
}

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  )
}

export function ResourceMeter({ label, value, max = 100, unit, icon, className }: ResourceMeterProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const gradient = getColorByUsage(percent)

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-[11px] font-bold font-mono text-on-surface uppercase tracking-tight">
        <span className="flex items-center gap-1">
          {icon && <MaterialIcon name={icon} className="text-xs" />}
          {label}
        </span>
        <span className="text-primary-fixed-dim">
          {unit ? `${value}${unit} / ${max}${unit}` : `${Math.round(percent)}%`}
        </span>
      </div>
      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className={cn("h-full bg-gradient-to-r rounded-full transition-all duration-500", gradient)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
