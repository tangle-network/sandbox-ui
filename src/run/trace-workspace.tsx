"use client"

import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { FlowMarker, FlowSpan, FlowTrace } from "@tangle-network/charts"
import { AgentTimeline, type AgentTimelineItem } from "@tangle-network/ui/chat"
import { InlineThinkingItem } from "@tangle-network/ui/run"
import { X } from "lucide-react"
import { cn } from "../lib/utils"
import { type AgentTranscriptEntry, useAgentStream } from "./agent-stream"
import { TraceWaterfall, type TraceWaterfallProps } from "./trace-waterfall"

/** A moment on the run's event track: a release, a check verdict, a spawn, a crash or a steer. */
export interface TraceEvent extends FlowMarker {}

export interface TraceWorkspaceProps extends Omit<TraceWaterfallProps, "trace" | "markers" | "onSelect" | "onTimeChange" | "selectedId" | "onDeselect"> {
  trace: FlowTrace
  /** The selected agent's message stream (Server-Sent Events: rows, reset, end; reconnects with ?after=lastSeq). */
  streamUrl?: (agentId: string) => string
  events?: TraceEvent[]
  /** The time the reader moved to, in trace ms; null while following live or showing the whole run. */
  onTimeChange?: (t: number | null) => void
  /**
   * The code workspace as of the cursor and scoped to the selected agent, usually a WorkspaceFilesPane: the page answers
   * the as-of query. It spans the full width and at least 70% of the viewport. Keep its key on the commit so a scrub
   * keeps its state.
   */
  files?: ReactNode
  /** The scoreboard as of the cursor, under the code workspace; omitted when not given. */
  scoreboard?: ReactNode
  selectedAgentId?: string
  /** Called with the agent the reader selected, or undefined when they close its drawer or press Escape. */
  onSelectAgent?: (agentId: string | undefined) => void
  className?: string
}

/** The agent that owns a span: the span itself when it is an agent, else its nearest agent ancestor. */
function agentOf(span: FlowSpan, byId: Map<string, FlowSpan>): FlowSpan | undefined {
  for (let cursor: FlowSpan | undefined = span; cursor; cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined) {
    if (cursor.kind === "pipeline") return cursor
  }
  return undefined
}

function timelineItems(entries: readonly AgentTranscriptEntry[], streaming: boolean): AgentTimelineItem[] {
  return entries.map((entry, index): AgentTimelineItem => {
    if (entry.kind === "message") {
      return { id: entry.id, kind: "message", role: entry.role, content: entry.content, isStreaming: streaming && index === entries.length - 1 }
    }
    if (entry.kind === "tool") return { id: entry.id, kind: "tool", call: entry.call }
    // Reasoning stays one collapsed row the reader can open.
    return { id: entry.id, kind: "custom", content: <InlineThinkingItem part={{ type: "reasoning", text: entry.text }} defaultOpen={false} openWhileActive={false} /> }
  })
}

function NotTimeIndexed({ label }: { label: string }) {
  return <p className="p-4 text-sm text-muted-foreground">{label}: not time-indexed</p>
}

/**
 * The run workspace: the agent timeline and span waterfall over one clock, the selected agent's conversation
 * streaming in a right-hand drawer, and the page's code workspace and scoreboard following the time cursor. Scrubbing is time travel:
 * every panel shows what was true at the cursor, and the conversation shows what had been said by then.
 */
export function TraceWorkspace({
  trace, streamUrl, events, onTimeChange, files, scoreboard, selectedAgentId, onSelectAgent, className, ...waterfall
}: TraceWorkspaceProps) {
  const byId = useMemo(() => new Map(trace.spans.flatMap((span) => (span.id ? [[span.id, span] as const] : []))), [trace])
  const [ownSelection, setOwnSelection] = useState<string>()
  const selected = selectedAgentId ?? ownSelection
  const select = (agentId: string | undefined) => { setOwnSelection(agentId); onSelectAgent?.(agentId) }
  const agent = selected ? byId.get(selected) : undefined
  const [cursor, setCursor] = useState<number | null>(null)
  const stream = useAgentStream(selected && streamUrl ? streamUrl(selected) : undefined)

  // As of the cursor: entries that began by then, measured on the trace clock (trace ms from the run's first span).
  // The run's epoch comes from the page (`startedAt`); without it, the agent's first message anchors its own start.
  const origin = useMemo(() => {
    if (waterfall.startedAt !== undefined) return waterfall.startedAt
    const first = stream.entries[0]?.at
    return agent && first !== undefined ? first - agent.startMs : undefined
  }, [waterfall.startedAt, agent, stream.entries])
  const shown = cursor === null || origin === undefined ? stream.entries : stream.entries.filter((entry) => entry.at - origin <= cursor)
  const items = useMemo(() => timelineItems(shown, cursor === null && stream.alive), [shown, cursor, stream.alive])

  // Follow the newest output unless the reader scrolled up; then offer a "New output" pill instead of jumping.
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const [unseen, setUnseen] = useState(false)
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    if (pinned.current) element.scrollTop = element.scrollHeight
    else setUnseen(true)
  }, [items.length, items[items.length - 1]])
  useEffect(() => { pinned.current = true; setUnseen(false) }, [selected])

  return (
    <div className={cn("sandbox-trace-workspace flex min-h-0 flex-col gap-3", className)}>
      <TraceWaterfall
        {...waterfall}
        trace={trace}
        markers={events}
        selectedId={agent?.id}
        onDeselect={() => select(undefined)}
        onSelect={(span) => {
          const owner = agentOf(span, byId)
          if (owner?.id) select(owner.id)
        }}
        onTimeChange={(t) => { setCursor(t); onTimeChange?.(t) }}
      />
      <section aria-label="Code at the cursor" className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-card">
        {files ?? <NotTimeIndexed label="Files" />}
      </section>
      {scoreboard && (
        <section aria-label="Scoreboard at the cursor" className="overflow-hidden rounded-xl border border-border bg-card">{scoreboard}</section>
      )}
      {agent && (
        // A drawer over the right edge: the code workspace keeps its full width underneath.
        <aside aria-label={`${agent.name} conversation`} onKeyDown={(event) => { if (event.key === "Escape") select(undefined) }}
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col border-l border-border bg-card shadow-2xl">
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", stream.alive && cursor === null ? "bg-[var(--status-running,#34c48c)]" : "bg-muted-foreground/50")} aria-hidden />
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{agent.name}</h3>
            {agent.detail && <span className="truncate text-xs text-muted-foreground">{agent.detail}</span>}
            <button type="button" aria-label="Close conversation" title="Close (Esc)" onClick={() => select(undefined)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </header>
          <div
            ref={scroller}
            onScroll={(event) => {
              const element = event.currentTarget
              pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
              if (pinned.current) setUnseen(false)
            }}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
          >
            {streamUrl
              ? <AgentTimeline items={items} isThinking={stream.alive && cursor === null && items.length === 0} emptyState={<p className="p-4 text-sm text-muted-foreground">{stream.error ?? "No messages yet."}</p>} />
              : <NotTimeIndexed label="Conversation" />}
          </div>
          {unseen && (
            <button type="button" onClick={() => { const element = scroller.current; if (element) element.scrollTop = element.scrollHeight; pinned.current = true; setUnseen(false) }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background px-3 py-1 text-xs shadow-sm">
              New output
            </button>
          )}
        </aside>
      )}
    </div>
  )
}
