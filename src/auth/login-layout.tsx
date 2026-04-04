"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import { Terminal } from "lucide-react"

export interface LoginLayoutProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  brandIcon?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** (Deprecated) terminal lines from legacy layout, kept for backwards compatibility */
  terminalLines?: string[]
  /** (Deprecated) tagline, kept for backwards compatibility */
  tagline?: React.ReactNode
  /** (Deprecated) footerLinks, kept for backwards compatibility */
  footerLinks?: { label: string; href: string }[]
}

export function LoginLayout({
  title = "Welcome Back",
  subtitle = "Sign in to your workspace.",
  brandIcon,
  children,
  className,
}: LoginLayoutProps) {
  return (
    <div className={cn("relative flex min-h-screen items-center justify-center bg-background overflow-hidden antialiased font-sans flex-col", className)}>
      <div className="z-10 w-full max-w-md px-6 animate-in flex flex-col items-center">
        {/* Header / Brand */}
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="inline-flex h-14 w-14 mb-4 items-center justify-center rounded-lg bg-muted border border-border">
            {brandIcon || <Terminal className="h-7 w-7 text-foreground" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="w-full bg-card p-8 border border-border rounded-lg">
          {children}
        </div>
      </div>
    </div>
  )
}
