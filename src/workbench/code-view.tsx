"use client"

import * as React from "react"
import { Check, Copy, WrapText } from "lucide-react"
import { Button } from "@tangle-network/ui/primitives"
import { focusRing } from "@tangle-network/ui/utils"
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
  /** Show the file-tree rail. Off for single-file embeds where the host owns navigation. */
  showTree?: boolean
  /** Start with long lines wrapped. */
  defaultWrap?: boolean
  /** Defaults to the host's Brand theme. */
  themeType?: "light" | "dark"
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
  showTree = true,
  defaultWrap = false,
  themeType,
  className,
}: CodeViewProps) {
  const [narrowPane, setNarrowPane] = React.useState<"code" | "files">("code")
  const [wrap, setWrap] = React.useState(defaultWrap)
  const [copied, setCopied] = React.useState(false)
  const [line, setLine] = React.useState<number>()
  const lineInput = React.useRef<HTMLInputElement>(null)
  const lineCount = React.useMemo(() => content.split("\n").length, [content])
  React.useEffect(() => { setLine(undefined) }, [path])
  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])
  const copy = () => { void navigator.clipboard?.writeText(content).then(() => setCopied(true)) }
  const goToLine = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Math.round(Number(lineInput.current?.value))
    if (Number.isFinite(value) && value >= 1) setLine(Math.min(value, lineCount))
  }
  const treePaths = React.useMemo(() => {
    const list = paths && paths.length > 0 ? paths : [path]
    return list.includes(path) ? list : [...list, path]
  }, [paths, path])

  return (
    <div className={cn("sandbox-code-view h-full min-h-0 w-full", className)}>
      <div className="sandbox-code-view-layout flex h-full min-h-0 w-full">
        {showTree && (
          <div className="sandbox-code-view-mobile-toolbar" role="group" aria-label="Code view pane">
            <button type="button" aria-pressed={narrowPane === "files"} onClick={() => setNarrowPane("files")} className={focusRing}>Files</button>
            <button type="button" aria-pressed={narrowPane === "code"} onClick={() => setNarrowPane("code")} className={focusRing}>Code</button>
          </div>
        )}
        {showTree && (
          <div className="sandbox-code-view-tree sandbox-tree-surface flex w-60 shrink-0 flex-col border-r border-[var(--md3-outline-variant)] bg-surface-container-lowest" data-mobile-open={narrowPane === "files"}>
            <RichFileTree
              paths={treePaths}
              selectedPath={path}
              onSelect={(next) => {
                onFileSelect?.(next)
                setNarrowPane("code")
              }}
              gitStatus={gitStatus}
              search={treePaths.length > 12}
              height="100%"
            />
          </div>
        )}
        <div className="sandbox-code-view-editor flex min-w-0 flex-1 flex-col bg-surface-container" data-mobile-hidden={showTree && narrowPane === "files"}
          onKeyDown={(event) => {
            // Ctrl/Cmd+G jumps to a line, as in code editors.
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") { event.preventDefault(); lineInput.current?.focus(); lineInput.current?.select() }
          }}>
          <div className="flex shrink-0 items-center border-b border-[var(--md3-outline-variant)] bg-surface-container-lowest">
            <FileBreadcrumb path={path} className="min-w-0 flex-1 border-b-0" />
            <form onSubmit={goToLine} className="flex shrink-0 items-center gap-0.5 pr-1">
              <input ref={lineInput} type="number" min={1} max={lineCount} inputMode="numeric" placeholder="Line" aria-label="Go to line"
                aria-keyshortcuts="Control+g Meta+g" className={cn("h-6 w-14 rounded border border-transparent bg-transparent px-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground hover:border-border", focusRing)} />
              <Button type="button" variant="ghost" size="sm" aria-pressed={wrap} aria-label="Wrap lines" title="Wrap lines" onClick={() => setWrap((value) => !value)}
                className={cn("h-6 w-6 p-0", wrap && "text-foreground bg-surface-container-high")}>
                <WrapText className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" aria-label={copied ? "Copied" : "Copy file"} title={copied ? "Copied" : "Copy file"} onClick={copy} className="h-6 w-6 p-0">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </form>
          </div>
          <div className="min-h-0 flex-1">
            <CodeSurface code={content} filename={filename} language={language} wrap={wrap} line={line} themeType={themeType} />
          </div>
        </div>
      </div>
    </div>
  )
}
