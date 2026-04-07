"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface PromoBannerProps {
  title: string
  description: string
  buttonLabel: string
  href?: string
  onClick?: () => void
  icon?: React.ReactNode
  disabled?: boolean
  className?: string
}

export function PromoBanner({
  title,
  description,
  buttonLabel,
  href,
  onClick,
  icon,
  disabled = false,
  className,
}: PromoBannerProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "mt-6 inline-flex items-center gap-2 rounded-md border border-white/20 bg-[#6366F1] px-4 py-2 text-sm font-medium text-white transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[#818CF8]",
      )}
    >
      {buttonLabel}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
    </button>
  )

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-[#2E2A5E] p-8 md:flex md:items-center md:justify-between", className)}>
      <div className="relative z-10">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-white/70">{description}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {button}
          </a>
        ) : (
          button
        )}
      </div>
      {icon && (
        <div className="relative z-10 mt-6 flex items-center md:mt-0">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
            {icon}
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-white/5 to-transparent" />
    </div>
  )
}
