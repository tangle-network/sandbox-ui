"use client"

import * as React from "react"
import { Terminal, Code2, Key, Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "../lib/utils"
import type { SandboxCardData, SandboxStatus } from "./sandbox-card"

export interface SandboxTableProps {
  sandboxes: SandboxCardData[]
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  onOpenIDE?: (id: string) => void
  onOpenTerminal?: (id: string) => void
  onSSH?: (id: string) => void
  onWake?: (id: string) => void
  onMore?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}

const statusColors: Record<SandboxStatus, { dot: string; text: string; bar: string }> = {
  running: { dot: "bg-[var(--code-success)] animate-pulse", text: "text-[var(--code-success)]", bar: "bg-[var(--code-success)]" },
  hibernating: { dot: "bg-[hsl(var(--muted-foreground))]", text: "text-muted-foreground", bar: "bg-[hsl(var(--muted-foreground))]" },
  provisioning: { dot: "bg-primary animate-pulse", text: "text-primary", bar: "bg-primary" },
  creating: { dot: "bg-primary animate-pulse", text: "text-primary", bar: "bg-primary" },
  stopped: { dot: "bg-[hsl(var(--muted-foreground))]", text: "text-foreground", bar: "bg-[hsl(var(--muted-foreground))]" },
  failed: { dot: "bg-[var(--code-error)]", text: "text-[var(--code-error)]", bar: "bg-[var(--code-error)]" },
  archived: { dot: "bg-[var(--border-default)]", text: "text-muted-foreground", bar: "bg-[var(--border-default)]" },
}

function MiniMeter({ label, percent, className }: { label: string; percent: number; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
        <span className="font-bold">{label}</span>
        <span className="text-primary">{percent}%</span>
      </div>
      <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function SandboxTable({
  sandboxes,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  onOpenIDE,
  onOpenTerminal,
  onSSH,
  onWake,
  onMore,
  onDelete,
  className,
}: SandboxTableProps) {
  const totalCount = total ?? sandboxes.length
  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full bg-card rounded-2xl overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sandbox Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Environment</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resources</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {sandboxes.map((sb) => {
                const sc = statusColors[sb.status] ?? statusColors.stopped
                const isActive = sb.status === "running"
                const isHibernating = sb.status === "hibernating"
                const isProvisioning = sb.status === "provisioning"
                return (
                  <tr key={sb.id} className="hover:bg-muted/50 transition-colors group relative">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={cn("flex h-2.5 w-2.5 rounded-full", sc.dot)} />
                        <span className={cn("text-xs font-bold uppercase tracking-wide", sc.text)}>
                          {sb.status.charAt(0).toUpperCase() + sb.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{sb.name}</span>
                        {sb.nodeId && <span className="text-[10px] font-mono text-muted-foreground">{sb.nodeId}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        {sb.imageIcon && (
                          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                            {sb.imageIcon}
                          </div>
                        )}
                        {sb.image && <span className="text-xs font-bold text-foreground">{sb.image}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {isActive ? (
                        <div className="space-y-3 w-48">
                          <MiniMeter label="CPU" percent={sb.cpuPercent ?? 0} />
                          <MiniMeter label="RAM" percent={sb.ramTotal ? Math.round(((sb.ramUsed ?? 0) / sb.ramTotal) * 100) : 0} />
                        </div>
                      ) : isProvisioning ? (
                        <div className="flex items-center gap-2 text-primary italic text-[10px] font-bold">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          {sb.provisioningMessage ?? "Allocating nodes..."}
                        </div>
                      ) : isHibernating ? (
                        <div className="space-y-3 w-48 opacity-30">
                          <MiniMeter label="CPU" percent={0} />
                          <MiniMeter label="RAM" percent={0} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isActive && (
                          <>
                            <button type="button" onClick={() => onOpenIDE?.(sb.id)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-90" title="Open IDE">
                              <Code2 className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => onOpenTerminal?.(sb.id)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-90" title="Terminal">
                              <Terminal className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => onSSH?.(sb.id)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-90" title="SSH">
                              <Key className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {isHibernating && (
                          <button type="button" onClick={() => onWake?.(sb.id)} className="px-3 py-1.5 rounded-lg border border-border text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--accent-surface-soft)] active:scale-95 transition-all">
                            Wake Up
                          </button>
                        )}
                        {onMore && (
                          <button type="button" onClick={() => onMore(sb.id)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-90">
                            <Code2 className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button type="button" onClick={() => onDelete(sb.id)} className="p-2 rounded-lg hover:bg-[var(--surface-danger-bg)] text-muted-foreground hover:text-[var(--surface-danger-text)] transition-all active:scale-90" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center text-muted-foreground text-xs font-medium gap-4">
          <p>Showing {sandboxes.length} of {totalCount} active sandboxes</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange?.(p)}
                className={cn(
                  "px-3 py-1 rounded-lg transition-colors",
                  p === page ? "bg-[var(--accent-surface-soft)] text-primary border border-border" : "hover:bg-muted/50",
                )}
              >
                {p}
              </button>
            ))}
            <button type="button" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
