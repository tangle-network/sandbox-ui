"use client"

import * as React from "react"
import { FileDiff, getSingularPatch } from "@pierre/diffs"
import { Button } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { buildUnifiedPatch } from "./diff-utils"
import { CODE_FONT_FAMILY, CODE_THEME } from "./syntax"

const DIFF_OPTIONS = {
  diffStyle: "unified",
  diffIndicators: "classic",
  lineDiffType: "word",
  hunkSeparators: "simple",
  expandUnchanged: false,
  theme: CODE_THEME,
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
  /** Match the host app's selected theme. Defaults to dark for existing consumers. */
  themeType?: "light" | "dark"
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
  themeType = "dark",
  className,
}: DiffViewProps) {
  const patch = React.useMemo(
    () => buildUnifiedPatch(filename, baseline, current),
    [filename, baseline, current],
  )
  const [wrap, setWrap] = React.useState(defaultWrap)
  const hostRef = React.useRef<HTMLDivElement>(null)
  const instanceRef = React.useRef<FileDiff | null>(null)
  const latestThemeType = React.useRef(themeType)
  const appliedThemeType = React.useRef(themeType)

  React.useLayoutEffect(() => {
    latestThemeType.current = themeType
  }, [themeType])

  React.useLayoutEffect(() => {
    const host = hostRef.current
    if (host == null || !patch) return
    const container = document.createElement(DIFF_CONTAINER_TAG)
    // The renderer's shadow styles otherwise choose an OS-specific mono face.
    container.style.setProperty("--diffs-font-family", CODE_FONT_FAMILY)
    container.style.display = "block"
    container.style.minWidth = "0"
    container.style.maxWidth = "100%"
    host.appendChild(container)
    const instance = new FileDiff(
      {
        ...DIFF_OPTIONS,
        themeType: latestThemeType.current,
        overflow: wrap ? "wrap" : "scroll",
        disableFileHeader: !showFileHeader,
      },
      // No worker manager, and no third argument: @pierre/diffs 1.6 made it `requestOwnerRender`, a callback it calls
      // whenever it is not null, so the old `false` (1.5's isContainerManaged) threw "e is not a function" and every
      // DiffView drew nothing. Left out, the instance renders itself on 1.5 and 1.6 alike.
      undefined,
    )
    instanceRef.current = instance
    appliedThemeType.current = latestThemeType.current
    instance.hydrate({ fileDiff: getSingularPatch(patch), fileContainer: container })
    return () => {
      if (instanceRef.current === instance) instanceRef.current = null
      instance.cleanUp()
      container.remove()
    }
  }, [patch, showFileHeader, wrap])

  React.useLayoutEffect(() => {
    if (appliedThemeType.current === themeType) return
    instanceRef.current?.setThemeType(themeType)
    appliedThemeType.current = themeType
  }, [themeType])

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
      </div>
      <div
        ref={hostRef}
        data-testid="diff-view"
        role="region"
        aria-label={`Diff for ${filename}`}
        tabIndex={0}
        className="min-h-0 min-w-0 max-w-full flex-1 overflow-auto text-[13px]"
      />
      <details className="max-h-[40%] shrink-0 overflow-auto border-t border-border">
        <summary className="cursor-pointer px-3 py-2 text-sm">
          Read plain-text diff
        </summary>
        <pre role="region" tabIndex={0} aria-label={`Plain-text diff for ${filename}`}
          className="m-0 whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed"
          style={{ overflowWrap: "anywhere" }}>
          {patch}
        </pre>
      </details>
    </div>
  )
}
