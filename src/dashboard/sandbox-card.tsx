"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu"
import { 
  MoreVertical, PowerOff, Power, Copy, Clock, Activity, 
  BarChart2, Trash2, Terminal, Code2, Network, Play, Plus 
} from "lucide-react"

export type SandboxStatus = "running" | "hibernating" | "provisioning" | "stopped" | "failed" | "archived" | "creating"

export interface SandboxCardData {
  id: string
  name: string
  nodeId?: string
  status: SandboxStatus
  image?: string
  imageIcon?: React.ReactNode
  cpuPercent?: number
  ramUsed?: number
  ramTotal?: number
  provisioningMessage?: string
  provisioningPercent?: number
  archivedAt?: string
}

export interface SandboxCardProps {
  sandbox: SandboxCardData
  onOpenIDE?: (id: string) => void
  onOpenTerminal?: (id: string) => void
  onWake?: (id: string) => void
  onRestore?: (id: string) => void
  onDelete?: (id: string) => void
  onStop?: (id: string) => void
  onResume?: (id: string) => void
  onFork?: (id: string) => void
  onKeepAlive?: (id: string) => void
  onUsage?: (id: string) => void
  onHealth?: (id: string) => void
  className?: string
}

export function SandboxCard({ 
  sandbox, onOpenIDE, onOpenTerminal, onWake, onRestore, onDelete, 
  onStop, onResume, onFork, onKeepAlive, onUsage, onHealth, className 
}: SandboxCardProps) {
  const isRunning = sandbox.status === "running"
  const isTransitioning = sandbox.status === "provisioning" || sandbox.status === "creating"
  const isStopped = !isRunning && !isTransitioning

  return (
    <div className={cn(
      "group relative glass-panel flex flex-col justify-between overflow-hidden rounded-3xl p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[var(--md3-primary)]/10",
      isRunning ? "border-[var(--md3-primary)]/30 glow-primary" : "border-border",
      className
    )}>
      
      {/* Background ambient glow if running */}
      {isRunning && (
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-[var(--md3-primary)]/20 blur-[60px] pointer-events-none" />
      )}

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-headline text-xl font-bold tracking-tight text-foreground">
            {sandbox.name}
            {isRunning && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
            )}
          </h3>
          <p className="font-mono text-[10px] tracking-wider text-[var(--md3-on-surface-variant)] mt-1 uppercase font-bold">
            {sandbox.nodeId || "Unknown Node"}
          </p>
        </div>
        <div className="flex items-center gap-1 z-50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full flex items-center justify-center p-2 text-[var(--md3-on-surface-variant)] transition-colors hover:bg-muted hover:text-foreground shrink-0 outline-none"
                aria-label="Sandbox options"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-panel-heavy border-[var(--md3-outline-variant)] min-w-[180px]">
              {isRunning && (
                <>
                  {onStop && <DropdownMenuItem onClick={() => onStop(sandbox.id)}><PowerOff className="mr-2 h-4 w-4" /> Stop Sandbox</DropdownMenuItem>}
                  {onKeepAlive && <DropdownMenuItem onClick={() => onKeepAlive(sandbox.id)}><Clock className="mr-2 h-4 w-4" /> Keep Alive</DropdownMenuItem>}
                  <DropdownMenuSeparator className="bg-[var(--md3-outline-variant)]" />
                  {onUsage && <DropdownMenuItem onClick={() => onUsage(sandbox.id)}><BarChart2 className="mr-2 h-4 w-4" /> View Usage</DropdownMenuItem>}
                  {onHealth && <DropdownMenuItem onClick={() => onHealth(sandbox.id)}><Activity className="mr-2 h-4 w-4" /> Health Check</DropdownMenuItem>}
                  <DropdownMenuSeparator className="bg-[var(--md3-outline-variant)]" />
                  {onFork && <DropdownMenuItem onClick={() => onFork(sandbox.id)}><Copy className="mr-2 h-4 w-4" /> Fork Sandbox</DropdownMenuItem>}
                  <DropdownMenuSeparator className="bg-[var(--md3-outline-variant)]" />
                </>
              )}
              {isStopped && (
                <>
                  {onResume && <DropdownMenuItem onClick={() => onResume(sandbox.id)}><Power className="mr-2 h-4 w-4" /> Resume Sandbox</DropdownMenuItem>}
                  {onFork && <DropdownMenuItem onClick={() => onFork(sandbox.id)}><Copy className="mr-2 h-4 w-4" /> Fork Sandbox</DropdownMenuItem>}
                  <DropdownMenuSeparator className="bg-[var(--md3-outline-variant)]" />
                </>
              )}
              {onDelete && (
                <DropdownMenuItem className="text-red-400 focus:bg-red-500/10 focus:text-red-300" onClick={() => onDelete(sandbox.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Sandbox
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Stats / Image */}
      <div className="relative z-10 my-8">
        <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-2xl p-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", isRunning ? "bg-[var(--md3-primary)]/20" : "bg-white/5")}>
            {sandbox.imageIcon ? sandbox.imageIcon : (
              sandbox.image?.includes('node') ? <Code2 className={cn("h-6 w-6", isRunning ? "text-[var(--md3-primary)]" : "text-[var(--md3-on-surface-variant)]")} /> : <Terminal className={cn("h-6 w-6", isRunning ? "text-[var(--md3-primary)]" : "text-[var(--md3-on-surface-variant)]")} />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--md3-on-surface-variant)] uppercase tracking-widest font-bold">Environment</span>
            <span className="text-sm font-medium text-foreground font-mono mt-0.5">{sandbox.image || "Universal"}</span>
          </div>
        </div>

        {/* Status Bar */}
        {isTransitioning && (
           <div className="mt-4 animate-in">
              <div className="flex justify-between text-xs text-[var(--md3-primary)] font-medium mb-1">
                <span>{sandbox.provisioningMessage || "Starting..."}</span>
                <span>{sandbox.provisioningPercent || 0}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-[var(--md3-primary)] to-[#ada3ff] transition-all duration-500 rounded-full"
                  style={{ width: `${sandbox.provisioningPercent || 5}%` }}
                />
              </div>
           </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="relative z-10 flex items-center gap-3 border-t border-[var(--md3-outline-variant)] pt-4">
        {isRunning ? (
          <button
            type="button"
            onClick={() => onOpenIDE?.(sandbox.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--md3-primary)]/20 px-4 py-2.5 font-bold text-sm text-[var(--md3-primary)] shadow-[0_0_15px_rgba(173,163,255,0.1)] transition-all hover:bg-[var(--md3-primary)] hover:text-primary-foreground hover:shadow-[var(--shadow-glow)] active:scale-95 border border-[var(--md3-primary)]/30"
          >
            <Network className="h-4 w-4" />
            Connect Session
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onWake?.(sandbox.id)}
            disabled={isTransitioning}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-bold text-sm transition-all border",
              isTransitioning 
                ? "bg-muted/30 text-[var(--md3-on-surface-variant)] cursor-not-allowed border-border" 
                : "bg-[var(--md3-primary)]/10 text-[var(--md3-primary)] hover:bg-[var(--md3-primary)] hover:text-foreground shadow-[0_0_15px_rgba(173,163,255,0.1)] hover:shadow-[0_0_20px_rgba(173,163,255,0.4)] active:scale-95 border-[var(--md3-primary)]/30"
            )}
          >
            <Play className="h-4 w-4" />
            {isTransitioning ? "Starting..." : "Wake Sandbox"}
          </button>
        )}
      </div>

    </div>
  )
}

export interface NewSandboxCardProps {
  onClick?: () => void
  className?: string
}

export function NewSandboxCard({ onClick, className }: NewSandboxCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-5 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-[var(--border-accent)] hover:bg-[var(--accent-surface-soft)] transition-all duration-300 w-full min-h-[160px]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(155,140,255,0.1)_0,transparent_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--md3-primary)]/20 text-[var(--md3-primary)] shadow-[0_0_20px_rgba(155,140,255,0.2)] transition-transform duration-300 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(155,140,255,0.4)]">
        <Plus className="h-8 w-8" />
      </div>
      <span className="mt-6 font-headline text-xl font-bold text-foreground tracking-tight">
        New Sandbox
      </span>
      <span className="mt-2 text-sm text-[var(--md3-primary)] font-medium">
        Deploy a new isolated environment
      </span>
    </button>
  )
}
