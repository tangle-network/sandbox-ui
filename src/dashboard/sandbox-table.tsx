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
import { SandboxStatusPill } from "./sandbox-status"

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


// A row is "resumable" when there's a meaningful start-it action a user
// can take. `running` is already up; `provisioning` / `creating` are
// mid-transition and clicking a start there would either 409 or stack
// requests. Every other status (stopped, failed, hibernating, archived)
// goes through the same `/resume` API endpoint downstream.
function isResumable(status: SandboxStatus): boolean {
  return status !== "running" && status !== "provisioning" && status !== "creating" && status !== "expired"
}

function validPercent(value: number | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0 && value <= 100
}

function ramPercent(sandbox: SandboxCardData): number | undefined {
  if (sandbox.ramUsed == null || sandbox.ramTotal == null || !Number.isFinite(sandbox.ramUsed) || !Number.isFinite(sandbox.ramTotal) || sandbox.ramTotal <= 0) return undefined
  const value = sandbox.ramUsed / sandbox.ramTotal * 100
  return validPercent(value) ? Math.round(value) : undefined
}

function MiniMeter({ label, percent }: { label: string; percent?: number }) {
  if (!validPercent(percent)) return null
  return (
    <div className="min-w-0 flex-1 space-y-1.5" aria-label={`${label} ${percent}%`}>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span><span className="tabular-nums text-foreground">{percent}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: SandboxStatus }) {
  // Bare: a toned glyph beside the label, which is all a dense row needs.
  return <SandboxStatusPill status={status} bare />
}

