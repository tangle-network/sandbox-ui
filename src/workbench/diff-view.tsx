"use client"

import * as React from "react"
import { FileDiff, getSingularPatch } from "@pierre/diffs"
import { Button } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { buildUnifiedPatch } from "./diff-utils"

const DIFF_OPTIONS = {
  diffStyle: "unified",
  diffIndicators: "classic",
  lineDiffType: "word",
  hunkSeparators: "simple",
  expandUnchanged: false,
  theme: { dark: "github-dark", light: "github-light" },
  themeType: "dark",
  stickyHeader: true,
} as const

const DIFF_CONTAINER_TAG = "diffs-container"

export interface DiffViewProps {
  filename: string
  baseline: string
  current: string
  /** Hide when the surrounding PanelHeader already identifies the file. */
  showFileHeader?: boolean
  /** Start wrapped so narrow review panes never conceal the end of a line. */
  defaultWrap?: boolean
  className?: string
}

/**
 * Keep the maintained renderer for hunking, word diffs and highlighting. A new
 * custom element per effect survives StrictMode remounts without hydrating stale
 * shadow content. Wrapping is a renderer option, not a CSS patch into its shadow
 * root; the plain patch disclosure is the accessible, engine-independent view.
 */
export function DiffView({
  filename,
  baseline,
  current,
  showFileHeader = true,
  defaultWrap = true,
  className,
}: DiffViewProps) {
  const patch = React.useMemo(
    () => buildUnifiedPatch(filename, baseline, current),
    [filename, baseline, current],
  )
  const [wrap, setWrap] = React.useState(defaultWrap)
  const hintId = React.useId()
  const hostRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const host = hostRef.current
    if (host == null || !patch) return
    const container = document.createElement(DIFF_CONTAINER_TAG)
    container.style.display = "block"
    container.style.minWidth = "0"
    container.style.maxWidth = "100%"
    host.appendChild(container)
    const instance = new FileDiff(
      {
        ...DIFF_OPTIONS,
        overflow: wrap ? "wrap" : "scroll",
        disableFileHeader: !showFileHeader,
      },
      undefined,
      false,
    )
    instance.hydrate({ fileDiff: getSingularPatch(patch), fileContainer: container })
    return () => {
      instance.cleanUp()
      container.remove()
    }
  }, [patch, showFileHeader, wrap])

  if (!patch) {
    return (
      <div className={cn("flex h-full min-w-0 items-center justify-center bg-surface-container", className)}>
        <p className="text-sm text-muted-foreground">No changes — baseline and working copy are identical.</p>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden bg-surface-container", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button type="button" variant="outline" size="sm" aria-pressed={wrap}
          onClick={() => setWrap((value) => !value)}>
          Wrap lines
        </Button>
        <p id={hintId} className="min-w-0 flex-1 text-xs text-muted-foreground">
          {wrap ? "Long lines wrap within this pane." : "Long lines scroll horizontally. Turn on Wrap lines to read without scrolling."}
        </p>
      </div>
      <div
        ref={hostRef}
        data-testid="diff-view"
        role="region"
        aria-label={`Diff for ${filename}`}
        aria-describedby={hintId}
        tabIndex={0}
        className="min-h-0 min-w-0 max-w-full flex-1 overflow-auto text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
      />
      <details className="max-h-[40%] shrink-0 overflow-auto border-t border-border">
        <summary className="cursor-pointer px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]">
          Read plain-text diff
        </summary>
        <pre tabIndex={0} aria-label={`Plain-text diff for ${filename}`}
          className="m-0 whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={{ overflowWrap: "anywhere" }}>
          {patch}
        </pre>
      </details>
    </div>
  )
}
