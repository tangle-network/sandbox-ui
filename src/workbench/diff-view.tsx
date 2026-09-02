"use client"

import * as React from "react"
import { FileDiff, getSingularPatch } from "@pierre/diffs"
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
  stickyHeader: true,
} as const

/** The renderer's custom element; `@pierre/diffs` registers it on import. */
const DIFF_CONTAINER_TAG = "diffs-container"

export interface DiffViewProps {
  filename: string
  baseline: string
  current: string
  /**
   * The renderer's own sticky file header (name + counts). On by default; a
   * host whose chrome already names the file, such as the Changes pane under
   * its `PanelHeader`, turns it off so the name is not printed twice.
   */
  showFileHeader?: boolean
  className?: string
}

/**
 * Word-level unified diff via `@pierre/diffs`' core `FileDiff` renderer. The
 * patch is built with jsdiff's `createTwoFilesPatch` (baseline → current); the
 * renderer owns hunking, intra-line word diffing, gutters, and highlighting.
 *
 * The renderer is driven from an effect on a host element this component
 * creates for every mount, not through the library's React wrapper. The
 * wrapper hydrates the element React hands it and treats an existing shadow
 * `<pre>` as prerendered content; React StrictMode attaches, detaches, and
 * re-attaches that element on mount, so the second hydrate finds the first
 * mount's `<pre>` and renders nothing. A fresh element per effect run has no
 * such history, and the cleanup removes it (the instance is not
 * container-managed).
 */
export function DiffView({ filename, baseline, current, showFileHeader = true, className }: DiffViewProps) {
  const patch = React.useMemo(
    () => buildUnifiedPatch(filename, baseline, current),
    [filename, baseline, current],
  )
  const hostRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const host = hostRef.current
    if (host == null || !patch) return
    const container = document.createElement(DIFF_CONTAINER_TAG)
    host.appendChild(container)
    const instance = new FileDiff(
      showFileHeader ? DIFF_OPTIONS : { ...DIFF_OPTIONS, disableFileHeader: true },
      undefined,
      false,
    )
    instance.hydrate({ fileDiff: getSingularPatch(patch), fileContainer: container })
    return () => {
      instance.cleanUp()
      container.remove()
    }
  }, [patch, showFileHeader])

  if (!patch) {
    return (
      <div className={cn("flex h-full items-center justify-center bg-surface-container", className)}>
        <p className="text-sm text-muted-foreground">No changes — baseline and working copy are identical.</p>
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      data-testid="diff-view"
      className={cn("h-full min-h-0 overflow-auto bg-surface-container text-[13px]", className)}
    />
  )
}
