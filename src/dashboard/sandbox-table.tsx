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
  /** Called when the user clicks "Delete". The consuming app should show a confirmation dialog before performing the deletion. */
  onDelete?: (id: string) => void
  /** @deprecated Use `onDelete` instead. */
  onMore?: (id: string) => void
  className?: string
}

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
      {name}
    </span>
  )
}

const statusColors: Record<SandboxStatus, { dot: string; text: string; bar: string }> = {
  running: { dot: "bg-green-400 animate-pulse", text: "text-green-400", bar: "bg-green-400" },
  hibernating: { dot: "bg-slate-500", text: "text-on-surface-variant", bar: "bg-slate-500" },
  provisioning: { dot: "bg-secondary-fixed animate-pulse", text: "text-secondary-fixed", bar: "bg-secondary-fixed" },
  stopped: { dot: "bg-slate-500", text: "text-slate-400", bar: "bg-slate-500" },
  failed: { dot: "bg-red-500", text: "text-red-400", bar: "bg-red-500" },
  archived: { dot: "bg-slate-600", text: "text-slate-500", bar: "bg-slate-600" },
}

function MiniMeter({ label, percent, className }: { label: string; percent: number; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
        <span className="font-bold">{label}</span>
        <span className="text-primary-fixed">{percent}%</span>
      </div>
      <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
        <div className="h-full bg-md3-primary rounded-full" style={{ width: `${percent}%` }} />
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
  onDelete,
  onMore,
  className,
}: SandboxTableProps) {
  const handleDelete = onDelete ?? onMore;
  const totalCount = total ?? sandboxes.length
  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full bg-surface-container-low rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50 border-b border-outline-variant/10">
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Sandbox Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Environment</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Resources</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {sandboxes.map((sb) => {
                const sc = statusColors[sb.status] ?? statusColors.stopped
                const isActive = sb.status === "running"
                const isHibernating = sb.status === "hibernating"
                const isStopped = sb.status === "stopped"
                const isProvisioning = sb.status === "provisioning"
                const isWakeable = isHibernating || isStopped
                return (
                  <tr key={sb.id} className="hover:bg-surface-container-highest/20 transition-colors group relative">
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
                        <span className="text-sm font-bold text-white group-hover:text-md3-primary transition-colors">{sb.name}</span>
                        {sb.nodeId && <span className="text-[10px] font-mono text-on-surface-variant">{sb.nodeId}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        {sb.imageIcon && (
                          <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
                            {sb.imageIcon}
                          </div>
                        )}
                        {sb.image && <span className="text-xs font-bold text-white">{sb.image}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {isActive ? (
                        <div className="space-y-3 w-48">
                          <MiniMeter label="CPU" percent={sb.cpuPercent ?? 0} />
                          <MiniMeter label="RAM" percent={sb.ramTotal ? Math.round(((sb.ramUsed ?? 0) / sb.ramTotal) * 100) : 0} />
                        </div>
                      ) : isProvisioning ? (
                        <div className="flex items-center gap-2 text-md3-primary/80 italic text-[10px] font-bold">
                          <MaterialIcon name="refresh" className="text-[14px] animate-spin" />
                          {sb.provisioningMessage ?? "Allocating nodes..."}
                        </div>
                      ) : (isHibernating || isStopped) ? (
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
                            <button type="button" onClick={() => onOpenIDE?.(sb.id)} className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition-all active:scale-90" title="Open IDE">
                              <MaterialIcon name="code" className="text-[20px]" />
                            </button>
                            <button type="button" onClick={() => onOpenTerminal?.(sb.id)} className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition-all active:scale-90" title="Terminal">
                              <MaterialIcon name="terminal" className="text-[20px]" />
                            </button>
                          </>
                        )}
                        {isWakeable && (
                          <button type="button" onClick={() => onWake?.(sb.id)} className="px-3 py-1.5 rounded-lg border border-md3-primary/30 text-md3-primary text-[10px] font-bold uppercase tracking-wider hover:bg-md3-primary/10 active:scale-95 transition-all">
                            Wake Up
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="p-2 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition-all active:scale-90">
                              <MaterialIcon name="more_vert" className="text-[20px]" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[160px]">
                            {isActive && onSSH && (
                              <DropdownMenuItem onClick={() => onSSH(sb.id)}>
                                <MaterialIcon name="vpn_key" className="text-base mr-2" />
                                SSH Info
                              </DropdownMenuItem>
                            )}
                            {isActive && onSSH && handleDelete && <DropdownMenuSeparator />}
                            {handleDelete && (
                              <DropdownMenuItem onClick={() => handleDelete(sb.id)} className="text-red-400 focus:text-red-400">
                                <MaterialIcon name="delete" className="text-base mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center text-on-surface-variant text-xs font-medium gap-4">
          <p>Showing {sandboxes.length} of {totalCount} active sandboxes</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-outline-variant/10 hover:bg-surface-container-high transition-colors disabled:opacity-30">
              <MaterialIcon name="chevron_left" className="text-[18px]" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange?.(p)}
                className={cn(
                  "px-3 py-1 rounded-lg transition-colors",
                  p === page ? "bg-md3-primary/10 text-md3-primary border border-md3-primary/20" : "hover:bg-surface-container-high",
                )}
              >
                {p}
              </button>
            ))}
            <button type="button" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border border-outline-variant/10 hover:bg-surface-container-high transition-colors disabled:opacity-30">
              <MaterialIcon name="chevron_right" className="text-[18px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
