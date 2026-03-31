"use client"

import * as React from "react"
import { BookOpen, HelpCircle, Terminal } from "lucide-react"
import { cn } from "../lib/utils"

export interface LoginLayoutProps {
  brandName?: string
  tagline?: React.ReactNode
  subtitle?: string
  terminalLines?: string[]
  footerLinks?: { label: string; href: string }[]
  children: React.ReactNode
  className?: string
}

export function LoginLayout({
  brandName = "Tangle Sandbox",
  tagline,
  subtitle = "Step into the next generation of sandboxed cloud infrastructure. Precise, ethereal, and designed for high-performance development.",
  terminalLines = [
    "Initializing secure environment...",
    "DONE  Encrypted bridge established.",
    "Awaiting user authentication...",
  ],
  footerLinks = [
    { label: "Documentation", href: "/docs" },
    { label: "Support", href: "/support" },
  ],
  children,
  className,
}: LoginLayoutProps) {
  return (
    <div className={cn("bg-[var(--depth-1)] text-[var(--text-primary)] font-sans overflow-hidden", className)}>
      {/* Subtle background dot grid */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(var(--brand-cool) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <main className="relative z-10 flex flex-col md:flex-row h-screen">
        {/* Left: Branding */}
        <section className="hidden md:flex flex-col justify-between p-12 lg:p-20 w-1/2 h-full">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--accent-surface-soft)] border border-[var(--border-accent)] rounded-lg flex items-center justify-center">
                <Terminal className="h-5 w-5 text-[var(--brand-cool)]" />
              </div>
              <span className="text-2xl font-extrabold tracking-tighter text-[var(--text-primary)]">
                {brandName}
              </span>
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            {tagline ? (
              <div className="text-5xl lg:text-7xl font-bold tracking-tight leading-none text-[var(--text-primary)]">
                {tagline}
              </div>
            ) : (
              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-none">
                Orchestrate <br /><span className="text-[var(--brand-cool)]">Agents</span> in Flow.
              </h1>
            )}
            <p className="text-[var(--text-muted)] text-lg leading-relaxed font-light">
              {subtitle}
            </p>

            {/* Terminal display */}
            <div className="mt-12 bg-[var(--depth-2)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="bg-[var(--depth-1)] border-b border-[var(--border-subtle)] px-4 py-2 flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--text-muted)]">tangle --init-node</span>
              </div>
              <div className="p-6 font-mono text-xs space-y-2">
                {terminalLines.map((line, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-[var(--brand-cool)] opacity-60">{String(i + 1).padStart(2, "0")}</span>
                    {line.startsWith("DONE") ? (
                      <>
                        <span className="text-[var(--code-success)]">DONE</span>
                        <span className="text-[var(--text-primary)]">{line.replace("DONE  ", "")}</span>
                      </>
                    ) : (
                      <span className="text-[var(--text-secondary)]">{line}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer links */}
          <nav className="flex gap-8 text-sm font-medium text-[var(--text-muted)]">
            {footerLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-[var(--brand-cool)] transition-colors flex items-center gap-2">
                {link.label === "Documentation" ? <BookOpen className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
                {link.label}
              </a>
            ))}
          </nav>
        </section>

        {/* Right: Auth form */}
        <section className="w-full md:w-1/2 flex items-center justify-center p-6 lg:p-24 relative">
          <div className="w-full max-w-md bg-[var(--depth-2)] rounded-[2rem] p-8 lg:p-12 shadow-2xl border border-[var(--border-subtle)]">
            {children}
          </div>
        </section>
      </main>
    </div>
  )
}
