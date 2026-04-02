"use client"

import * as React from "react"
import { GitBranch, GitCommit, FileEdit, FilePlus, File } from "lucide-react"
import { cn } from "../lib/utils"

export interface GitStatusData {
  branch: string
  isDirty: boolean
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
}

export interface GitCommitData {
  shortSha: string
  message: string
  author: string
  date: string
}

export interface GitPanelProps {
  status: GitStatusData | null
  log: GitCommitData[]
  loading?: boolean
  onRefresh?: () => void
  className?: string
}

export function GitPanel({ status, log, loading = false, onRefresh, className }: GitPanelProps) {
  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading git info...
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="h-4 w-4" />
          No git repository detected
        </div>
      </div>
    )
  }

  const changedCount = status.staged.length + status.modified.length + status.untracked.length

  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">{status.branch}</span>
          {status.isDirty && (
            <span className="rounded-full bg-[var(--surface-warning-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--surface-warning-text)]">
              {changedCount} change{changedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {onRefresh && (
          <button type="button" onClick={onRefresh} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Refresh
          </button>
        )}
      </div>

      {/* Changed files */}
      {changedCount > 0 && (
        <div className="border-b border-border px-4 py-3">
          <div className="space-y-1.5">
            {status.staged.map((f) => (
              <div key={`s-${f}`} className="flex items-center gap-2 text-xs">
                <FilePlus className="h-3 w-3 text-[var(--surface-success-text)]" />
                <span className="font-mono text-foreground truncate">{f}</span>
                <span className="text-[var(--surface-success-text)] text-[10px] font-bold ml-auto">STAGED</span>
              </div>
            ))}
            {status.modified.map((f) => (
              <div key={`m-${f}`} className="flex items-center gap-2 text-xs">
                <FileEdit className="h-3 w-3 text-[var(--surface-warning-text)]" />
                <span className="font-mono text-foreground truncate">{f}</span>
              </div>
            ))}
            {status.untracked.map((f) => (
              <div key={`u-${f}`} className="flex items-center gap-2 text-xs">
                <File className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-muted-foreground truncate">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent commits */}
      {log.length > 0 && (
        <div className="px-4 py-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent Commits</div>
          <div className="space-y-2">
            {log.slice(0, 5).map((commit) => (
              <div key={commit.shortSha} className="flex items-start gap-2 text-xs">
                <GitCommit className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="font-mono text-primary mr-1.5">{commit.shortSha}</span>
                  <span className="text-foreground">{commit.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upstream tracking */}
      {(status.ahead > 0 || status.behind > 0) && (
        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          {status.ahead > 0 && <span>↑ {status.ahead} ahead</span>}
          {status.behind > 0 && <span>↓ {status.behind} behind</span>}
        </div>
      )}
    </div>
  )
}
