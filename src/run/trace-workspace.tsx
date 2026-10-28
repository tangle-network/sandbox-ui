"use client"

import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { toolGlyph } from "@tangle-network/charts/react"
import type { FlowMarker, FlowSpan, FlowTrace } from "@tangle-network/charts"
import { AgentTimeline, type AgentTimelineItem } from "@tangle-network/ui/chat"
import { InlineThinkingItem, runStatus } from "@tangle-network/ui/run"
import { X } from "lucide-react"
import { cn } from "../lib/utils"
import { activityTiming, ambientStyle, syncAmbient } from "../workflows/run-ui-state"
import { AgentGraph, type AgentGraphEdge, type AgentGraphNode, type AgentGraphEvent, type AgentGraphProps } from "../workflows/AgentGraph"
import { type AgentTranscriptEntry, useAgentStream } from "./agent-stream"
import { TraceWaterfall, type TraceWaterfallProps } from "./trace-waterfall"
import { LatestEvents } from "./latest-events"

/** A moment on the run's event track: a release, a check verdict, a spawn, a crash or a steer. */
export interface TraceEvent extends FlowMarker {}

export interface TraceWorkspaceProps extends Omit<TraceWaterfallProps, "trace" | "markers" | "onSelect" | "onTimeChange" | "selectedId" | "onDeselect" | "graph" | "latestEvents"> {
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
  /**
   * What the trace cannot say about a live agent, by agent id: its activity, thinking line, latest events, commits or
   * result. The Graph view draws them on the agent's live card; status, model, cost and lifetime come from the trace.
   */
  agentCards?: Readonly<Record<string, Partial<AgentGraphNode>>>
  /** Existing graph layouts and recorded edges/tools; node identity and clock stay with this workspace. */
  agentGraph?: Partial<Pick<AgentGraphProps, "edges" | "tools" | "calls" | "you" | "direction" | "title" | "className">> & { defaultLayout?: AgentGraphProps["layout"] }
  className?: string
}

/** The agent that owns a span: the span itself when it is an agent, else its nearest agent ancestor. */
function agentOf(span: FlowSpan, byId: Map<string, FlowSpan>): FlowSpan | undefined {
  for (let cursor: FlowSpan | undefined = span; cursor; cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined) {
    if (cursor.kind === "pipeline") return cursor
  }
  return undefined
}

/** The trace's agents as a spawn tree at the cursor: an agent not started by then is left out, one that ends after it is
 *  still running, so the Graph and the Timeline always show the same moment. */
