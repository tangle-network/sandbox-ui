"use client"

import * as React from "react"
import { RichFileTree, type RichFileTreeGitEntry } from "../files"
import { cn } from "../lib/utils"
import { CodeSurface } from "./syntax"
import { FileBreadcrumb } from "./file-breadcrumb"

export interface CodeViewProps {
  path: string
  filename: string
  content: string
  language?: string
  /** Flat list of paths for the rail; defaults to `[path]`. */
  paths?: ReadonlyArray<string>
  gitStatus?: ReadonlyArray<RichFileTreeGitEntry>
  onFileSelect?: (path: string) => void
  className?: string
}

/**
 * Code surface: a fixed-width `RichFileTree` rail (with git-status
 * decorations) beside a breadcrumb-topped, syntax-highlighted read-only file
 * view. The rail owns navigation; selecting a path fans out to `onFileSelect`
 * so the host can swap the active artifact.
 */
export function CodeView({
  path,
  filename,
  content,
  language,
  paths,
  gitStatus,
  onFileSelect,
  className,
}: CodeViewProps) {
  const treePaths = React.useMemo(() => {
    const list = paths && paths.length > 0 ? paths : [path]
    return list.includes(path) ? list : [...list, path]
  }, [paths, path])

  return (
    <div className={cn("flex h-full min-h-0 w-full", className)}>
      <div className="flex w-60 shrink-0 flex-col border-r border-[var(--md3-outline-variant)] bg-surface-container-lowest">
        <RichFileTree
          paths={treePaths}
          selectedPath={path}
          onSelect={(next) => onFileSelect?.(next)}
          gitStatus={gitStatus}
          search={treePaths.length > 12}
          height="100%"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-surface-container">
        <FileBreadcrumb path={path} />
        <div className="min-h-0 flex-1">
          <CodeSurface code={content} filename={filename} language={language} />
        </div>
      </div>
    </div>
  )
}
