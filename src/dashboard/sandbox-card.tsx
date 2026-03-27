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
  /** Called when the user clicks "Delete". The consuming app should show a confirmation dialog before performing the deletion. */
  onDelete?: (id: string) => void
  onSSH?: (id: string) => void
  className?: string
}

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  )
}

const statusConfig: Record<SandboxStatus, { color: string; bgColor: string; borderColor: string; dotClass: string; label: string }> = {
  running: { color: "text-green-400", bgColor: "bg-green-500/10", borderColor: "border-green-500/20", dotClass: "bg-green-400 animate-pulse", label: "Running" },
  hibernating: { color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", dotClass: "bg-slate-500", label: "Hibernating" },
  provisioning: { color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20", dotClass: "bg-orange-500 animate-ping", label: "Provisioning" },
  stopped: { color: "text-slate-400", bgColor: "bg-slate-500/10", borderColor: "border-slate-500/20", dotClass: "bg-slate-500", label: "Stopped" },
  failed: { color: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/20", dotClass: "bg-red-500", label: "Failed" },
  archived: { color: "text-slate-400", bgColor: "bg-slate-500/10", borderColor: "border-slate-500/20", dotClass: "bg-slate-600", label: "Archived" },
}

const glowMap: Record<string, string> = {
  node: "shadow-[0_0_20px_-5px_rgba(34,197,94,0.15)] border border-green-500/20",
  python: "shadow-[0_0_20px_-5px_rgba(59,130,246,0.15)] border border-blue-500/20",
  ubuntu: "shadow-[0_0_20px_-5px_rgba(234,88,12,0.15)] border border-orange-500/20",
}

function getGlow(image?: string): string {
  if (!image) return ""
  const lower = image.toLowerCase()
  for (const [key, cls] of Object.entries(glowMap)) {
    if (lower.includes(key)) return cls
  }
  return ""
}

export function SandboxCard({ sandbox, onOpenIDE, onOpenTerminal, onWake, onRestore, onDelete, onSSH, className }: SandboxCardProps) {
  const status = statusConfig[sandbox.status] ?? statusConfig.stopped
  const glow = getGlow(sandbox.image)
  const isActive = sandbox.status === "running"
  const isHibernating = sandbox.status === "hibernating"
  const isStopped = sandbox.status === "stopped"
  const isProvisioning = sandbox.status === "provisioning"
  const isArchived = sandbox.status === "archived"
  const isWakeable = isHibernating || isStopped

  return (
    <div
      className={cn(
        "bg-surface-container-low rounded-xl p-6 relative overflow-hidden group hover:bg-surface-container transition-all duration-300",
        glow,
        isArchived && "opacity-60 hover:opacity-100 bg-surface-container-lowest",
        className,
      )}
    >
      {/* Status badge + overflow menu */}
      <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
        <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border", status.bgColor, status.color, status.borderColor)}>
          <span className={cn("w-2 h-2 rounded-full", status.dotClass)} />
          {status.label}
        </span>
        {!isProvisioning && (onSSH || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition-all opacity-0 group-hover:opacity-100"
              >
                <MaterialIcon name="more_vert" className="text-lg" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {isActive && onSSH && (
                <DropdownMenuItem onClick={() => onSSH(sandbox.id)}>
                  <MaterialIcon name="vpn_key" className="text-base mr-2" />
                  SSH Info
                </DropdownMenuItem>
              )}
              {isActive && onSSH && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem onClick={() => onDelete(sandbox.id)} className="text-red-400 focus:text-red-400">
                  <MaterialIcon name="delete" className="text-base mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          {sandbox.imageIcon && (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-container-high">
              {sandbox.imageIcon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-white group-hover:text-md3-primary transition-colors truncate">
              {sandbox.name}
            </h3>
            {sandbox.nodeId && (
              <p className="text-on-surface-variant font-mono text-xs truncate">{sandbox.nodeId}</p>
            )}
          </div>
        </div>
      </div>

      {/* Resource meters or provisioning progress */}
      {isProvisioning ? (
        <div className="mb-8 mt-10">
          <p className="text-[10px] font-bold font-mono text-orange-400 mb-3 uppercase text-center animate-pulse tracking-widest">
            {sandbox.provisioningMessage ?? "Initializing..."}
          </p>
          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-orange-300 transition-all duration-500"
              style={{ width: `${sandbox.provisioningPercent ?? 50}%` }}
            />
          </div>
        </div>
      ) : !isArchived ? (
        <div className={cn("space-y-5 mb-8", !isActive && "opacity-40")}>
          <ResourceMeter label="CPU Usage" icon="memory" value={sandbox.cpuPercent ?? 0} />
          <ResourceMeter
            label="RAM Usage"
            icon="database"
            value={sandbox.ramUsed ?? 0}
            max={sandbox.ramTotal ?? 1}
            unit="GB"
          />
        </div>
      ) : (
        <div className="mb-6">
          {sandbox.archivedAt && (
            <p className="text-slate-500 font-mono text-[10px]">{sandbox.archivedAt}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onOpenIDE?.(sandbox.id)}
            className="flex items-center justify-center gap-2 py-2.5 bg-surface-container-high hover:bg-md3-primary hover:text-on-primary rounded-lg transition-all duration-300 text-xs font-bold shadow-sm"
          >
            <MaterialIcon name="open_in_new" className="text-sm" />
            Open IDE
          </button>
          <button
            type="button"
            onClick={() => onOpenTerminal?.(sandbox.id)}
            className="flex items-center justify-center gap-2 py-2.5 bg-surface-container-high hover:bg-slate-700 rounded-lg transition-all text-xs font-bold border border-outline-variant/10"
          >
            <MaterialIcon name="terminal" className="text-sm" />
            Terminal
          </button>
        </div>
      )}

      {isWakeable && (
        <button
          type="button"
          onClick={() => onWake?.(sandbox.id)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-md3-primary/10 text-md3-primary hover:bg-md3-primary hover:text-on-primary rounded-lg transition-all duration-300 text-xs font-black"
        >
          <MaterialIcon name="power_settings_new" className="text-sm" />
          Wake Sandbox
        </button>
      )}

      {isProvisioning && (
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-2 py-3 bg-surface-container-high text-on-surface-variant cursor-not-allowed rounded-lg text-xs font-bold border border-outline-variant/10"
        >
          Please Wait...
        </button>
      )}

      {isArchived && (
        <button
          type="button"
          onClick={() => onRestore?.(sandbox.id)}
          className="w-full py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all text-xs font-bold border border-slate-700/50"
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
        "border-2 border-dashed border-outline-variant/20 rounded-xl p-6 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-md3-primary/40 hover:bg-md3-primary/5 transition-all duration-300 w-full",
        className,
      )}
    >
      <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:bg-md3-primary/20 group-hover:text-md3-primary transition-all group-active:scale-90">
        <MaterialIcon name="add_box" className="text-3xl" />
      </div>
      <h4 className="font-bold text-slate-400 group-hover:text-white mb-1">New Environment</h4>
      <p className="text-xs text-slate-600">Instantiate a fresh compute node</p>
    </button>
  )
}