function agentGraphAt(spans: readonly FlowSpan[], byId: Map<string, FlowSpan>, at: number | null, epoch: number | undefined, cards: TraceWorkspaceProps["agentCards"], extraEdges: readonly AgentGraphEdge[] = []) {
  const nodes: AgentGraphNode[] = [], edges: AgentGraphEdge[] = [], seen = new Set<string>()
  const timed = new Set(spans.flatMap(span => span.kind === "pipeline" && span.id ? [span.id] : []))
  const recorded = new Map<string, AgentGraphEvent[]>()
  for (const [index, span] of spans.entries()) {
    if (span.kind === "pipeline" || (at !== null && span.startMs > at)) continue
    const owner = agentOf(span, byId)
    if (!owner?.id) continue
    const events = recorded.get(owner.id) ?? []
    const endpoints = [{ suffix: "start", label: "Started ", time: span.startMs }]
    if (span.status !== "running" && span.endMs !== span.startMs && (at === null || span.endMs <= at)) endpoints.push({ suffix: "end", label: "Recorded ", time: span.endMs })
    for (const endpoint of endpoints) events.push({ id: (span.id ?? String(index)) + ":" + endpoint.suffix, label: endpoint.label + span.name, at: epoch == null || !Number.isFinite(epoch) ? undefined : epoch + endpoint.time })
    recorded.set(owner.id, events)
  }
  for (const span of spans) {
    if (span.kind !== "pipeline" || !span.id || seen.has(span.id) || (at !== null && span.startMs > at)) continue
    seen.add(span.id)
    const card = cards?.[span.id]
    const state = at !== null && (span.endMs > at || span.status === "running") ? "running" : runStatus(span.status ?? "unknown")
    const activity = (span.activityAt ?? []).reduce((last, time) => Number.isFinite(time) && (at === null || time <= at) ? Math.max(last, time) : last, -Infinity)
    const events = (card?.events ?? recorded.get(span.id) ?? []).filter(event => at === null || epoch != null && event.at != null && event.at <= epoch + at).sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    const timing = activityTiming({ events,
      lastActivityAt: epoch != null && Number.isFinite(epoch) && Number.isFinite(activity) ? epoch + activity : at === null ? card?.lastActivityAt : undefined,
      medianEventGapMs: span.medianEventGapMs ?? (at === null ? card?.medianEventGapMs : undefined),
    })
    nodes.push({ ...card, id: span.id, label: card?.label ?? span.name, model: card?.model ?? span.detail,
      status: at === null && card?.status ? card.status : state === "done" ? "succeeded" : state,
      costUsd: at === null ? card?.costUsd ?? span.costUsd : span.endMs <= at ? span.costUsd : undefined,
      startedAt: epoch == null || !Number.isFinite(epoch) ? at === null ? card?.startedAt : undefined : epoch + span.startMs,
      ...timing, events: events.slice(-4),
      turn: at === null ? card?.turn : undefined, result: at === null ? card?.result ?? span.output : span.endMs <= at ? span.output : undefined,
      commits: at === null ? card?.commits : undefined, tokens: at === null ? card?.tokens : undefined,
    })
    const parent = span.parentId ? byId.get(span.parentId) : undefined, spawner = parent && agentOf(parent, byId)
    if (spawner?.id) edges.push({ from: spawner.id, to: span.id, kind: "spawn" })
  }
  for (const [id, card] of Object.entries(cards ?? {})) if (!timed.has(id)) {
    nodes.push(at === null ? { ...card, id, label: card.label ?? id, status: card.status ?? "unknown" }
      : { id, label: card.label ?? id, model: card.model, harness: card.harness, role: card.role, status: "unknown", turn: "Timing unavailable at this cursor" })
  }
  const ids = new Set(nodes.map(node => node.id))
  for (const edge of extraEdges) if (ids.has(edge.from) && ids.has(edge.to) && (edge.kind !== "spawn" || !edges.some(prior => prior.kind === "spawn" && prior.from === edge.from && prior.to === edge.to))) edges.push(edge)
  return { nodes, edges }
}

