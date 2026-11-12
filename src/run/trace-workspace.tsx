"use client"

import { type ReactNode, useMemo, useRef, useState } from "react"
import { toolGlyph } from "@tangle-network/charts/react"
import type { FlowMarker, FlowSpan, FlowTrace } from "@tangle-network/charts"
import { runStatus } from "@tangle-network/ui/run"
import { SegmentedControl } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { activityTiming } from "../workflows/run-ui-state"
import { AgentGraph, type AgentGraphEdge, type AgentGraphNode, type AgentGraphEvent, type AgentGraphProps } from "../workflows/AgentGraph"
import type { AgentStreamOpener } from "./agent-stream"
import { TraceWaterfall, type TraceWaterfallProps } from "./trace-waterfall"
import { useFollowTail } from "./use-follow-tail"
import { AgentConversationView, useAgentConversation } from "./agent-conversation"
import { AgentInspector, usePhone, useSplit } from "./agent-inspector"

type GraphLayout = NonNullable<AgentGraphProps["layout"]>

/** A moment on the run's event track: a release, a check verdict, a spawn, a crash or a steer. */
export interface TraceEvent extends FlowMarker {}

export interface TraceWorkspaceProps extends Omit<TraceWaterfallProps, "trace" | "markers" | "onSelect" | "onTimeChange" | "selectedId" | "onDeselect" | "graph" | "latestEvents"> {
  trace: FlowTrace
  /** The selected agent's message stream (Server-Sent Events: rows, reset, end; reconnects with ?after=lastSeq). */
  streamUrl?: (agentId: string) => string
  /** Optional host transport for account-bound streams. */
  openEventSource?: AgentStreamOpener
  events?: TraceEvent[]
  /** The time the reader moved to, in trace ms; null while following live or showing the whole run. */
  onTimeChange?: (t: number | null) => void
  /** The code workspace as of the cursor and scoped to the selected agent, usually a WorkspaceFilesPane; it spans the full width
   *  at the bounded height virtual panes need. Keep its key on the commit so a scrub keeps its state. */
  files?: ReactNode
  /** The scoreboard as of the cursor, under the code workspace; omitted when not given. */
  scoreboard?: ReactNode
  selectedAgentId?: string
  /** Hide the conversation while retaining its selected agent and file context. Defaults to open. */
  conversationOpen?: boolean
  /** Called with the agent the reader selected, or undefined when they close its drawer or press Escape. */
  onSelectAgent?: (agentId: string | undefined) => void
  /** Dock the inspector as a resizable split (drag or arrow keys; the width is remembered per viewer) instead of a fixed
   *  overlay over the right edge. Below 768px the inspector is always a full-screen sheet. */
  docked?: boolean
  /** Why the selected agent has no conversation, when the host knows (no transcript captured, harness without a stream).
   *  Shown in place of an empty transcript; without it the inspector says no conversation was recorded. */
  transcriptNote?: (agentId: string) => string | undefined
  /** The words that created the selected agent — its parent's commission — collapsed above its conversation. */
  commission?: { by?: string; text?: string }
  /** The host's own account of the selected agent beyond its trace facts, such as its profile: shown in the inspector's
   *  closed-by-default Details, after the conversation. */
  renderAgentDrawer?: (agentId: string) => ReactNode
  /**
   * What the trace cannot say about a live agent, by agent id: its activity, thinking line, latest events, commits or
   * result. Timed agents follow the trace cursor. Workers without recorded timing retain their live identity and metadata.
   */
  agentCards?: Readonly<Record<string, Partial<AgentGraphNode>>>
  /** Existing graph layouts and recorded edges/tools; node identity and clock stay with this workspace. */
  agentGraph?: Partial<Pick<AgentGraphProps, "edges" | "tools" | "calls" | "you" | "direction" | "title" | "className" | "wholeClaims">> & { defaultLayout?: AgentGraphProps["layout"] }
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
      status: at === null && card?.status ? card.status : state,
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

/**
 * The run workspace: the agent timeline and span waterfall over one clock, filling its parent's height, with the selected
 * agent's conversation at the center of its inspector, and the page's code workspace and scoreboard following the time cursor. Scrubbing is time travel:
 * every panel shows what was true at the cursor, and the conversation shows what had been said by then.
 */
export function TraceWorkspace({
  trace, streamUrl, openEventSource, events, onTimeChange, files, scoreboard, selectedAgentId, conversationOpen, onSelectAgent, renderAgentDrawer, transcriptNote, docked, commission, agentCards, agentGraph, className, ...waterfall
}: TraceWorkspaceProps) {
  const byId = useMemo(() => new Map(trace.spans.flatMap((span) => (span.id ? [[span.id, span] as const] : []))), [trace])
  const [ownSelection, setOwnSelection] = useState<string>()
  const selected = selectedAgentId ?? ownSelection
  const select = (agentId: string | undefined) => { setOwnSelection(agentId); onSelectAgent?.(agentId) }
  const agent = selected ? byId.get(selected) : undefined, card = selected ? agentCards?.[selected] : undefined
  const agentId = agent?.id ?? (card ? selected : undefined), agentName = agent?.name ?? card?.label ?? agentId, agentModel = agent?.detail ?? card?.model
  const showConversation = !!agentId && conversationOpen !== false
  const detail = showConversation && agentId ? renderAgentDrawer?.(agentId) : undefined
  const { defaultLayout = "tree", ...graphOptions } = agentGraph ?? {}
  const [graphLayout, setGraphLayout] = useState<GraphLayout>(defaultLayout)
  const [cursor, setCursor] = useState<number | null>(null)
  // As of the cursor: entries that began by then, measured on the trace clock (trace ms from the run's first span).
  const conversation = useAgentConversation(selected && streamUrl ? streamUrl(selected) : undefined, openEventSource,
    { cursor, startedAt: waterfall.startedAt, agentStartMs: agent?.startMs, silent: agentId ? transcriptNote?.(agentId) : undefined })
  const { shown, items, live, note, silent } = conversation
  const graph = useMemo(() => agentGraphAt(trace.spans, byId, cursor, waterfall.startedAt, agentCards, agentGraph?.edges), [trace, byId, cursor, waterfall.startedAt, agentCards, agentGraph?.edges])
  const selectedNode = graph.nodes.find(node => node.id === agentId)
  const facts = cursor === null || agent && agent.endMs <= cursor ? [...(agent?.facts ?? [])] : []
  for (const [label, value] of [["Recorded result", selectedNode?.result], ["Activity", selectedNode?.turn]] as const) {
    if (value && !facts.some(fact => fact.value === value)) facts.push({ label, value })
  }
  const graphNow = cursor !== null && waterfall.startedAt !== undefined ? waterfall.startedAt + cursor : undefined

  // Follow the newest output unless the reader scrolled up; then offer a "New output" pill instead of jumping.
  const scroller = useRef<HTMLDivElement>(null)
  const { unseen, jump } = useFollowTail(scroller, { identity: showConversation ? selected : undefined, content: items })
  const root = useRef<HTMLDivElement>(null)
  const phone = usePhone(), split = useSplit(root)
  const mode = phone ? "sheet" : docked ? "docked" : "overlay"
  const status = live ? "running" : selectedNode?.status ?? runStatus(agent?.status ?? "unknown")
  const failure = facts.find(fact => fact.label === "Failure")?.value ?? (status === "failed" ? selectedNode?.result ?? undefined : undefined)
  // A commission the conversation already opens with is not printed twice.
  const said = (text?: string) => !!text && shown.some(entry => entry.kind === "message" && entry.role === "user" && entry.content.trim() === text.trim())

  const left = (<>
      <div className={cn("flex min-h-[320px] min-w-0 flex-1 flex-col", showConversation && mode === "overlay" && "lg:mr-[420px]")}>
      <TraceWaterfall {...waterfall} maxHeight={waterfall.maxHeight ?? "fill"} trace={trace} markers={events} selectedId={agentId} onDeselect={() => select(undefined)}
        onSelect={span => { const owner = agentOf(span, byId); if (owner?.id) select(owner.id) }}
        onTimeChange={time => { setCursor(time); onTimeChange?.(time) }}
        graph={<section className="relative flex min-h-[320px] flex-1 flex-col" style={typeof waterfall.maxHeight === "number" ? { height: waterfall.maxHeight } : undefined} aria-label="Agent graph">
          <SegmentedControl aria-label="Graph layout" value={graphLayout} onValueChange={setGraphLayout} className="absolute right-2 top-1 z-10"
            options={[{ value: "grid", label: "Grid" }, { value: "tree", label: "Tree" }, { value: "hub", label: "Hub" }]} />
          <AgentGraph {...graphOptions} layout={graphLayout} renderEventIcon={event => toolGlyph(event.label)} nodes={graph.nodes} edges={graph.edges}
            selectedId={agentId ?? null} onSelect={select} showLatestEvents={false} now={graphNow}
            live={cursor === null && graph.nodes.some(node => ["running", "waiting", "needs-you", "failed"].includes(node.status))}
            className={cn("min-h-0 flex-1", graphOptions.className)} />
        </section>} />
      </div>
      {/* Without files the run has no code to follow, so no empty 70vh panel is reserved for it. */}
      {files && (
        <section aria-label="Code at the cursor" className="flex h-[70vh] min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">{files}</section>
      )}
      {scoreboard && (
        <section aria-label="Scoreboard at the cursor" className="shrink-0 overflow-hidden rounded-xl border border-border bg-card">{scoreboard}</section>
      )}
  </>)
  return (
    <div ref={root} className={cn("sandbox-trace-workspace flex h-full min-h-0 flex-row", className)}>
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-3", (files || scoreboard) && "overflow-y-auto")}>{left}</div>
      {showConversation && agentId && <>
        {mode === "docked" && <div {...split.separator} className="group relative w-3 shrink-0 cursor-col-resize touch-none outline-none">
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-[hsl(var(--ring))] group-focus-visible:w-0.5 group-focus-visible:bg-[hsl(var(--ring))]" />
        </div>}
        <AgentInspector name={agentName ?? agentId} model={agentModel && !/^not recorded$/i.test(agentModel) ? agentModel : undefined} status={status} span={agent} live={live}
          failure={failure} silent={note !== undefined && note === silent} commission={said(commission?.text) ? { by: commission?.by } : commission} facts={facts} detail={detail} scroller={scroller} unseen={unseen} onJump={() => jump()}
          onClose={() => select(undefined)} mode={mode} style={mode === "docked" ? { width: split.width } : undefined}>
          <AgentConversationView conversation={conversation} />
        </AgentInspector>
      </>}
    </div>
  )
}
