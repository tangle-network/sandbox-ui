"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button, SegmentedControl } from "@tangle-network/ui/primitives"
import { RunStatusIcon, type RunStatus } from "@tangle-network/ui/run"
import { cn } from "../lib/utils"
import { ModelBrandStack, modelBrandFor } from "../lib/model-brand"
import type { FileChange } from "../vault-tree/vault-tree"
import { WorkspaceFilesPane } from "../workspace/workspace-files-pane"
import { CodeView } from "../workbench/code-view"
import { DiffView } from "../workbench/diff-view"
import TerminalView from "../terminal/terminal-view"
import type { AgentStreamOpener } from "./agent-stream"
import { AgentConversationView, NewOutputPill, useAgentConversation } from "./agent-conversation"
import { usePhone } from "./agent-inspector"
import { useFollowTail } from "./use-follow-tail"

export type AgentWorkspaceView = "files" | "trace" | "terminal"

/** The agent's files as the host read them: every path (a folder ends in "/"), where they came from, and each path's change mark. */
export interface AgentFileListing {
  paths: readonly string[]
  /** Named beside the tree so the reader knows what they read: "live box", "git mirror at rc3". */
  origin: string
  status?: Readonly<Record<string, FileChange>>
}
export interface AgentFileContent {
  content: string
  /** The same path before the agent's work (the previous release, or main); when given the file opens with a Diff view. */
  baseline?: string | null
  /** What the baseline is, for the toggle's "Diff vs …": "rc1", "main"; defaults to "before". */
  baselineLabel?: string
  language?: string
}
export interface AgentTerminalGrant { apiUrl: string; token: string; connectionId?: string }

/** What a host can read about one agent. Each read is a promise, so the host fetches lazily and the workspace shows the wait. */
export interface AgentWorkspaceSource {
  list: () => Promise<AgentFileListing>
  read: (path: string) => Promise<AgentFileContent>
  /** The agent's conversation stream (Server-Sent Events: rows, reset, end). Omit when the harness captured none. */
  stream?: { url: string; open?: AgentStreamOpener }
  /** A terminal into the agent's live box, minted when the reader opens the tab; null once the box is gone. Omit for no terminal. */
  terminal?: () => Promise<AgentTerminalGrant | null>
}

export interface AgentWorkspaceProps {
  agent: { id: string; label: string; status: RunStatus; model?: string | null; harness?: string | null }
  source: AgentWorkspaceSource
  /** The reader's cursor on the run clock in ms (null while following live) and the run's epoch: the Trace shows what was said by then. */
  cursor?: number | null
  startedAt?: number
  /** Why the agent has no conversation, when the host knows (no transcript captured, harness without a stream). */
  transcriptNote?: string
  view?: AgentWorkspaceView
  onViewChange?: (view: AgentWorkspaceView) => void
  /** The open file, when the host carries it (a shared link); otherwise the workspace keeps its own. */
  path?: string
  onPathChange?: (path: string | undefined) => void
  /** Back to the run; Escape does the same. */
  onBack?: () => void
  className?: string
}

type Read<T> = { state: "reading" } | { state: "read"; value: T } | { state: "failed"; why: string }

