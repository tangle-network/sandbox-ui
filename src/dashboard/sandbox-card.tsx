"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import { ResourceMeter } from "./resource-meter"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tangle-network/ui/primitives"
import {
  MoreVertical, PowerOff, Power, Copy, Clock, Activity,
  BarChart2, Trash2, Network, Play, Plus, Users,
  Cpu, MemoryStick, HardDrive, Box,
} from "lucide-react"

export type SandboxStatus = "running" | "hibernating" | "provisioning" | "stopped" | "failed" | "archived" | "creating"

export type TeamRole = "owner" | "admin" | "member" | "viewer"

export interface SandboxCardData {
  id: string
  name: string
  nodeId?: string
  status: SandboxStatus
  /**
   * A user-customized container image (e.g. `ghcr.io/acme/api:sha-1a2b`).
   * Surfaced only when set — sandboxes run a managed agent runtime image by
   * default, which is not operator-relevant and is intentionally not shown.
   */
  customImage?: string
  /** @deprecated The product has no user-selectable environment. Use `customImage`. */
  image?: string
  /** @deprecated No longer rendered; the card derives its glyph from status. */
  imageIcon?: React.ReactNode
  /** Allocated vCPU count. */
  vcpu?: number
  /** Live CPU utilization, 0–100. */
  cpuPercent?: number
  /** Live RAM in use (GB). */
  ramUsed?: number
  /** Allocated RAM (GB). */
  ramTotal?: number
  /** Disk in use (GB). */
  diskUsed?: number
  /** Allocated disk (GB). */
  diskTotal?: number
  /** Human-readable uptime since last start, e.g. "3d 4h" or "12m". */
  uptime?: string
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
  /** Preferred start handler; drives the footer + dropdown Resume action. */
  onResume?: (id: string) => void
  /**
   * @deprecated Use `onResume`. Retained for back-compat: only a
   * `hibernating` card falls back to `onWake` when `onResume` is absent.
   */
  onWake?: (id: string) => void
  onRestore?: (id: string) => void
  onDelete?: (id: string) => void
  onStop?: (id: string) => void
  onFork?: (id: string) => void
  onKeepAlive?: (id: string) => void
  onUsage?: (id: string) => void
  onHealth?: (id: string) => void
  className?: string
}

// Personal sandboxes are always admin for the owner; team sandboxes
// only expose destructive actions to owner/admin members.
export function canAdminSandbox(sandbox: SandboxCardData): boolean {
  if (!sandbox.team) return true
  return sandbox.team.role === "owner" || sandbox.team.role === "admin"
}

const STATUS_META: Record<SandboxStatus, { label: string; color: string }> = {
  running: { label: "Running", color: "var(--status-running)" },
  hibernating: { label: "Hibernating", color: "var(--status-warm)" },
  provisioning: { label: "Provisioning", color: "var(--status-creating)" },
  creating: { label: "Creating", color: "var(--status-creating)" },
  stopped: { label: "Stopped", color: "var(--status-stopped)" },
  failed: { label: "Failed", color: "var(--status-error)" },
  archived: { label: "Archived", color: "var(--status-deleted)" },
}

function Spec({ icon, value, unit }: { icon: React.ReactNode; value: number; unit: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
      <span className="font-mono text-xs tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{unit}</span>
    </span>
  )
}

