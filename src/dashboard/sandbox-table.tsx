"use client"

import * as React from "react"
import {
  Activity,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Key,
  MoreVertical,
  Play,
  PowerOff,
  RefreshCw,
  Terminal,
  Trash2,
  User,
  Users,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { canAdminSandbox, type SandboxCardData, type SandboxStatus } from "./sandbox-card"
import { focusRing, focusRingInset } from "@tangle-network/ui/utils"

export interface SandboxTableProps {
  sandboxes: SandboxCardData[]
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  onOpenIDE?: (id: string) => void
  onOpenTerminal?: (id: string) => void
  onSSH?: (id: string) => void
  /**
   * Resume a stopped / failed / archived sandbox, or wake a hibernating
   * one. Surfaces an explicit "Resume" (or "Wake Up" for `hibernating`)
   * button in the actions cell and makes the row body clickable for any
   * status this prop covers. Preferred over `onWake` for new code — the
   * two are kept as separate props only so existing consumers that
   * wired up `onWake` for hibernating continue to work.
   */
  onResume?: (id: string) => void
  /**
   * @deprecated Use `onResume` instead. Retained for back-compat:
   * when `onResume` is not provided but `onWake` is, hibernating rows
   * will still surface a Wake action. New consumers should pass
   * `onResume` so stopped / failed / archived rows also get a start
   * affordance.
   */
  onWake?: (id: string) => void
  onMore?: (id: string) => void
  /** Fired on the user's first click; the caller owns the confirmation step. */
  onDelete?: (id: string) => void
  onStop?: (id: string) => void
  onKeepAlive?: (id: string) => void
  onUsage?: (id: string) => void
  onHealth?: (id: string) => void
  onFork?: (id: string) => void
  className?: string
}

const statusColors: Record<SandboxStatus, { dot: string; text: string; bar: string }> = {
  running: { dot: "bg-[var(--code-success)] animate-pulse", text: "text-[var(--code-success)]", bar: "bg-[var(--code-success)]" },
  hibernating: { dot: "bg-muted-foreground", text: "text-muted-foreground", bar: "bg-muted-foreground" },
  provisioning: { dot: "bg-primary animate-pulse", text: "text-[var(--accent-text)]", bar: "bg-primary" },
  creating: { dot: "bg-primary animate-pulse", text: "text-[var(--accent-text)]", bar: "bg-primary" },
  stopped: { dot: "bg-muted-foreground", text: "text-foreground", bar: "bg-muted-foreground" },
  failed: { dot: "bg-[var(--code-error)]", text: "text-[var(--code-error)]", bar: "bg-[var(--code-error)]" },
  archived: { dot: "bg-border", text: "text-muted-foreground", bar: "bg-border" },
}

// A row is "resumable" when there's a meaningful start-it action a user
// can take. `running` is already up; `provisioning` / `creating` are
// mid-transition and clicking a start there would either 409 or stack
// requests. Every other status (stopped, failed, hibernating, archived)
// goes through the same `/resume` API endpoint downstream.
function isResumable(status: SandboxStatus): boolean {
  return status !== "running" && status !== "provisioning" && status !== "creating"
}

function MiniMeter({ label, percent, className }: { label: string; percent?: number; className?: string }) {
  const hasValue = percent != null && Number.isFinite(percent)

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
        <span className="font-bold">{label}</span>
        <span className={hasValue ? "text-[var(--accent-text)]" : "text-muted-foreground"}>
          {hasValue ? String(percent) + "%" : "Unknown"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {hasValue && (
          <div className="h-full rounded-full bg-primary" style={{ width: String(percent) + "%" }} />
        )}
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: SandboxStatus }) {
  const sc = statusColors[status] ?? statusColors.stopped

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        className={cn("flex h-2.5 w-2.5 shrink-0 rounded-full", sc.dot)}
        aria-hidden="true"
        {...(sc.dot.includes("animate-") ? { "data-motion": "essential" } : {})}
      />
      <span className={cn("text-xs font-bold uppercase tracking-wide", sc.text)}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  )
}

