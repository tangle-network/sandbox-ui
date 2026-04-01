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
    <div className={cn("relative flex min-h-screen items-center justify-center bg-[var(--md3-background)] overflow-hidden antialiased font-sans flex-col", className)}>
      {/* Background Magic Elements */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-1/4 -right-1/4 h-[800px] w-[800px] rounded-full bg-[var(--md3-primary)] opacity-10 blur-[150px] mix-blend-screen" />
        <div className="absolute -bottom-1/4 -left-1/4 h-[800px] w-[800px] rounded-full bg-[var(--md3-primary-dim)] opacity-20 blur-[150px] mix-blend-screen" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_100%)] blur-[50px]" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0ibTIwIDB2MjBIMFYweiIgZmlsbD0ibm9uZSIvPPHBhdGggZD0iTTE5LjUgMEwxOS41IDIwTTIwIC41TDAgLjVIMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSLCAyNTUsIDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] opacity-30" style={{ maskImage: "radial-gradient(circle at center, black, transparent)", WebkitMaskImage: "radial-gradient(circle at center, black 40%, transparent 100%)" }} />
      </div>

      <div className="z-10 w-full max-w-md px-6 animate-in flex flex-col items-center">
        {/* Header / Brand */}
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="inline-flex h-16 w-16 mb-4 items-center justify-center rounded-2xl glass-panel shadow-[0_0_30px_rgba(173,163,255,0.15)] glow-primary relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0,transparent_100%)] pointer-events-none rounded-2xl" />
            {brandIcon || <Terminal className="h-8 w-8 text-[var(--md3-primary)]" />}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-[var(--md3-on-surface-variant)]">{subtitle}</p>
        </div>

        <div className="w-full glass-panel-heavy p-8 border border-border shadow-sm relative overflow-hidden backdrop-blur-3xl rounded-[32px]">
          {/* Internal gradient flare */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--md3-primary)] to-transparent opacity-50" />
          
          {children}
        </div>
      </div>
    </div>
  )
}
