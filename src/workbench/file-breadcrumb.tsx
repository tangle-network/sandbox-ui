"use client"

import * as React from "react"
import { ChevronRight, FileCode2 } from "lucide-react"
import { cn } from "../lib/utils"

export interface FileBreadcrumbProps {
  /** Canonical path, e.g. `src/lib/retry.ts`. */
  path: string
  className?: string
}

/**
 * Slim path breadcrumb for the code panel. Reimplemented (not ported) from
 * blueprint-agent's `FileBreadcrumb` — that one nests a `FileTree` dropdown per
 * segment and couples to the workbench store + framer-motion. Here the rail
 * already owns navigation, so this is a read-only trail: caret-separated parent
 * segments with a file-icon leaf.
 */
export function FileBreadcrumb({ path, className }: FileBreadcrumbProps) {
  const segments = path.split("/").filter(Boolean)
  const leaf = segments[segments.length - 1] ?? path
  const parents = segments.slice(0, -1)

  return (
    <div
      className={cn(
        "flex min-h-[30px] items-center gap-1 overflow-hidden border-b border-[var(--md3-outline-variant)] bg-surface-container-lowest px-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {parents.map((seg, i) => (
        <React.Fragment key={`${seg}-${i}`}>
          <span className="truncate font-mono">{seg}</span>
          <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
        </React.Fragment>
      ))}
      <span className="truncate font-mono text-foreground">{leaf}</span>
    </div>
  )
}
