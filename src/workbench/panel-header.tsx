"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "../lib/utils"
import type { RichFileTreeGitStatus } from "../files"
import type { DiffStats } from "./diff-utils"

const GIT_STATUS_META: Record<RichFileTreeGitStatus, { label: string; className: string }> = {
  added: { label: "Added", className: "bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]" },
  modified: { label: "Modified", className: "bg-[var(--surface-warning-bg)] text-[var(--surface-warning-text)]" },
  deleted: { label: "Deleted", className: "bg-[var(--surface-danger-bg)] text-[var(--surface-danger-text)]" },
  renamed: { label: "Renamed", className: "bg-[var(--surface-info-bg)] text-[var(--surface-info-text)]" },
  untracked: { label: "Untracked", className: "bg-surface-container-high text-muted-foreground" },
  ignored: { label: "Ignored", className: "bg-surface-container-high text-muted-foreground" },
}

export function GitStatusBadge({ status }: { status: RichFileTreeGitStatus }) {
  const meta = GIT_STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

/** `+added −removed` line counts in mono; the same pair the Changes list prints per file. */
export function DiffStatsBadge({ stats, className }: { stats: DiffStats; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs", className)}>
      <span className="text-[var(--code-success,#10B981)]">+{stats.added}</span>
      <span className="text-[var(--code-error,#FF4D6D)]">-{stats.removed}</span>
    </span>
  )
}

export interface PanelHeaderProps {
  filename: string
  gitStatus?: RichFileTreeGitStatus
  /** Added/removed line counts; rendered only when provided (Diff view). */
  stats?: DiffStats
  /** Enables the copy-to-clipboard action when set. */
  copyText?: string
  /** Extra content rendered at the right edge, before the copy button. */
  children?: React.ReactNode
  className?: string
}

/**
 * Thin bordered chrome bar above the artifact body — filename, git-status
 * badge, optional diff counts, and a copy action. Ported in spirit from
 * blueprint-agent's `PanelHeader` (min-h, hairline bottom border, dense
 * horizontal rhythm), retoned to the sandbox-ui surface ladder.
 */
export function PanelHeader({ filename, gitStatus, stats, copyText, children, className }: PanelHeaderProps) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const handleCopy = React.useCallback(async () => {
    if (copyText == null) return
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.warn("Clipboard write failed:", err)
    }
  }, [copyText])

  return (
    <div
      className={cn(
        "flex min-h-[38px] items-center gap-2 border-b border-[var(--md3-outline-variant)] bg-surface-container-low px-3 py-1",
        className,
      )}
    >
      <span className="truncate font-mono text-xs text-foreground">{filename}</span>
      {gitStatus && <GitStatusBadge status={gitStatus} />}
      <div className="ml-auto flex items-center gap-3">
        {stats && <DiffStatsBadge stats={stats} />}
        {children}
        {copyText != null && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy to clipboard"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--md3-outline-variant)] bg-surface-container px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--surface-success-text)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </div>
  )
}
