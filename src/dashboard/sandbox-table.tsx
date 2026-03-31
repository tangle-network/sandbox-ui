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
  hibernating: { dot: "bg-[var(--text-muted)]", text: "text-[var(--text-muted)]", bar: "bg-[var(--text-muted)]" },
  provisioning: { dot: "bg-[var(--brand-cool)] animate-pulse", text: "text-[var(--brand-cool)]", bar: "bg-[var(--brand-cool)]" },
  stopped: { dot: "bg-[var(--text-muted)]", text: "text-[var(--text-secondary)]", bar: "bg-[var(--text-muted)]" },
  failed: { dot: "bg-[var(--code-error)]", text: "text-[var(--code-error)]", bar: "bg-[var(--code-error)]" },
  archived: { dot: "bg-[var(--border-default)]", text: "text-[var(--text-muted)]", bar: "bg-[var(--border-default)]" },
}

function MiniMeter({ label, percent, className }: { label: string; percent: number; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
        <span className="font-bold">{label}</span>
        <span className="text-[var(--brand-cool)]">{percent}%</span>
      </div>
      <div className="h-1.5 w-full bg-[var(--depth-1)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--brand-cool)] rounded-full" style={{ width: `${percent}%` }} />
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
      <div className="w-full bg-[var(--depth-2)] rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--depth-1)] border-b border-[var(--border-subtle)]">
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Sandbox Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Environment</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Resources</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {sandboxes.map((sb) => {
                const sc = statusColors[sb.status] ?? statusColors.stopped
                const isActive = sb.status === "running"
                const isHibernating = sb.status === "hibernating"
                const isProvisioning = sb.status === "provisioning"
                return (
                  <tr key={sb.id} className="hover:bg-[var(--depth-3)] transition-colors group relative">
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
                        <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-cool)] transition-colors">{sb.name}</span>
                        {sb.nodeId && <span className="text-[10px] font-mono text-[var(--text-muted)]">{sb.nodeId}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        {sb.imageIcon && (
                          <div className="w-8 h-8 rounded-lg bg-[var(--depth-3)] flex items-center justify-center">
                            {sb.imageIcon}
                          </div>
                        )}
                        {sb.image && <span className="text-xs font-bold text-[var(--text-primary)]">{sb.image}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {isActive ? (
                        <div className="space-y-3 w-48">
                          <MiniMeter label="CPU" percent={sb.cpuPercent ?? 0} />
                          <MiniMeter label="RAM" percent={sb.ramTotal ? Math.round(((sb.ramUsed ?? 0) / sb.ramTotal) * 100) : 0} />
                        </div>
                      ) : isProvisioning ? (
                        <div className="flex items-center gap-2 text-[var(--brand-cool)] italic text-[10px] font-bold">
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
                            <button type="button" onClick={() => onOpenIDE?.(sb.id)} className="p-2 rounded-lg hover:bg-[var(--depth-4)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90" title="Open IDE">
                              <Code2 className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => onOpenTerminal?.(sb.id)} className="p-2 rounded-lg hover:bg-[var(--depth-4)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90" title="Terminal">
                              <Terminal className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => onSSH?.(sb.id)} className="p-2 rounded-lg hover:bg-[var(--depth-4)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90" title="SSH">
                              <Key className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {isHibernating && (
                          <button type="button" onClick={() => onWake?.(sb.id)} className="px-3 py-1.5 rounded-lg border border-[var(--border-accent)] text-[var(--brand-cool)] text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--accent-surface-soft)] active:scale-95 transition-all">
                            Wake Up
                          </button>
                        )}
                        {onMore && (
                          <button type="button" onClick={() => onMore(sb.id)} className="p-2 rounded-lg hover:bg-[var(--depth-4)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90">
                            <Code2 className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button type="button" onClick={() => onDelete(sb.id)} className="p-2 rounded-lg hover:bg-[var(--surface-danger-bg)] text-[var(--text-muted)] hover:text-[var(--surface-danger-text)] transition-all active:scale-90" title="Delete">
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
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center text-[var(--text-muted)] text-xs font-medium gap-4">
          <p>Showing {sandboxes.length} of {totalCount} active sandboxes</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--depth-3)] transition-colors disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange?.(p)}
                className={cn(
                  "px-3 py-1 rounded-lg transition-colors",
                  p === page ? "bg-[var(--accent-surface-soft)] text-[var(--brand-cool)] border border-[var(--border-accent)]" : "hover:bg-[var(--depth-3)]",
                )}
              >
                {p}
              </button>
            ))}
            <button type="button" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--depth-3)] transition-colors disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