function SandboxResources({ sandbox }: { sandbox: SandboxCardData }) {
  if (sandbox.status !== "running") return null
  const ram = ramPercent(sandbox)
  if (!validPercent(sandbox.cpuPercent) && ram == null) return null
  return <div className="flex min-w-0 items-center gap-4">
    <MiniMeter label="CPU" percent={sandbox.cpuPercent} />
    <MiniMeter label="RAM" percent={ram} />
  </div>
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
  const hasResources = sandboxes.some((sb) => sb.status === "running" && (validPercent(sb.cpuPercent) || ramPercent(sb) != null))

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
      <div className="w-full bg-surface-container rounded-xl overflow-hidden border border-[var(--md3-outline-variant)]">
        <div className={cn("max-h-[min(60vh,35rem)] overflow-x-hidden overflow-y-auto", focusRingInset)} role="region" aria-label="Sandbox list" tabIndex={0}>
          <table className="w-full table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-container-high border-b border-[var(--md3-outline-variant)]">
                <th scope="col" className="hidden w-36 px-4 py-3 text-xs font-medium text-muted-foreground md:table-cell">Status</th>
                <th scope="col" className="px-4 py-3 text-xs font-medium text-muted-foreground">Sandbox</th>
                {hasTeamSandboxes && <th scope="col" className="hidden w-40 px-4 py-3 text-xs font-medium text-muted-foreground xl:table-cell">Scope</th>}
                {hasResources && <th scope="col" className="hidden w-52 px-4 py-3 text-xs font-medium text-muted-foreground lg:table-cell">Resources</th>}
                <th scope="col" className="w-44 px-3 py-3 text-right text-xs font-medium text-muted-foreground sm:w-48 sm:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sandboxes.map((sb) => {
                const isActive = sb.status === "running"
                const isHibernating = sb.status === "hibernating"
                const resumeHandler = isResumable(sb.status) ? resolveResumeHandler(sb.status) : undefined
                const onRowClick = resolveRowClick(sb)
                const resumeLabel = isHibernating ? "Wake Up" : "Resume"
                // Action buttons sit inside the clickable row. Without
                // this, a click on the trash icon would bubble up and
                // also fire the row-click handler — accidentally
                // resuming a sandbox the user is trying to delete.
                const stopRowClick = (e: React.MouseEvent) => e.stopPropagation()
                return (
                  // Keep native table semantics; keyboard users use the real buttons.
                  <tr
                    key={sb.id}
                    className={cn(
                      "group relative h-[72px] transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-surface-container-high" : "hover:bg-surface-container-high",
                    )}
                    onClick={onRowClick}
                  >
                    <td className="hidden px-4 py-3 align-middle md:table-cell">
                      <StatusIndicator status={sb.status} />
                    </td>
                    <td className="min-w-0 px-4 py-3 align-middle">
                      <div className="min-w-0 space-y-1">
                        <span className="block truncate text-sm font-semibold text-foreground" title={sb.name} aria-label={sb.name}>{sb.name}</span>
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                          <span className="md:hidden"><StatusIndicator status={sb.status} /></span>
                          {sb.nodeId && <span className="hidden truncate font-mono text-xs md:block" title={sb.nodeId}>{sb.nodeId}</span>}
                          {hasTeamSandboxes && <span className="truncate xl:hidden" title={sb.team ? `${sb.team.name ?? "Team"} · ${sb.team.role}` : "Personal"}>{sb.team ? `${sb.team.name ?? "Team"} · ${sb.team.role}` : "Personal"}</span>}
                        </div>
                      </div>
                    </td>
                    {hasTeamSandboxes && (
                      <td className="hidden px-4 py-3 align-middle xl:table-cell">
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
                    {hasResources && <td className="hidden px-4 py-3 align-middle lg:table-cell"><SandboxResources sandbox={sb} /></td>}
                    <td className="w-44 px-3 py-3 text-right align-middle sm:w-48 sm:px-4">
                      <div className="flex min-w-0 items-center justify-end gap-2">
                        {isActive && onOpenIDE && (
                          <button type="button" onClick={(e) => { stopRowClick(e); onOpenIDE(sb.id) }} className={cn("inline-flex min-h-11 shrink-0 whitespace-nowrap items-center justify-center gap-2 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-surface-soft)] px-3 text-sm font-semibold text-[var(--accent-text)] shadow-sm transition-colors hover:bg-[var(--accent-surface-strong)]", focusRing)} aria-label="Open IDE" title="Open IDE">
                            <Code2 className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Open</span>
                          </button>
                        )}
                        {resumeHandler && (
                          <button
                            type="button"
                            onClick={(e) => { stopRowClick(e); resumeHandler(sb.id) }}
                            className={cn("inline-flex min-h-11 shrink-0 whitespace-nowrap items-center justify-center gap-1.5 px-3 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-[var(--accent-text)] text-sm font-semibold shadow-sm hover:bg-[var(--accent-surface-strong)] transition-colors", focusRing)}
                            title={resumeLabel}
                          >
                            <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
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
                            const access: React.ReactNode[] = []
                            if (onOpenTerminal) access.push(<DropdownMenuItem key="terminal" onClick={runItem(onOpenTerminal)}><Terminal className="mr-2 h-4 w-4" /> Open terminal</DropdownMenuItem>)
                            if (onSSH) access.push(<DropdownMenuItem key="ssh" onClick={runItem(onSSH)}><Key className="mr-2 h-4 w-4" /> SSH details</DropdownMenuItem>)
                            if (access.length) overflowSections.push(access)
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

                          if (onDelete && canAdminSandbox(sb)) overflowSections.push([
                            <DropdownMenuItem key="delete" onClick={runItem(onDelete)} className="text-destructive focus:text-destructive" aria-label={`Delete ${sb.name}`}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>,
                          ])
                          if (overflowSections.length === 0) return null
                          return (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  onClick={stopRowClick}
                                  className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-container-high text-foreground shadow-sm transition-colors hover:bg-surface-container-highest ${focusRing}`}
                                  aria-label={`More actions for ${sb.name}`}
                                  title="More actions"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[200px] border-border bg-surface-container-high shadow-xl [&_[role=menuitem]]:min-h-10 [&_[role=menuitem]]:text-sm">
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
              className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface-container-high p-2 shadow-sm transition-colors hover:bg-surface-container-highest disabled:opacity-30", focusRing)}
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
                    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 py-1 transition-colors",
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
              className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface-container-high p-2 shadow-sm transition-colors hover:bg-surface-container-highest disabled:opacity-30", focusRing)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
