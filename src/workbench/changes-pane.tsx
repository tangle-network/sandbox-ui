"use client"

import * as React from "react"
import { GitBranch, RefreshCw } from "lucide-react"
import { Button, Skeleton, Textarea } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { DiffStatsBadge, GitStatusBadge, PanelHeader } from "./panel-header"
import { DiffView } from "./diff-view"
import { buildUnifiedPatch, computeDiffStats } from "./diff-utils"
import type { ChangedFile, ChangesPaneProps } from "./types"

const BORDER = "border-[var(--md3-outline-variant)]"

function splitPath(path: string): { dir: string; base: string } {
  const at = path.lastIndexOf("/")
  if (at < 0) return { dir: "", base: path }
  return { dir: path.slice(0, at + 1), base: path.slice(at + 1) }
}

/**
 * The contents a diff needs, or `null` while the consumer is still resolving
 * them. An added or untracked file has no baseline, a deleted file has no
 * working copy; each diffs against the empty string once its one side is
 * present. Every other status waits for both sides so a half-resolved
 * modification is never drawn as a wholesale rewrite.
 */
function resolveContents(file: ChangedFile): { baseline: string; current: string } | null {
  const { status, baseline, current } = file
  if (status === "added" || status === "untracked") {
    return current == null ? null : { baseline: baseline ?? "", current }
  }
  if (status === "deleted") {
    return baseline == null ? null : { baseline, current: current ?? "" }
  }
  return baseline == null || current == null ? null : { baseline, current }
}

function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return String(err)
}

const SKELETON_ROWS = [0, 1, 2, 3]

/**
 * The sandbox's git working tree as a review surface: every changed file with
 * its line counts, the selected file's word-level diff beneath, and a commit
 * box in the footer. Data in, callbacks out — the pane never fetches; the
 * consumer feeds it the sidecar's `/git/status` + `/git/diff` and resolves
 * `baseline` / `current` for the file it is told was selected.
 *
 * The list is capped at 40% of the pane and scrolls, so the diff keeps its
 * room however many files changed. The row's own chrome is compact: the
 * workspace shell already gives its right pane the 56px `WorkspacePaneHeader`,
 * so this header nests beneath it at `PanelHeader` rhythm rather than adding a
 * second tall bar.
 */