/** One host read, keyed so a stale answer never lands on a newer selection. */
function useRead<T>(read: (() => Promise<T>) | undefined, key: string): Read<T> | undefined {
  const [result, setResult] = useState<{ key: string; read: Read<T> }>()
  useEffect(() => {
    if (!read) return
    let stale = false
    setResult({ key, read: { state: "reading" } })
    read().then(
      (value) => { if (!stale) setResult({ key, read: { state: "read", value } }) },
      (why: unknown) => { if (!stale) setResult({ key, read: { state: "failed", why: why instanceof Error ? why.message : String(why) } }) },
    )
    return () => { stale = true }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!read) return undefined
  return result?.key === key ? result.read : { state: "reading" }
}

const Note = ({ children }: { children: ReactNode }) => <p role="status" className="m-0 px-3 py-2 text-sm text-muted-foreground">{children}</p>

/**
 * One agent's workspace: its files with a read-only code and diff view, its conversation as of the run cursor, and a
 * terminal into its live box, behind one segmented control. The host owns every read through `source`; the workspace
 * names where the files came from and says what it is waiting for or could not read, never an empty pane.
 */
export function AgentWorkspace({ agent, source, cursor = null, startedAt, transcriptNote, view: controlledView, onViewChange, path: controlledPath, onPathChange, onBack, className }: AgentWorkspaceProps) {
  const [ownView, setOwnView] = useState<AgentWorkspaceView>("files")
  const view = controlledView ?? ownView
  const show = (next: AgentWorkspaceView) => { setOwnView(next); onViewChange?.(next) }
  const phone = usePhone()
  const [ownPath, setOwnPath] = useState<string>()
  const path = controlledPath ?? ownPath
  const setPath = (next: string | undefined) => { setOwnPath(next); onPathChange?.(next) }
  useEffect(() => setOwnPath(undefined), [agent.id])
  const listing = useRead(source.list, `${agent.id}:list`)
  const file = useRead(path ? () => source.read(path) : undefined, `${agent.id}:${path ?? ""}`)
  const terminal = useRead(view === "terminal" ? source.terminal : undefined, `${agent.id}:terminal`)
  const conversation = useAgentConversation(source.stream?.url, source.stream?.open, { cursor, startedAt, silent: transcriptNote })
  const scroller = useRef<HTMLDivElement>(null)
  const { unseen, jump } = useFollowTail(scroller, { identity: view === "trace" ? agent.id : undefined, content: conversation.items })
  const brand = agent.model ? modelBrandFor(agent.model) : null
  const meta = [agent.harness, agent.model].filter(Boolean).join(" · ")
  const options: { value: AgentWorkspaceView; label: string }[] = [{ value: "files", label: "Files" }, { value: "trace", label: "Trace" }, ...(source.terminal ? [{ value: "terminal" as const, label: "Terminal" }] : [])]
  const name = path?.split("/").pop() ?? ""
  const files = listing?.state === "read" ? listing.value : undefined
  const preview = path && file ? {
    path,
    content: file.state === "read" ? <CodeView path={path} filename={name} content={file.value.content} language={file.value.language} showTree={false} className="h-full" />
      : <Note>{file.state === "reading" ? `Reading ${name}…` : file.why}</Note>,
    compare: file.state === "read" && file.value.baseline != null ? { label: file.value.baselineLabel ?? "before", content: <DiffView filename={name} baseline={file.value.baseline} current={file.value.content} showFileHeader={false} /> } : undefined,
  } : undefined
  return (
    <div className={cn("sandbox-agent-workspace flex h-full min-h-0 flex-col", className)} data-view={view} data-agent-id={agent.id}
      onKeyDown={(event) => { if (event.key === "Escape" && onBack) { event.stopPropagation(); onBack() } }}>
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2">
        {onBack && <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to the run" className="shrink-0 gap-1 px-2"><ArrowLeft aria-hidden className="h-4 w-4" />Back</Button>}
        <RunStatusIcon status={agent.status} className="size-4 shrink-0" />
        <h3 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold">{agent.label}</h3>
        {(brand || meta) && <p className="m-0 hidden min-w-0 truncate text-xs text-muted-foreground sm:block">
          {brand && <span className="mr-1.5 inline-flex align-[-3px]"><ModelBrandStack identity={brand} size="sm" /></span>}{meta}
        </p>}
        <SegmentedControl aria-label="Agent view" value={view} onValueChange={show} options={options} />
      </header>
      {view === "files" && <WorkspaceFilesPane paths={files?.paths ?? []} status={files?.status} selectedPath={path}
        onSelect={(next, node) => { if (node?.type !== "directory" && !next.endsWith("/")) setPath(next) }} onBack={() => setPath(undefined)} preview={preview}
        surface="plain" layout={phone ? "stack" : "split"} expandable={false} expansionKey={`agent-workspace:${agent.id}`}
        headerActions={files && <span className="truncate text-xs text-muted-foreground" data-files-origin>{files.origin}</span>}
        emptyState={<Note>{!listing || listing.state === "reading" ? "Reading the agent's files…" : listing.state === "failed" ? listing.why : "This agent has no files."}</Note>}
        className="min-h-0 flex-1" />}
      {view === "trace" && <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scroller} data-primary-content="" className="min-h-0 flex-1 overflow-y-auto px-3 py-2"><AgentConversationView conversation={conversation} /></div>
        <NewOutputPill unseen={unseen} onJump={() => jump()} />
      </div>}
      {view === "terminal" && <section aria-label="Terminal" role={phone ? "dialog" : undefined} aria-modal={phone || undefined}
        className={cn("flex min-h-0 flex-1 flex-col", phone && "fixed inset-0 z-[1100] bg-background")}>
        {phone && <Button variant="ghost" size="sm" onClick={() => show("files")} aria-label="Back to files" className="m-1 w-fit gap-1 px-2"><ArrowLeft aria-hidden className="h-4 w-4" />Back</Button>}
        {terminal?.state === "read" && terminal.value
          ? <TerminalView apiUrl={terminal.value.apiUrl} token={terminal.value.token} connectionId={terminal.value.connectionId} title={agent.label} subtitle="Connected to the agent's box" isActive />
          : <Note>{!terminal || terminal.state === "reading" ? "Opening a terminal into the agent's box…" : terminal.state === "failed" ? terminal.why : "The agent's box is gone; its files come from the git mirror."}</Note>}
      </section>}
    </div>
  )
}