function SandboxResources({ sandbox, className }: { sandbox: SandboxCardData; className?: string }) {
  if (sandbox.status === "running") {
    const ramPercent = sandbox.ramUsed != null && sandbox.ramTotal != null && sandbox.ramTotal > 0
      ? Math.round((sandbox.ramUsed / sandbox.ramTotal) * 100)
      : undefined

    return (
      <div className={cn("min-w-0 space-y-3", className)}>
        <MiniMeter label="CPU" percent={sandbox.cpuPercent} />
        <MiniMeter label="RAM" percent={ramPercent} />
      </div>
    )
  }

  if (sandbox.status === "provisioning" || sandbox.status === "creating") {
    return (
      <div className={cn("flex min-w-0 items-center gap-2 text-[var(--accent-text)] italic text-[10px] font-bold", className)}>
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" data-motion="essential" />
        <span className="min-w-0 truncate" title={sandbox.provisioningMessage ?? "Allocating nodes..."}>
          {sandbox.provisioningMessage ?? "Allocating nodes..."}
        </span>
      </div>
    )
  }

  if (sandbox.status === "hibernating") {
    return <p className={cn("text-xs text-muted-foreground", className)}>Not running</p>
  }

  return null
}

function getPageItems(page: number, totalPages: number): Array<number | "start-ellipsis" | "end-ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  let start = Math.max(2, page - 1)
  let end = Math.min(totalPages - 1, page + 1)

  if (page <= 3) {
    start = 2
    end = 5
  } else if (page >= totalPages - 2) {
    start = totalPages - 4
    end = totalPages - 1
  }

  const items: Array<number | "start-ellipsis" | "end-ellipsis"> = [1]
  if (start > 2) items.push("start-ellipsis")
  for (let current = start; current <= end; current += 1) items.push(current)
  if (end < totalPages - 1) items.push("end-ellipsis")
  items.push(totalPages)
  return items
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
  onResume,
  onWake,
  onMore,
  onDelete,
  onStop,
  onKeepAlive,
  onUsage,
  onHealth,
  onFork,
  className,
}: SandboxTableProps) {
  const totalCount = Math.max(0, total ?? sandboxes.length)
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 10
  const totalPages = Math.ceil(totalCount / safePageSize)
  const requestedPage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  const currentPage = Math.min(requestedPage, Math.max(1, totalPages))
  const rangeStart = totalCount === 0 || sandboxes.length === 0 ? 0 : (currentPage - 1) * safePageSize + 1
  const rangeEnd = rangeStart === 0 ? 0 : Math.min(rangeStart + sandboxes.length - 1, totalCount)
  const hasTeamSandboxes = sandboxes.some((sb) => sb.team !== undefined)

  // Hibernating is the one status that historically wired up to `onWake`.
  // For that status we fall back to `onWake` when `onResume` is absent,
  // so the v0.16 -> v0.17 upgrade is non-breaking for consumers that
  // only passed `onWake`.
  const resolveResumeHandler = (status: SandboxStatus): ((id: string) => void) | undefined => {
    if (onResume) return onResume
    if (status === "hibernating") return onWake
    return undefined
  }

  const resolveRowClick = (sb: SandboxCardData): (() => void) | undefined => {
    if (sb.status === "running") {
      return onOpenIDE ? () => onOpenIDE(sb.id) : undefined
    }
    if (!isResumable(sb.status)) return undefined
    const handler = resolveResumeHandler(sb.status)
    return handler ? () => handler(sb.id) : undefined
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full bg-surface-container rounded-2xl overflow-hidden border border-[var(--md3-outline-variant)]">
        <div className={cn("max-h-[min(60vh,35rem)] overflow-x-hidden overflow-y-auto", focusRingInset)} role="region" aria-label="Sandbox list" tabIndex={0}>
          <table className="w-full table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-container-high border-b border-[var(--md3-outline-variant)]">
                <th scope="col" className="hidden w-36 px-3 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Status</th>
                <th scope="col" className="px-3 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:px-6">Sandbox</th>
                {hasTeamSandboxes && <th scope="col" className="hidden w-32 px-3 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Scope</th>}
                <th scope="col" className="hidden w-28 px-3 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Environment</th>
                <th scope="col" className="hidden w-48 px-3 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Resources</th>
                <th scope="col" className="w-28 px-2 py-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:w-72 xl:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sandboxes.map((sb) => {
                const isActive = sb.status === "running"
                const isHibernating = sb.status === "hibernating"
                const isProvisioning = sb.status === "provisioning" || sb.status === "creating"
                const resumeHandler = isResumable(sb.status) ? resolveResumeHandler(sb.status) : undefined
                const onRowClick = resolveRowClick(sb)
                const resumeLabel = isHibernating ? "Wake Up" : "Resume"
                // Action buttons sit inside the clickable row. Without
                // this, a click on the trash icon would bubble up and
                // also fire the row-click handler — accidentally
                // resuming a sandbox the user is trying to delete.
                const stopRowClick = (e: React.MouseEvent) => e.stopPropagation()
                return (
                  // onClick is a sighted-user convenience only. We
                  // deliberately do NOT add role="button" / tabIndex /
                  // an onKeyDown handler to the row — overriding a
                  // <tr>'s implicit row role with "button" collapses
                  // the per-cell announcements (Status, Environment,
                  // Resources…) that screen-reader users navigate
                  // through. Keyboard and assistive-tech users reach
                  // the same actions through the real <button>
                  // elements inside the actions cell (Resume, Open
                  // IDE, Delete, …), which keep their native
                  // semantics. Mouse users get the click-anywhere
                  // affordance; nobody loses access.
                  <tr
                    key={sb.id}
                    className={cn(
                      "group relative transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-surface-container-high" : "hover:bg-surface-container-high",
                    )}
                    onClick={onRowClick}
                  >
                    <td className="hidden px-3 py-4 align-top xl:table-cell xl:w-36 xl:px-4 xl:py-5">
                      <StatusIndicator status={sb.status} />
                    </td>
                    <td className="min-w-0 px-3 py-4 align-top xl:px-6 xl:py-5">
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <div className="shrink-0 xl:hidden">
                            <StatusIndicator status={sb.status} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block min-w-0 truncate text-sm font-bold text-foreground transition-colors group-hover:text-[var(--accent-text)]" title={sb.name} aria-label={sb.name}>{sb.name}</span>
                            {sb.nodeId && <span className="block min-w-0 truncate text-[10px] font-mono text-muted-foreground" title={sb.nodeId}>{sb.nodeId}</span>}
                          </div>
                        </div>
                        <div className="grid min-w-0 gap-1 text-[11px] xl:hidden">
                          {hasTeamSandboxes && (
                            <div className="flex min-w-0 gap-2">
                              <span className="shrink-0 text-muted-foreground">Scope</span>
                              {sb.team ? (
                                <span className="min-w-0 truncate text-foreground" title={"Shared with " + (sb.team.name ?? "Team") + " \u00b7 " + sb.team.role}>
                                  {sb.team.name ?? "Team"} - {sb.team.role}
                                </span>
                              ) : (
                                <span className="text-foreground">Personal</span>
                              )}
                            </div>
                          )}
                          {(sb.customImage ?? sb.image) && (
                            <div className="flex min-w-0 gap-2">
                              <span className="shrink-0 text-muted-foreground">Environment</span>
                              <span className="min-w-0 truncate text-foreground" title={sb.customImage ?? sb.image}>
                                {sb.customImage ?? sb.image}
                              </span>
                            </div>
                          )}
                          {(isActive || isProvisioning || isHibernating) && (
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="text-muted-foreground">Resources</span>
                              <SandboxResources sandbox={sb} />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {hasTeamSandboxes && (
                      <td className="hidden px-3 py-4 align-top xl:table-cell xl:px-4 xl:py-5">
                        {sb.team ? (
                          <div
                            className="inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-full bg-[var(--accent-surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)]"
                            title={"Shared with " + (sb.team.name ?? "Team") + " \u00b7 " + sb.team.role}
                          >
                            <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 truncate">{sb.team.name ?? "Team"}</span>
                            <span className="shrink-0 font-normal text-muted-foreground">
                              - {sb.team.role}
                            </span>
                          </div>
                        ) : (
                          <div
                            className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                            title="Personal sandbox"
                          >
                            <User className="h-3 w-3" aria-hidden="true" />
                            Personal
                          </div>
                        )}
                      </td>
                    )}
                    <td className="hidden px-3 py-4 align-top xl:table-cell xl:px-4 xl:py-5">
                      <div className="flex min-w-0 items-center gap-2">
                        {sb.imageIcon && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
                            {sb.imageIcon}
                          </div>
                        )}
                        {(sb.customImage ?? sb.image) && (
                          <span className="min-w-0 truncate text-xs font-bold text-foreground" title={sb.customImage ?? sb.image}>
                            {sb.customImage ?? sb.image}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-3 py-4 align-top xl:table-cell xl:px-4 xl:py-5">
                      <SandboxResources sandbox={sb} />
                    </td>
                    <td className="w-28 px-2 py-3 text-right align-top xl:w-72 xl:px-4 xl:py-5">
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                        {isActive && (
                          <>
                            <button type="button" onClick={(e) => { stopRowClick(e); onOpenIDE?.(sb.id) }} className={cn("min-h-11 min-w-11 shrink-0 p-2 rounded-lg hover:bg-surface-container-high text-muted-foreground hover:text-foreground transition-all active:scale-90", focusRing)} aria-label="Open IDE" title="Open IDE">
                              <Code2 className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={(e) => { stopRowClick(e); onOpenTerminal?.(sb.id) }} className={cn("min-h-11 min-w-11 shrink-0 p-2 rounded-lg hover:bg-surface-container-high text-muted-foreground hover:text-foreground transition-all active:scale-90", focusRing)} aria-label="Open terminal" title="Terminal">
                              <Terminal className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={(e) => { stopRowClick(e); onSSH?.(sb.id) }} className={cn("min-h-11 min-w-11 shrink-0 p-2 rounded-lg hover:bg-surface-container-high text-muted-foreground hover:text-foreground transition-all active:scale-90", focusRing)} aria-label="Open SSH details" title="SSH">
                              <Key className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {resumeHandler && (
                          <button
                            type="button"
                            onClick={(e) => { stopRowClick(e); resumeHandler(sb.id) }}
                            className={cn("inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--md3-outline-variant)] text-[var(--accent-text)] text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--accent-surface-soft)] active:scale-95 transition-all", focusRing)}
                            title={resumeLabel}
                          >
                            <Play className="h-3 w-3" />
                            {resumeLabel}
                          </button>
                        )}
                        {(() => {
                          // Portaled menu items still bubble through React's
                          // synthetic event tree to the row's onClick.
                          const runItem = (handler: (id: string) => void) => (e: React.MouseEvent) => {
                            e.stopPropagation()
                            handler(sb.id)
                          }
                          const overflowSections: React.ReactNode[][] = []
                          if (isActive) {
                            const lifecycle: React.ReactNode[] = []
                            if (onStop) lifecycle.push(
                              <DropdownMenuItem key="stop" onClick={runItem(onStop)}>
                                <PowerOff className="mr-2 h-4 w-4" /> Stop Sandbox
                              </DropdownMenuItem>,
                            )
                            if (onKeepAlive) lifecycle.push(
                              <DropdownMenuItem key="keep-alive" onClick={runItem(onKeepAlive)}>
                                <Clock className="mr-2 h-4 w-4" /> Keep Alive
                              </DropdownMenuItem>,
                            )
                            if (lifecycle.length) overflowSections.push(lifecycle)

                            const observability: React.ReactNode[] = []
                            if (onUsage) observability.push(
                              <DropdownMenuItem key="usage" onClick={runItem(onUsage)}>
                                <BarChart2 className="mr-2 h-4 w-4" /> View Usage
                              </DropdownMenuItem>,
                            )
                            if (onHealth) observability.push(
                              <DropdownMenuItem key="health" onClick={runItem(onHealth)}>
                                <Activity className="mr-2 h-4 w-4" /> Health Check
                              </DropdownMenuItem>,
                            )
                            if (observability.length) overflowSections.push(observability)

                            if (onFork) overflowSections.push([
                              <DropdownMenuItem key="fork" onClick={runItem(onFork)}>
                                <Copy className="mr-2 h-4 w-4" /> Fork Sandbox
                              </DropdownMenuItem>,
                            ])
                          } else if (isResumable(sb.status)) {
                            if (onFork) overflowSections.push([
                              <DropdownMenuItem key="fork" onClick={runItem(onFork)}>
                                <Copy className="mr-2 h-4 w-4" /> Fork Sandbox
                              </DropdownMenuItem>,
                            ])
                          }
                          if (onMore) overflowSections.push([
                            <DropdownMenuItem key="view-details" onClick={runItem(onMore)}>
                              <ExternalLink className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>,
                          ])

                          if (overflowSections.length === 0) return null
                          return (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  onClick={stopRowClick}
                                  className={`min-h-11 min-w-11 shrink-0 p-2 rounded-lg hover:bg-surface-container-high text-muted-foreground hover:text-foreground transition-all active:scale-90 ${focusRing}`}
                                  aria-label={`More actions for ${sb.name}`}
                                  title="More actions"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[180px]">
                                {overflowSections.map((section, sectionIdx) => (
                                  <React.Fragment key={sectionIdx}>
                                    {sectionIdx > 0 && <DropdownMenuSeparator />}
                                    {section}
                                  </React.Fragment>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )
                        })()}
                        {onDelete && canAdminSandbox(sb) && (
                          <button type="button" aria-label={`Delete ${sb.name}`} onClick={(e) => { stopRowClick(e); onDelete(sb.id) }} className={`min-h-11 min-w-11 shrink-0 p-2 rounded-lg hover:bg-[var(--surface-danger-bg)] text-muted-foreground hover:text-[var(--surface-danger-text)] transition-all active:scale-90 ${focusRing}`} title="Delete">
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
        <div className="mt-6 flex flex-col items-center justify-between gap-4 text-xs font-medium text-muted-foreground sm:flex-row">
          <p>
            {rangeStart === 0 ? <>Showing 0 of {totalCount} sandboxes</> : <>Showing {rangeStart}-{rangeEnd} of {totalCount} sandboxes</>}
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Sandbox pages">
            <button
              type="button"
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={!onPageChange || currentPage <= 1}
              aria-label="Previous page"
              className={cn("min-h-11 min-w-11 rounded-lg border border-[var(--md3-outline-variant)] p-2 transition-colors hover:bg-surface-container-high disabled:opacity-30", focusRing)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {getPageItems(currentPage, totalPages).map((item) => (
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange?.(item)}
                  disabled={!onPageChange}
                  aria-label={"Go to page " + item}
                  aria-current={item === currentPage ? "page" : undefined}
                  className={cn(
                    "min-h-11 min-w-11 rounded-lg px-2 py-1 transition-colors",
                    item === currentPage
                      ? "border border-[var(--md3-outline)] bg-[var(--accent-surface-soft)] text-[var(--accent-text)]"
                      : "hover:bg-surface-container-high",
                    !onPageChange && "cursor-not-allowed opacity-30",
                  )}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="px-1" aria-hidden="true">...</span>
              )
            ))}
            <button
              type="button"
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={!onPageChange || currentPage >= totalPages}
              aria-label="Next page"
              className={cn("min-h-11 min-w-11 rounded-lg border border-[var(--md3-outline-variant)] p-2 transition-colors hover:bg-surface-container-high disabled:opacity-30", focusRing)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