export function ChangesPane({
  branch,
  ahead = 0,
  behind = 0,
  files,
  selectedPath,
  onSelectFile,
  loading = false,
  error,
  onRefresh,
  onCommit,
  onPush,
  busy,
  onOpenFile,
  className,
}: ChangesPaneProps) {
  const idPrefix = React.useId()
  const listRef = React.useRef<HTMLUListElement>(null)
  const rowRefs = React.useRef(new Map<string, HTMLLIElement>())

  const [message, setMessage] = React.useState("")
  const [actionError, setActionError] = React.useState<string | null>(null)
  // Guards a double submit for a consumer that never mirrors the promise into
  // `busy`; `busy` still wins when it is given, because the consumer may know
  // about work the pane did not start (a push kicked off elsewhere).
  const [pending, setPending] = React.useState<"commit" | "push" | null>(null)
  const inFlight = busy ?? pending

  const totals = React.useMemo(() => {
    let added = 0
    let removed = 0
    for (const f of files) {
      added += f.additions
      removed += f.deletions
    }
    return { added, removed }
  }, [files])

  const selectedIndex = selectedPath == null ? -1 : files.findIndex((f) => f.path === selectedPath)
  const selected = selectedIndex >= 0 ? files[selectedIndex] : undefined

  // Selection and focus are one thing in this list (as in an SCM tree), so when
  // the consumer moves the selection while the list holds focus, focus follows.
  // A selection made from elsewhere — a tool result, a URL — leaves focus alone.
  React.useEffect(() => {
    const list = listRef.current
    if (!list || selected == null) return
    if (!list.contains(document.activeElement)) return
    rowRefs.current.get(selected.path)?.focus()
  }, [selected])

  const handleListKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      if (files.length === 0 || !onSelectFile) return
      const last = files.length - 1
      let next: number | null = null
      switch (event.key) {
        case "ArrowDown":
          next = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, last)
          break
        case "ArrowUp":
          next = selectedIndex < 0 ? last : Math.max(selectedIndex - 1, 0)
          break
        case "Home":
          next = 0
          break
        case "End":
          next = last
          break
        case "Enter":
        case " ":
          next = selectedIndex < 0 ? 0 : selectedIndex
          break
        default:
          return
      }
      event.preventDefault()
      const file = files[next]
      if (file) onSelectFile(file.path)
    },
    [files, onSelectFile, selectedIndex],
  )

  const runCommit = React.useCallback(async () => {
    const text = message.trim()
    if (!onCommit || !text || inFlight) return
    setActionError(null)
    setPending("commit")
    try {
      await onCommit(text)
      setMessage("")
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      setPending(null)
    }
  }, [message, onCommit, inFlight])

  const runPush = React.useCallback(async () => {
    if (!onPush || inFlight) return
    setActionError(null)
    setPending("push")
    try {
      await onPush()
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      setPending(null)
    }
  }, [onPush, inFlight])

  const handleMessageKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void runCommit()
      }
    },
    [runCommit],
  )

  const canCommit = files.length > 0 && message.trim().length > 0 && inFlight == null
  const canPush = ahead > 0 && inFlight == null

  const contents = React.useMemo(() => (selected ? resolveContents(selected) : null), [selected])
  const stats = React.useMemo(
    () => (contents ? computeDiffStats(contents.baseline, contents.current) : undefined),
    [contents],
  )
  const patch = React.useMemo(
    () => (selected && contents ? buildUnifiedPatch(selected.path, contents.baseline, contents.current) : undefined),
    [selected, contents],
  )

  const showList = !loading && files.length > 0
  const showEmpty = !loading && files.length === 0 && !error

  return (
    <div className={cn("flex h-full min-h-0 flex-col text-foreground", className)}>
      {/* Branch / upstream / totals row */}
      <div
        className={cn(
          "flex min-h-[38px] shrink-0 items-center gap-2 border-b bg-surface-container-low px-3 py-1",
          BORDER,
        )}
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {loading && branch == null ? (
          <Skeleton className="h-4 w-24 rounded-full" />
        ) : branch == null ? (
          <span className="text-xs text-muted-foreground">no commits yet</span>
        ) : (
          <span className="truncate rounded-full bg-surface-container-high px-2 py-0.5 font-mono text-xs text-foreground">
            {branch}
          </span>
        )}
        {(ahead > 0 || behind > 0) && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            {ahead > 0 && <span aria-label={`${ahead} ahead`}>↑{ahead}</span>}
            {behind > 0 && <span aria-label={`${behind} behind`}>↓{behind}</span>}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {files.length > 0 && <DiffStatsBadge stats={totals} />}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {/* File list — capped so the diff below always has room */}
      <div className={cn("flex max-h-[40%] shrink-0 flex-col border-b", BORDER)} aria-busy={loading || undefined}>
        {error && (
          <p role="alert" className="px-3 py-2 text-xs text-[var(--surface-danger-text)]">
            {error}
          </p>
        )}
        {loading && (
          <div className="space-y-1 px-3 py-2" data-testid="changes-skeleton">
            <span className="sr-only">Loading changes…</span>
            {SKELETON_ROWS.map((row) => (
              <Skeleton key={row} className="h-6 w-full" />
            ))}
          </div>
        )}
        {showEmpty && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No changes in the working tree.</p>
        )}
        {showList && (
          <ul
            ref={listRef}
            role="listbox"
            aria-label="Changed files"
            aria-activedescendant={selected ? `${idPrefix}-${selectedIndex}` : undefined}
            onKeyDown={handleListKeyDown}
            className="min-h-0 overflow-y-auto py-1 focus:outline-none"
          >
            {files.map((file, index) => {
              const isSelected = index === selectedIndex
              const { dir, base } = splitPath(file.path)
              // Roving tabindex: the selected row (or the first, before any
              // selection) is the list's single tab stop.
              const tabbable = isSelected || (selectedIndex < 0 && index === 0)
              return (
                <li
                  key={file.path}
                  id={`${idPrefix}-${index}`}
                  ref={(el) => {
                    if (el) rowRefs.current.set(file.path, el)
                    else rowRefs.current.delete(file.path)
                  }}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={tabbable ? 0 : -1}
                  onClick={() => onSelectFile?.(file.path)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/60",
                    isSelected ? "bg-surface-container-high" : "hover:bg-surface-container",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>
                    {dir && <span className="text-muted-foreground">{dir}</span>}
                    <span className="text-foreground">{base}</span>
                  </span>
                  <GitStatusBadge status={file.status} />
                  <DiffStatsBadge
                    stats={{ added: file.additions, removed: file.deletions }}
                    className="w-[5.5rem] justify-end tabular-nums"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Diff of the selected file */}
      <div className="flex min-h-0 flex-1 flex-col">
        {selected ? (
          <>
            <PanelHeader filename={selected.path} gitStatus={selected.status} stats={stats} copyText={patch}>
              {onOpenFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => onOpenFile(selected.path)}
                >
                  Open
                </Button>
              )}
            </PanelHeader>
            {contents ? (
              <DiffView
                filename={selected.path}
                baseline={contents.baseline}
                current={contents.current}
                showFileHeader={false}
                className="flex-1"
              />
            ) : selected.loadError ? (
              <p className="px-3 py-3 text-xs text-destructive" role="alert">
                {selected.loadError}
              </p>
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground" role="status">
                Loading diff…
              </p>
            )}
          </>
        ) : (
          showList && (
            <p className="px-3 py-3 text-xs text-muted-foreground">Select a file to read its diff.</p>
          )
        )}
      </div>

      {/* Commit / push */}
      {(onCommit || onPush) && (
        <div className={cn("shrink-0 space-y-2 border-t bg-surface-container-low p-3", BORDER)}>
          {onCommit && (
            <Textarea
              aria-label="Commit message"
              placeholder="Commit message"
              rows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleMessageKeyDown}
              disabled={inFlight != null}
              className="min-h-[3.5rem] resize-none px-3 py-2 text-xs"
            />
          )}
          <div className="flex items-center gap-2">
            {onCommit && (
              <Button
                type="button"
                size="sm"
                disabled={!canCommit}
                loading={inFlight === "commit"}
                onClick={() => void runCommit()}
              >
                Commit
              </Button>
            )}
            {onPush && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!canPush}
                loading={inFlight === "push"}
                onClick={() => void runPush()}
              >
                Push
                {ahead > 0 && <span className="font-mono text-muted-foreground">↑{ahead}</span>}
              </Button>
            )}
          </div>
          {actionError && (
            <p role="alert" className="text-xs text-[var(--surface-danger-text)]">
              {actionError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