function timelineItems(entries: readonly AgentTranscriptEntry[], streaming: boolean): AgentTimelineItem[] {
  return entries.map((entry, index): AgentTimelineItem => {
    if (entry.kind === "message") {
      return { id: entry.id, kind: "message", role: entry.role, content: entry.content, isStreaming: streaming && index === entries.length - 1 }
    }
    if (entry.kind === "tool") return { id: entry.id, kind: "tool", call: entry.call }
    if (entry.kind === "notice") return { id: entry.id, kind: "custom", content: <p className="text-xs text-muted-foreground">{entry.text}</p> }
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
  trace, streamUrl, events, onTimeChange, files, scoreboard, selectedAgentId, onSelectAgent, agentCards, agentGraph, className, ...waterfall
}: TraceWorkspaceProps) {
  const byId = useMemo(() => new Map(trace.spans.flatMap((span) => (span.id ? [[span.id, span] as const] : []))), [trace])
  const [ownSelection, setOwnSelection] = useState<string>()
  const selected = selectedAgentId ?? ownSelection
  const select = (agentId: string | undefined) => { setOwnSelection(agentId); onSelectAgent?.(agentId) }
  const agent = selected ? byId.get(selected) : undefined, card = selected ? agentCards?.[selected] : undefined
  const agentId = agent?.id ?? (card ? selected : undefined), agentName = agent?.name ?? card?.label ?? agentId, agentModel = agent?.detail ?? card?.model
  const { defaultLayout = "tree", ...graphOptions } = agentGraph ?? {}
  const [graphLayout, setGraphLayout] = useState<"tree" | "hub">(defaultLayout)
  const [cursor, setCursor] = useState<number | null>(null)
  const stream = useAgentStream(selected && streamUrl ? streamUrl(selected) : undefined)

  // As of the cursor: entries that began by then, measured on the trace clock (trace ms from the run's first span).
  // The run's epoch comes from the page (`startedAt`); without it, the agent's first message anchors its own start.
  const origin = useMemo(() => {
    if (waterfall.startedAt !== undefined) return waterfall.startedAt
    const first = stream.entries[0]?.at
    return agent && first !== undefined ? first - agent.startMs : undefined
  }, [waterfall.startedAt, agent, stream.entries])
  const graph = useMemo(() => agentGraphAt(trace.spans, byId, cursor, waterfall.startedAt, agentCards, agentGraph?.edges), [trace, byId, cursor, waterfall.startedAt, agentCards, agentGraph?.edges])
  const graphNow = cursor !== null && waterfall.startedAt !== undefined ? waterfall.startedAt + cursor : undefined
  const shown = cursor === null || origin === undefined ? stream.entries : stream.entries.filter((entry) => entry.at - origin <= cursor)
  // Live means the stream is open and producing now: an ended, unreachable or scrubbed stream is not.
  const live = stream.alive && !stream.error && cursor === null
  const items = useMemo(() => timelineItems(shown, live), [shown, live])

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
      <TraceWaterfall {...waterfall} trace={trace} markers={events} selectedId={agentId} onDeselect={() => select(undefined)}
        onSelect={span => { const owner = agentOf(span, byId); if (owner?.id) select(owner.id) }}
        onTimeChange={time => { setCursor(time); onTimeChange?.(time) }}
        latestEvents={<LatestEvents agents={graph.nodes} now={graphNow} live={cursor === null} selectedId={agentId} onSelect={select} />}
        graph={<section className="flex h-[60vh] min-h-[480px] flex-col" aria-label="Agent graph">
          <label className="flex h-8 shrink-0 items-center justify-end gap-2 px-3 text-xs text-muted-foreground">Layout
            <select aria-label="Graph layout" value={graphLayout} onChange={event => setGraphLayout(event.currentTarget.value as "tree" | "hub")} className="rounded-[var(--radius-control)] border border-border bg-card px-2 py-1 text-foreground"><option value="tree">Tree</option><option value="hub">Hub</option></select>
          </label>
          <AgentGraph {...graphOptions} layout={graphLayout} renderEventIcon={event => toolGlyph(event.label)} nodes={graph.nodes} edges={graph.edges}
            selectedId={agentId ?? null} onSelect={select} showLatestEvents={false} now={graphNow}
            live={cursor === null && graph.nodes.some(node => ["running", "waiting", "needs-you", "failed"].includes(node.status))}
            className={cn("min-h-0 flex-1", graphOptions.className)} />
        </section>} />
      {/* Without files the run has no code to follow, so no empty 70vh panel is reserved for it. */}
      {files && (
        <section aria-label="Code at the cursor" className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-card">{files}</section>
      )}
      {scoreboard && (
        <section aria-label="Scoreboard at the cursor" className="overflow-hidden rounded-xl border border-border bg-card">{scoreboard}</section>
      )}
      {agentId && (
        // A drawer over the right edge: the code workspace keeps its full width underneath.
        <aside aria-label={`${agentName} conversation`} onKeyDown={(event) => { if (event.key === "Escape") select(undefined) }}
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col border-l border-border bg-card shadow-2xl">
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", live ? "bg-[var(--surface-info-text)]" : "bg-muted-foreground")} aria-hidden data-motion={live ? "essential" : undefined} style={live ? ambientStyle : undefined} onAnimationStart={syncAmbient} />
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{agentName}</h3>
            {agentModel && <span className="truncate text-xs text-muted-foreground">{agentModel}</span>}
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
            data-primary-content=""
            className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
          >
            {streamUrl && (cursor === null || origin !== undefined)
              ? <AgentTimeline items={items} isThinking={live && items.length === 0} emptyState={<p className="p-4 text-sm text-muted-foreground">{stream.error ?? "No messages yet."}</p>} />
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
