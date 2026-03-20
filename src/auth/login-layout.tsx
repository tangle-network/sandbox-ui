"use client"

import * as React from "react"
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

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  )
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
    <div className={cn("bg-surface text-on-surface font-sans overflow-hidden", className)}>
      {/* Background effects */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-md3-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-container/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(#4a4455 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <main className="relative z-10 flex flex-col md:flex-row h-screen">
        {/* Left: Branding */}
        <section className="hidden md:flex flex-col justify-between p-12 lg:p-20 w-1/2 h-full">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-md3-primary to-primary-container rounded-lg flex items-center justify-center shadow-lg shadow-md3-primary/20">
                <MaterialIcon name="terminal" className="text-on-primary text-2xl" />
              </div>
              <span className="text-2xl font-extrabold tracking-tighter bg-gradient-to-br from-violet-300 to-violet-600 bg-clip-text text-transparent">
                {brandName}
              </span>
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            {tagline ? (
              <div className="text-5xl lg:text-7xl font-bold tracking-tight leading-none text-white">
                {tagline}
              </div>
            ) : (
              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-none text-white">
                Orchestrate <br /><span className="text-primary-fixed-dim">Agents</span> in Flow.
              </h1>
            )}
            <p className="text-on-surface-variant text-lg leading-relaxed font-light">
              {subtitle}
            </p>

            {/* Terminal display */}
            <div className="mt-12 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden shadow-2xl">
              <div className="bg-surface-container-high px-4 py-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-md3-error/40" />
                <div className="w-3 h-3 rounded-full bg-md3-primary/40" />
                <div className="w-3 h-3 rounded-full bg-md3-secondary/40" />
                <span className="ml-4 font-mono text-xs text-on-surface-variant/60">tangle --init-node</span>
              </div>
              <div className="p-6 font-mono text-xs space-y-2">
                {terminalLines.map((line, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-md3-primary/60">{String(i + 1).padStart(2, "0")}</span>
                    {line.startsWith("DONE") ? (
                      <>
                        <span className="text-primary-fixed-dim">DONE</span>
                        <span className="text-on-surface">{line.replace("DONE  ", "")}</span>
                      </>
                    ) : (
                      <span className="text-on-surface">{line}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer links */}
          <nav className="flex gap-8 text-sm font-medium text-on-surface-variant">
            {footerLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-md3-primary transition-colors flex items-center gap-2">
                <MaterialIcon name={link.label === "Documentation" ? "menu_book" : "contact_support"} className="text-lg" />
                {link.label}
              </a>
            ))}
          </nav>
        </section>

        {/* Right: Auth form */}
        <section className="w-full md:w-1/2 flex items-center justify-center p-6 lg:p-24 relative">
          <div className="w-full max-w-md bg-surface-container/60 backdrop-blur-[20px] rounded-[2rem] p-8 lg:p-12 shadow-2xl border border-white/5">
            {children}
          </div>
        </section>
      </main>
    </div>
  )
}
