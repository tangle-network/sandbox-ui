"use client"

import { ArrowRight } from "lucide-react"
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
  const buttonClasses = cn(
    "mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] transition-colors",
    disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--btn-primary-hover)]",
  )

  const buttonContent = (
    <>
      {buttonLabel}
      <ArrowRight aria-hidden="true" className="size-4" />
    </>
  )

  return (
    <div className={cn("rounded-xl border border-[var(--md3-outline-variant)] bg-surface-container p-8 md:flex md:items-center md:justify-between", className)}>
      <div>
        <h3 className="text-xl font-medium text-foreground">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        {href && !disabled ? (
          <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={buttonClasses}>
            {buttonContent}
          </a>
        ) : (
          <button type="button" onClick={onClick} disabled={disabled} className={buttonClasses}>
            {buttonContent}
          </button>
        )}
      </div>
      {icon && (
        <div className="mt-6 flex items-center md:mt-0">
          <div className="flex size-16 items-center justify-center rounded-xl border border-[var(--md3-outline-variant)] bg-surface-container-high text-muted-foreground">
            {icon}
          </div>
        </div>
      )}
    </div>
  )
}
