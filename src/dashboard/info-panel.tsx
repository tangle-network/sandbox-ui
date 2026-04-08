"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface InfoPanelProps {
  label: string
  title: string
  description: string
  className?: string
}

export function InfoPanel({ label, title, description, className }: InfoPanelProps) {
  return (
    <div className={cn("rounded-lg bg-[var(--brand-strong)] p-5 text-white relative overflow-hidden", className)}>
      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{label}</p>
        <h3 className="mt-1 text-lg font-bold">{title}</h3>
        <p className="mt-1 text-sm text-white/70">{description}</p>
      </div>
      <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 -skew-x-12 translate-x-12 pointer-events-none" />
    </div>
  )
}
