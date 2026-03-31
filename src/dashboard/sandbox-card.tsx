"use client"

import * as React from "react"
import { Cpu, Database, Plus, Terminal, Power, ExternalLink, RefreshCw } from "lucide-react"
import { cn } from "../lib/utils"
import { ResourceMeter } from "./resource-meter"

export type SandboxStatus = "running" | "hibernating" | "provisioning" | "stopped" | "failed" | "archived"

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
  className?: string
}

const statusConfig: Record<SandboxStatus, { color: string; bg: string; border: string; dotClass: string; label: string }> = {
  running:      { color: "text-[var(--surface-success-text)]", bg: "bg-[var(--surface-success-bg)]", border: "border-[var(--surface-success-border)]", dotClass: "bg-[var(--surface-success-text)] animate-pulse", label: "Running" },
  hibernating:  { color: "text-[var(--text-muted)]",    bg: "bg-[var(--depth-3)]",        border: "border-[var(--border-subtle)]", dotClass: "bg-[var(--text-muted)]",                  label: "Hibernating" },
  provisioning: { color: "text-[var(--brand-cool)]",    bg: "bg-[var(--accent-surface-soft)]", border: "border-[var(--border-accent)]", dotClass: "bg-[var(--brand-cool)] animate-pulse", label: "Provisioning" },
  stopped:      { color: "text-[var(--text-muted)]",    bg: "bg-[var(--depth-3)]",        border: "border-[var(--border-subtle)]", dotClass: "bg-[var(--text-muted)]",                  label: "Stopped" },
  failed:       { color: "text-[var(--surface-danger-text)]",  bg: "bg-[var(--surface-danger-bg)]",  border: "border-[var(--surface-danger-border)]",  dotClass: "bg-[var(--surface-danger-text)]",  label: "Failed" },
  archived:     { color: "text-[var(--text-muted)]",    bg: "bg-[var(--depth-3)]",        border: "border-[var(--border-subtle)]", dotClass: "bg-[var(--border-default)]",              label: "Archived" },
}

export function SandboxCard({ sandbox, onOpenIDE, onOpenTerminal, onWake, onRestore, className }: SandboxCardProps) {
  const status = statusConfig[sandbox.status] ?? statusConfig.stopped
  const isActive = sandbox.status === "running"
  const isHibernating = sandbox.status === "hibernating"
  const isProvisioning = sandbox.status === "provisioning"
  const isArchived = sandbox.status === "archived"

  return (
    <div
      className={cn(
        "bg-[var(--depth-2)] rounded-xl p-5 relative overflow-hidden group hover:bg-[var(--depth-3)] transition-all duration-300 border border-[var(--border-subtle)] hover:border-[var(--border-default)]",
        isActive && "border-[var(--border-accent)]",
        isArchived && "opacity-60 hover:opacity-100",
        className,
      )}
    >
      {/* Status badge */}
      <div className="absolute top-0 right-0 p-4">
        <span className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border",
          status.bg, status.color, status.border,
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", status.dotClass)} />
          {status.label}
        </span>
      </div>

      {/* Header */}
      <div className="mb-5 pr-24">
        <div className="flex items-center gap-3 mb-1">
          {sandbox.imageIcon && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--depth-3)] border border-[var(--border-subtle)] shrink-0">
              {sandbox.imageIcon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-cool)] transition-colors truncate leading-tight">
              {sandbox.name}
            </h3>
            {sandbox.nodeId && (
              <p className="text-[var(--text-muted)] font-mono text-[10px] truncate mt-0.5">{sandbox.nodeId}</p>
            )}
          </div>
        </div>
      </div>

      {/* Resource meters or provisioning progress */}
      {isProvisioning ? (
        <div className="mb-5 mt-2">
          <p className="text-[10px] font-bold font-mono text-[var(--brand-cool)] mb-2 uppercase tracking-widest flex items-center gap-2 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" />
            {sandbox.provisioningMessage ?? "Initializing..."}
          </p>
          <div className="h-1.5 w-full bg-[var(--depth-1)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand-cool)] transition-all duration-500"
              style={{ width: `${sandbox.provisioningPercent ?? 50}%` }}
            />
          </div>
        </div>
      ) : !isArchived ? (
        <div className={cn("space-y-4 mb-5", !isActive && "opacity-35")}>
          <ResourceMeter label="CPU" icon={<Cpu className="h-3 w-3" />} value={sandbox.cpuPercent ?? 0} />
          <ResourceMeter
            label="RAM"
            icon={<Database className="h-3 w-3" />}
            value={sandbox.ramUsed ?? 0}
            max={sandbox.ramTotal ?? 1}
            unit="GB"
          />
        </div>
      ) : (
        <div className="mb-4">
          {sandbox.archivedAt && (
            <p className="text-[var(--text-muted)] font-mono text-[10px]">{sandbox.archivedAt}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenIDE?.(sandbox.id)}
            className="flex items-center justify-center gap-2 py-2 bg-[var(--accent-surface-soft)] hover:bg-[var(--accent-surface-strong)] text-[var(--accent-text)] rounded-lg transition-all text-xs font-semibold border border-[var(--border-accent)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open IDE
          </button>
          <button
            type="button"
            onClick={() => onOpenTerminal?.(sandbox.id)}
            className="flex items-center justify-center gap-2 py-2 bg-[var(--depth-3)] hover:bg-[var(--depth-4)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-all text-xs font-semibold border border-[var(--border-subtle)]"
          >
            <Terminal className="h-3.5 w-3.5" />
            Terminal
          </button>
        </div>
      )}

      {isHibernating && (
        <button
          type="button"
          onClick={() => onWake?.(sandbox.id)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--accent-surface-soft)] text-[var(--brand-cool)] hover:bg-[var(--accent-surface-strong)] rounded-lg transition-all text-xs font-bold border border-[var(--border-accent)]"
        >
          <Power className="h-3.5 w-3.5" />
          Wake Sandbox
        </button>
      )}

      {isProvisioning && (
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--depth-3)] text-[var(--text-muted)] cursor-not-allowed rounded-lg text-xs font-semibold border border-[var(--border-subtle)]"
        >
          Please Wait...
        </button>
      )}

      {isArchived && (
        <button
          type="button"
          onClick={() => onRestore?.(sandbox.id)}
          className="w-full py-2 bg-[var(--depth-3)] hover:bg-[var(--depth-4)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition-all text-xs font-semibold border border-[var(--border-subtle)]"
        >
          Restore Sandbox
        </button>
      )}
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
        "border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-[var(--border-accent)] hover:bg-[var(--accent-surface-soft)] transition-all duration-300 w-full min-h-[200px]",
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full bg-[var(--depth-3)] border border-[var(--border-subtle)] flex items-center justify-center mb-4 group-hover:bg-[var(--accent-surface-strong)] group-hover:border-[var(--border-accent)] group-hover:text-[var(--accent-text)] text-[var(--text-muted)] transition-all group-active:scale-90">
        <Plus className="h-6 w-6" />
      </div>
      <h4 className="font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] mb-1 text-sm transition-colors">New Environment</h4>
      <p className="text-xs text-[var(--text-muted)]">Instantiate a fresh compute node</p>
    </button>
  )
}