export function SandboxCard({
  sandbox, onOpenIDE, onOpenTerminal, onWake, onRestore, onDelete,
  onStop, onResume, onFork, onKeepAlive, onUsage, onHealth, className
}: SandboxCardProps) {
  const isRunning = sandbox.status === "running"
  const isTransitioning = sandbox.status === "provisioning" || sandbox.status === "creating"
  const isStopped = !isRunning && !isTransitioning
  const isHibernating = sandbox.status === "hibernating"

  // Footer + dropdown share one resolved start handler so they can never
  // disagree. Mirrors SandboxTable: prefer onResume, fall back to onWake
  // only for a hibernating card (its historical contract). Without this,
  // a card rendered with onResume but not onWake showed an enabled footer
  // button that silently no-op'd on click.
  const resolveResumeHandler = (status: SandboxStatus): ((id: string) => void) | undefined => {
    if (onResume) return onResume
    if (status === "hibernating") return onWake
    return undefined
  }
  const resumeLabel = isHibernating ? "Wake Sandbox" : "Resume Sandbox"
  const resumeHandler = isStopped ? resolveResumeHandler(sandbox.status) : undefined

  const status = STATUS_META[sandbox.status]
  const isArchived = sandbox.status === "archived"
  const cpuPercent = sandbox.cpuPercent ?? 0
  const ramUsed = sandbox.ramUsed ?? 0
  const ramTotal = sandbox.ramTotal ?? 0
  const diskUsed = sandbox.diskUsed
  const diskTotal = sandbox.diskTotal

  // Allocated-resource chips: render only the dimensions the caller provided.
  const specs = [
    sandbox.vcpu != null && { key: "vcpu", icon: <Cpu className="h-3.5 w-3.5" />, value: sandbox.vcpu, unit: "vCPU" },
    ramTotal > 0 && { key: "ram", icon: <MemoryStick className="h-3.5 w-3.5" />, value: ramTotal, unit: "GB RAM" },
    diskTotal != null && { key: "disk", icon: <HardDrive className="h-3.5 w-3.5" />, value: diskTotal, unit: "GB SSD" },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; value: number; unit: string }[]

  return (
    <div className={cn(
      "group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-surface-container p-5 transition-colors",
      isRunning ? "border-[var(--status-running)]/30" : "border-[var(--md3-outline-variant)]",
      "hover:border-foreground/15",
      className
    )}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-foreground">
              {sandbox.name}
            </h3>
            {sandbox.team && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]"
                title={`Shared with ${sandbox.team.name ?? "Team"} · ${sandbox.team.role}`}
              >
                <Users className="h-3 w-3" aria-hidden="true" />
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
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground outline-none"
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
                {resumeHandler && <DropdownMenuItem onClick={() => resumeHandler(sandbox.id)}><Power className="mr-2 h-4 w-4" /> {resumeLabel}</DropdownMenuItem>}
                {onFork && <DropdownMenuItem onClick={() => onFork(sandbox.id)}><Copy className="mr-2 h-4 w-4" /> Fork Sandbox</DropdownMenuItem>}
                {(resumeHandler || onFork) && <DropdownMenuSeparator />}
              </>
            )}
            {onDelete && canAdminSandbox(sandbox) && (
              <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => onDelete(sandbox.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Sandbox
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Operational signal */}
      <div className="my-4 space-y-3">
        {/* Status + uptime */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--md3-outline-variant)] bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-foreground">
            <span className="relative flex h-1.5 w-1.5">
              {isRunning && (
                // The ping renders only while the sandbox IS running, so it is
                // live state, not decoration — the same call SandboxTable makes
                // for its running/provisioning dot.
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: status.color }}
                  data-motion="essential"
                />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
            </span>
            {status.label}
          </span>
          {isRunning && sandbox.uptime && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              up {sandbox.uptime}
            </span>
          )}
        </div>

        {/* Live metrics — only meaningful while the sandbox is running */}
        {isRunning ? (
          <div className="space-y-2 rounded-md border border-[var(--md3-outline-variant)] bg-surface-container-high p-3">
            <ResourceMeter label="CPU" value={cpuPercent} max={100} icon={<Cpu className="h-3 w-3" />} />
            {ramTotal > 0 && (
              <ResourceMeter
                label="MEM"
                value={ramUsed}
                max={ramTotal}
                valueLabel={`${ramUsed} / ${ramTotal} GB`}
                icon={<MemoryStick className="h-3 w-3" />}
              />
            )}
            {diskUsed != null && diskTotal != null && diskTotal > 0 && (
              <ResourceMeter
                label="DISK"
                value={diskUsed}
                max={diskTotal}
                valueLabel={`${diskUsed} / ${diskTotal} GB`}
                icon={<HardDrive className="h-3 w-3" />}
              />
            )}
          </div>
        ) : isTransitioning ? (
          <div className="rounded-md border border-[var(--md3-outline-variant)] bg-surface-container-high p-3">
            <div className="mb-1.5 flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>{sandbox.provisioningMessage || "Starting…"}</span>
              <span className="font-mono tabular-nums">{sandbox.provisioningPercent ?? 0}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${sandbox.provisioningPercent || 5}%` }}
              />
            </div>
          </div>
        ) : isArchived && sandbox.archivedAt ? (
          <p className="font-mono text-[11px] text-muted-foreground">{sandbox.archivedAt}</p>
        ) : null}

        {/* Allocated resources */}
        {specs.length > 0 && (
          <div className="flex items-center gap-4 rounded-md border border-[var(--md3-outline-variant)] bg-surface-container-high px-3 py-2">
            {specs.map((s) => (
              <Spec key={s.key} icon={s.icon} value={s.value} unit={s.unit} />
            ))}
          </div>
        )}

        {/* Custom image — shown only when the operator overrode the runtime image */}
        {sandbox.customImage && (
          <div className="flex items-center gap-1.5 truncate font-mono text-[10px] text-muted-foreground">
            <Box className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate" title={sandbox.customImage}>{sandbox.customImage}</span>
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="border-t border-[var(--md3-outline-variant)] pt-3">
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
            onClick={() => resumeHandler?.(sandbox.id)}
            disabled={isTransitioning || !resumeHandler}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors border",
              isTransitioning || !resumeHandler
                ? "bg-muted text-muted-foreground cursor-not-allowed border-[var(--md3-outline-variant)]"
                : "bg-surface-container-high text-foreground hover:bg-surface-container-highest border-[var(--md3-outline-variant)] active:scale-[0.97]"
            )}
          >
            <Play className="h-4 w-4" />
            {isTransitioning ? "Starting..." : resumeLabel}
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
        "border-2 border-dashed border-[var(--md3-outline-variant)] rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-foreground/20 hover:bg-surface-container-high transition-colors w-full min-h-[160px]",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-high text-muted-foreground">
        <Plus className="h-6 w-6" />
      </div>
      <span className="mt-4 text-sm font-semibold text-foreground">
        New Sandbox
      </span>
      <span className="mt-1 text-xs text-muted-foreground">
        Spin up an isolated sandbox
      </span>
    </button>
  )
}
