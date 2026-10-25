"use client"

import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { FlowMarker, FlowSpan, FlowTrace } from "@tangle-network/charts"
import { AgentTimeline, type AgentTimelineItem } from "@tangle-network/ui/chat"
import { InlineThinkingItem } from "@tangle-network/ui/run"
import { cn } from "../lib/utils"
import { type AgentTranscriptEntry, useAgentStream } from "./agent-stream"
import { TraceWaterfall, type TraceWaterfallProps } from "./trace-waterfall"

/** A moment on the run's event track: a release, a check verdict, a spawn, a crash or a steer. */
export interface TraceEvent extends FlowMarker {}

export interface TraceWorkspaceProps extends Omit<TraceWaterfallProps, "trace" | "markers" | "onSelect" | "onTimeChange"> {
  trace: FlowTrace
  /** The selected agent's message stream (Server-Sent Events: rows, reset, end; reconnects with ?after=lastSeq). */
  streamUrl?: (agentId: string) => string
  events?: TraceEvent[]
  /** The time the reader moved to, in trace ms; null while following live or showing the whole run. */
  onTimeChange?: (t: number | null) => void
  /** The files as of the cursor (the page answers the as-of query); keep its key on the commit so its state survives a scrub. */
  files?: ReactNode
  /** The scoreboard as of the cursor. */
  scoreboard?: ReactNode
  selectedAgentId?: string
  onSelectAgent?: (agentId: string) => void
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
 * streaming beside it, and the page's files and scoreboard following the time cursor. Scrubbing is time travel:
 * every panel shows what was true at the cursor, and the conversation shows what had been said by then.
 */
export function TraceWorkspace({
  trace, streamUrl, events, onTimeChange, files, scoreboard, selectedAgentId, onSelectAgent, className, ...waterfall
}: TraceWorkspaceProps) {
  const byId = useMemo(() => new Map(trace.spans.flatMap((span) => (span.id ? [[span.id, span] as const] : []))), [trace])
  const [ownSelection, setOwnSelection] = useState<string>()
  const selected = selectedAgentId ?? ownSelection
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
    <div className={cn("sandbox-trace-workspace grid min-h-0 gap-3", agent ? "lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]" : "grid-cols-1", className)}>
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <TraceWaterfall
          {...waterfall}
          trace={trace}
          markers={events}
          onSelect={(span) => {
            const owner = agentOf(span, byId)
            if (!owner?.id) return
            setOwnSelection(owner.id)
            onSelectAgent?.(owner.id)
          }}
          onTimeChange={(t) => { setCursor(t); onTimeChange?.(t) }}
        />
        <div className="grid min-h-0 gap-3 md:grid-cols-2">
          <section aria-label="Files at the cursor" className="min-h-0 overflow-hidden rounded-xl border border-border bg-card">
            {files ?? <NotTimeIndexed label="Files" />}
          </section>
          <section aria-label="Scoreboard at the cursor" className="min-h-0 overflow-hidden rounded-xl border border-border bg-card">
            {scoreboard ?? <NotTimeIndexed label="Scoreboard" />}
          </section>
        </div>
      </div>
      {agent && (
        <aside aria-label={`${agent.name} conversation`} className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", stream.alive && cursor === null ? "bg-[var(--status-running,#34c48c)]" : "bg-muted-foreground/50")} aria-hidden />
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{agent.name}</h3>
            {agent.detail && <span className="truncate text-xs text-muted-foreground">{agent.detail}</span>}
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
