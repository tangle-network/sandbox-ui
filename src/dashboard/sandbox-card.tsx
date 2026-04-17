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
  BarChart2, Trash2, Terminal, Code2, Network, Play, Plus, Users,
} from "lucide-react"

export type SandboxStatus = "running" | "hibernating" | "provisioning" | "stopped" | "failed" | "archived" | "creating"

export type TeamRole = "owner" | "admin" | "member" | "viewer"

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
  /**
   * Populated when the sandbox is shared with a team. Drives a small
   * "shared with X" badge in the card header so a user can see at a
   * glance which of their sandboxes are personal vs. collaborative.
   */
  team?: {
    id: string
    name?: string
    /** Caller's role in the team — the card uses this to gate the Delete action. */
    role: TeamRole
  }
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

// Personal sandboxes are always admin for the owner; team sandboxes
// only expose Delete to owner/admin members. Keeping this local avoids
// threading a capability flag through every caller — the card already
// receives the team record and can decide for itself.
function canAdminOnCard(sandbox: SandboxCardData): boolean {
  if (!sandbox.team) return true
  return sandbox.team.role === "owner" || sandbox.team.role === "admin"
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
      "group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-card p-5 transition-colors",
      isRunning ? "border-[var(--status-running)]/30" : "border-border",
      "hover:border-foreground/15",
      className
    )}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              {sandbox.name}
              {isRunning && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-[var(--status-running)] opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--status-running)]"></span>
                </span>
              )}
            </h3>
            {sandbox.team && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]"
                title={`Shared with ${sandbox.team.name ?? "team"} · ${sandbox.team.role}`}
              >
                <Users className="h-3 w-3" />
                {sandbox.team.name ?? "Team"}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {sandbox.nodeId || "Unknown Node"}
            {sandbox.team && (
              <span className="ml-2 normal-case tracking-normal">
                · your role: {sandbox.team.role}
              </span>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none"
              aria-label="Sandbox options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {isRunning && (
              <>
                {onStop && <DropdownMenuItem onClick={() => onStop(sandbox.id)}><PowerOff className="mr-2 h-4 w-4" /> Stop Sandbox</DropdownMenuItem>}
                {onKeepAlive && <DropdownMenuItem onClick={() => onKeepAlive(sandbox.id)}><Clock className="mr-2 h-4 w-4" /> Keep Alive</DropdownMenuItem>}
                {(onStop || onKeepAlive) && <DropdownMenuSeparator />}
                {onUsage && <DropdownMenuItem onClick={() => onUsage(sandbox.id)}><BarChart2 className="mr-2 h-4 w-4" /> View Usage</DropdownMenuItem>}
                {onHealth && <DropdownMenuItem onClick={() => onHealth(sandbox.id)}><Activity className="mr-2 h-4 w-4" /> Health Check</DropdownMenuItem>}
                {(onUsage || onHealth) && <DropdownMenuSeparator />}
                {onFork && (
                  <>
                    <DropdownMenuItem onClick={() => onFork(sandbox.id)}><Copy className="mr-2 h-4 w-4" /> Fork Sandbox</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
              </>
            )}
            {isStopped && (
              <>
                {onResume && <DropdownMenuItem onClick={() => onResume(sandbox.id)}><Power className="mr-2 h-4 w-4" /> Resume Sandbox</DropdownMenuItem>}
                {onFork && <DropdownMenuItem onClick={() => onFork(sandbox.id)}><Copy className="mr-2 h-4 w-4" /> Fork Sandbox</DropdownMenuItem>}
                {(onResume || onFork) && <DropdownMenuSeparator />}
              </>
            )}
            {onDelete && canAdminOnCard(sandbox) && (
              <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => onDelete(sandbox.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Sandbox
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Environment Info */}
      <div className="my-4">
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", isRunning ? "bg-[var(--surface-success-bg)]" : "bg-muted")}>
            {sandbox.imageIcon ? sandbox.imageIcon : (
              sandbox.image?.includes('node') ? <Code2 className={cn("h-5 w-5", isRunning ? "text-[var(--surface-success-text)]" : "text-muted-foreground")} /> : <Terminal className={cn("h-5 w-5", isRunning ? "text-[var(--surface-success-text)]" : "text-muted-foreground")} />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Environment</span>
            <span className="text-xs font-medium text-foreground font-mono mt-0.5">{sandbox.image || "Universal"}</span>
          </div>
        </div>

        {/* Provisioning Progress */}
        {isTransitioning && (
           <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground font-medium mb-1">
                <span>{sandbox.provisioningMessage || "Starting..."}</span>
                <span>{sandbox.provisioningPercent || 0}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${sandbox.provisioningPercent || 5}%` }}
                />
              </div>
           </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="border-t border-border pt-3">
        {isRunning ? (
          <button
            type="button"
            onClick={() => onOpenIDE?.(sandbox.id)}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)] active:scale-[0.97]"
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
              "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors border",
              isTransitioning
                ? "bg-muted text-muted-foreground cursor-not-allowed border-border"
                : "bg-card text-foreground hover:bg-muted border-border active:scale-[0.97]"
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
        "border-2 border-dashed border-border rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-foreground/20 hover:bg-muted/30 transition-colors w-full min-h-[160px]",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Plus className="h-6 w-6" />
      </div>
      <span className="mt-4 text-sm font-semibold text-foreground">
        New Sandbox
      </span>
      <span className="mt-1 text-xs text-muted-foreground">
        Deploy a new isolated environment
      </span>
    </button>
  )
}
