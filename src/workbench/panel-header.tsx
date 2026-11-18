"use client"

import * as React from "react"
import { CopyButton, StatusPill, type StatusTone } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import type { RichFileTreeGitStatus } from "../files"
import type { DiffStats } from "./diff-utils"

const GIT_STATUS_META: Record<RichFileTreeGitStatus, { label: string; tone: StatusTone }> = {
  added: { label: "Added", tone: "success" },
  modified: { label: "Modified", tone: "warning" },
  deleted: { label: "Deleted", tone: "danger" },
  renamed: { label: "Renamed", tone: "info" },
  untracked: { label: "Untracked", tone: "neutral" },
  ignored: { label: "Ignored", tone: "neutral" },
}

export function GitStatusBadge({ status }: { status: RichFileTreeGitStatus }) {
  const meta = GIT_STATUS_META[status]
  return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
}

/** `+added −removed` line counts in mono; the same pair the Changes list prints per file. */
export function DiffStatsBadge({ stats, className }: { stats: DiffStats; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs", className)}>
      <span className="text-[var(--code-success)]">+{stats.added}</span>
      <span className="text-[var(--code-error)]">-{stats.removed}</span>
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
  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2 border-b border-[var(--md3-outline-variant)] bg-surface-container-low px-3 py-1",
        className,
      )}
    >
      <span dir="rtl" title={filename} className="min-w-0 truncate text-left font-mono text-xs text-foreground">
        <bdi>{filename}</bdi>
      </span>
      {gitStatus && <GitStatusBadge status={gitStatus} />}
      <div className="relative ml-auto flex shrink-0 items-center gap-3">
        {stats && <DiffStatsBadge stats={stats} />}
        {children}
        {copyText != null && (
          <CopyButton text={copyText} label="Copy" aria-label="Copy to clipboard" className="whitespace-nowrap" />
        )}
      </div>
    </div>
  )
}
