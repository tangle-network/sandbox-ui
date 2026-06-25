"use client"

import * as React from "react"
import { PatchDiff } from "@pierre/diffs/react"
import { cn } from "../lib/utils"
import { buildUnifiedPatch } from "./diff-utils"

// Unified, word-level diff tuned to read like a review tool. The `github-dark`
// / `github-light` Shiki themes are Primer, so the added/removed line
// backgrounds the lib paints under `themeType:'dark'` are the Primer greens and
// reds (≈ rgba(46,160,67,.15) added, rgba(248,81,73,.15) removed) the spec
// calls for — driven by the theme rather than brittle class overrides.
// `as const` keeps the string literals narrow so they satisfy the renderer's
// option unions (`diffStyle`, `lineDiffType`, …) without a type import.
const DIFF_OPTIONS = {
  diffStyle: "unified",
  diffIndicators: "classic",
  lineDiffType: "word",
  hunkSeparators: "simple",
  overflow: "scroll",
  expandUnchanged: false,
  theme: { dark: "github-dark", light: "github-light" },
  themeType: "dark",
  // The artifact pane's PanelHeader already shows the filename, git status, and
  // +/- stats above the tabs, so PatchDiff's own file header is a redundant
  // second "selected file" bar. Suppress it — one header, not two.
  disableFileHeader: true,
} as const

export interface DiffViewProps {
  filename: string
  baseline: string
  current: string
  className?: string
}

/**
 * Word-level unified diff via `@pierre/diffs`' `PatchDiff`. The patch is built
 * with jsdiff's `createTwoFilesPatch` (baseline → current); the renderer owns
 * hunking, intra-line word diffing, gutters, and syntax highlighting.
 */
export function DiffView({ filename, baseline, current, className }: DiffViewProps) {
  const patch = React.useMemo(
    () => buildUnifiedPatch(filename, baseline, current),
    [filename, baseline, current],
  )

  if (!patch) {
    return (
      <div className={cn("flex h-full items-center justify-center bg-surface-container", className)}>
        <p className="text-sm text-muted-foreground">No changes — baseline and working copy are identical.</p>
      </div>
    )
  }

  return (
    <div className={cn("h-full min-h-0 overflow-auto bg-surface-container text-[13px]", className)}>
      <PatchDiff patch={patch} options={DIFF_OPTIONS} />
    </div>
  )
}
