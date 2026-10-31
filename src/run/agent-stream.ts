"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEventStream, type AgentStreamOpener } from "./event-stream"
export type { AgentStreamSource, AgentStreamOpener } from "./event-stream"
import type { ToolCallData, ToolCallType } from "@tangle-network/ui/run"

/** One original producer row; native frames remain opaque until the product's Core projection. */
export interface AgentStreamRow {
  seq: number
  at?: string
  stream?: string
  attempt?: number
  type?: string
  data?: unknown
  event?: {
    kind: "text" | "reasoning" | "tool-call" | "tool-result" | "user" | "notice" | (string & {})
    text?: string
    provenance?: string
    toolCallId?: string
    toolName?: string
    args?: unknown
    result?: unknown
    isError?: boolean
    atBasis?: string
    durationMs?: number
    costUsd?: number
    id?: string
    sealed?: boolean
  }
}

export type AgentTranscriptEntry = { id: string; at: number; scope?: string; attempt?: number; provenance?: string; isError?: boolean } & (
  | { kind: "message"; role: "assistant" | "user"; content: string; sealed?: boolean }
  | { kind: "reasoning"; text: string }
  | { kind: "tool"; call: ToolCallData; name?: string; input?: unknown; costUsd?: number }
  | { kind: "notice"; text: string }
)
export interface AgentStreamPage {
  generation?: string | number
  events: AgentStreamRow[]
  firstSeq?: number | null
  lastSeq?: number | null
  hasEarlier?: boolean
  hasMore?: boolean
  alive?: boolean
  reset?: boolean
}
/** The actual producer's bounded history. Core projection is product-owned, never a parser in the SDK. */
export interface AgentStreamHistory {
  url: string
  alive: boolean
  projectRows?: (rows: readonly AgentStreamRow[]) => readonly AgentStreamRow[]
}
export interface AgentStreamState {
  generation?: string | number
  entries: AgentTranscriptEntry[]
  lastSeq: number
  alive: boolean
  error?: string
  history?: { loading: boolean; earlier: boolean; more: boolean; reading: boolean; beginning: boolean; emptyTail: boolean; older(): void; newer(): void; latest(): void; beginningPage(): void }
}
const textOf = (value: unknown): string | undefined => value == null ? undefined : typeof value === "string" ? value : JSON.stringify(value)
const failed = (value: unknown) => typeof value === "object" && value !== null && ("error" in value || (value as { is_error?: unknown }).is_error === true || (value as { isError?: unknown }).isError === true)
const recorded = (text: string) => { try { const value: unknown = JSON.parse(text); return value && typeof value === "object" ? `\`\`\`json\n${text}\n\`\`\`` : text } catch { return text } }
const TOOL_TYPES: ReadonlySet<string> = new Set(["bash", "read", "write", "edit", "glob", "grep", "list", "download", "inspect", "audit"])

/** One fold for live entries; attempt/session identity prevents repeated native call IDs from crossing turns. */
export function foldAgentRows(entries: AgentTranscriptEntry[], rows: readonly AgentStreamRow[]): AgentTranscriptEntry[] {
  const next = [...entries]
  for (const row of rows) {
    const event = row.event
    if (!event) continue
    const at = Date.parse(row.at ?? ""), scope = JSON.stringify([row.stream ?? null, row.attempt ?? null])
    const base = { id: event.id ?? `${scope}:${row.seq}`, at, scope, attempt: row.attempt, provenance: event.provenance, isError: event.isError }, last = next.at(-1)
    const kind = event.kind.replaceAll("_", "-").replace(/-delta$/, "")
    if ((kind === "text" || kind === "reasoning") && event.text) {
      if (kind === "text") {
        if (last?.kind === "message" && last.role === "assistant" && !last.sealed && last.scope === scope && !event.sealed) next[next.length - 1] = { ...last, content: last.content + event.text }
        else next.push({ ...base, kind: "message", role: "assistant", content: event.text, sealed: event.sealed })
      } else if (last?.kind === "reasoning" && last.scope === scope) next[next.length - 1] = { ...last, text: last.text + event.text }
      else next.push({ ...base, kind: "reasoning", text: event.text })
    } else if (kind === "user" && event.text) next.push({ ...base, kind: "message", role: "user", content: event.text })
    else if (kind === "notice" && event.text) {
      if (event.provenance === "delegated-input" || event.provenance === "recorded-result") next.push({ ...base, kind: "message", role: event.provenance === "delegated-input" ? "user" : "assistant", content: recorded(event.text), sealed: true })
      else next.push({ ...base, kind: "notice", text: event.text })
    } else if (kind === "tool-call" || kind === "tool-result") {
      const id = JSON.stringify([row.stream ?? null, row.attempt ?? null, event.toolCallId ?? row.seq])
      const index = next.findIndex(entry => entry.kind === "tool" && entry.call.id === id), prior = next[index]
      if (kind === "tool-call") {
        const name = event.toolName ?? "tool", type = name.toLowerCase()
        next.push({ ...base, id, kind: "tool", name, input: event.args, call: { id, type: (TOOL_TYPES.has(type) ? type : "unknown") as ToolCallType, label: name, status: "running", detail: textOf(event.args) } })
      } else if (prior?.kind === "tool") next[index] = { ...prior, costUsd: event.costUsd ?? prior.costUsd, call: { ...prior.call, status: event.isError || failed(event.result) ? "error" : "success", output: textOf(event.result), ...(event.durationMs !== undefined ? { duration: event.durationMs } : event.atBasis !== "carried" && Number.isFinite(at) && Number.isFinite(prior.at) ? { duration: Math.max(0, at - prior.at) } : {}) } }
      else next.push({ ...base, id, kind: "tool", call: { id, type: "unknown", label: event.toolName ?? "Tool result", status: event.isError || failed(event.result) ? "error" : "success", output: textOf(event.result) } })
    } else if (event.text) next.push({ ...base, kind: "notice", text: event.text })
  }
  return next
}

type Direction = "tail" | "head" | "after" | "before"
type Window = { identity?: string; rows: AgentStreamRow[]; generation?: string | number; first: number | null; lastSeq: number; alive: boolean; ended: boolean; loading: boolean; ready: boolean; earlier: boolean; more: boolean; reading: boolean; error?: string }
const empty = (identity: string | undefined, history?: AgentStreamHistory): Window => ({ identity, rows: [], first: null, lastSeq: -1, alive: !!identity && (history?.alive ?? true), ended: false, loading: !!history, ready: !history, earlier: false, more: false, reading: false })
function receive(prior: Window, page: AgentStreamPage, direction: Direction, fromHead: boolean): Window {
  if (!Array.isArray(page.events)) throw new Error("Invalid agent rows stream")
  const fresh = direction === "tail" || direction === "head" || page.reset || page.generation !== undefined && page.generation !== prior.generation
  const merged = fresh ? page.events : direction === "before" ? [...page.events, ...prior.rows] : [...prior.rows, ...page.events]
  let rows = [...new Map(merged.map(row => [row.seq, row])).values()].sort((a, b) => a.seq - b.seq)
  const trimmed = rows.length > 2000
  if (trimmed) rows = prior.reading ? rows.slice(0, 2000) : rows.slice(-2000)
  const first = fresh ? page.firstSeq ?? rows[0]?.seq ?? null : direction === "before" ? page.firstSeq ?? prior.first : trimmed && !prior.reading ? rows[0]?.seq ?? prior.first : prior.first
  const lastSeq = fresh ? page.lastSeq ?? rows.at(-1)?.seq ?? -1 : direction === "before" ? prior.lastSeq : page.lastSeq ?? rows.at(-1)?.seq ?? prior.lastSeq
  return { ...prior, rows, first, lastSeq, generation: page.generation ?? prior.generation, alive: page.alive ?? prior.alive, ended: page.alive === false, loading: false, ready: true, error: undefined,
    earlier: trimmed && direction !== "before" || (direction !== "after" || fresh ? page.hasEarlier ?? (first !== null && first > 0) : prior.earlier), more: direction === "before" ? prior.more : fromHead && !!page.hasMore }
}

async function readPage(url: string, direction: Direction, before: Window, signal: AbortSignal): Promise<AgentStreamPage> {
  const query = new URL(url, location.href), cursor = direction === "head" ? 200 : direction === "after" ? before.lastSeq : direction === "before" ? before.first : null
  query.searchParams.set("limit", "200")
  if (cursor !== null && cursor >= 0) query.searchParams.set(direction === "head" ? "before" : direction, String(cursor))
  if (before.generation !== undefined && cursor !== null) query.searchParams.set("generation", String(before.generation))
  const response = await fetch(query, { credentials: "same-origin", signal })
  if (!response.ok) throw new Error(`Transcript unavailable (HTTP ${response.status})`)
  return response.json() as Promise<AgentStreamPage>
}

function useAgentWindow(url: string | undefined, history?: AgentStreamHistory) {
  const identity = url ? JSON.stringify([url, history?.url]) : undefined
  const [stored, put] = useState(() => empty(identity, history)), current = useRef(stored)
  const state = stored.identity === identity ? stored : empty(identity, history)
  const [head, begin] = useState<string>(), [revision, reload] = useState(0)
  const beginning = identity !== undefined && head === identity
  const pageReader = useRef<(direction: Direction) => void>(() => {}), previous = useRef({ identity, alive: history?.alive })
  const update = (value: Window) => { if (value.identity === identity) { current.current = value; put(value) } }
  useEffect(() => {
    const retain = previous.current.identity === identity && previous.current.alive && history?.alive === false
    previous.current = { identity, alive: history?.alive }
    if (!retain) update(empty(identity, history))
    if (!url || !history) return
    const controller = new AbortController(), fromHead = beginning || (!history.alive && !retain)
    let cancelled = false, pending = false
    const load = async (direction: Direction) => {
      if (cancelled || pending) return
      pending = true
      const cursor = current.current.lastSeq
      try {
        const page = await readPage(history.url, direction, current.current, controller.signal)
        if (cancelled) return
        if (direction === "head" && !page.events.length) { queueMicrotask(() => void load("tail")); return }
        update(receive(current.current, page, direction, fromHead))
        if (!fromHead && direction !== "before" && !history.alive && page.hasMore && current.current.lastSeq !== cursor) queueMicrotask(() => void load("after"))
      } catch (cause) { if (!cancelled && !controller.signal.aborted) update({ ...current.current, loading: false, error: cause instanceof Error ? cause.message : String(cause) }) }
      finally { pending = false }
    }
    pageReader.current = direction => { if (direction === "before") update({ ...current.current, reading: true }); void load(direction) }
    void load(retain && current.current.lastSeq >= 0 ? "after" : fromHead ? "head" : "tail")
    return () => { cancelled = true; controller.abort(); pageReader.current = () => {} }
  }, [identity, history?.alive, beginning, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  return { state, current, update, beginning, begin, reload, pageReader }
}

/** Same named SSE lifecycle for every consumer; the actual history endpoint owns bounded bootstrap/pages. */
export function useAgentStream(url: string | undefined, openEventSource?: AgentStreamOpener, history?: AgentStreamHistory): AgentStreamState {
  const { state, current, update, beginning, begin, reload, pageReader } = useAgentWindow(url, history)
  const streamUrl = useCallback(() => {
    const target = new URL(url!, location.href)
    if (history && current.current.generation !== undefined) target.searchParams.set("generation", String(current.current.generation))
    return target.toString()
  }, [url, !!history])
  useEventStream(!url || history && (!state.ready || state.ended || state.reading || beginning || !history.alive) ? undefined : streamUrl, { opener: openEventSource, after: () => current.current.lastSeq,
    onLiveChange: live => { if (!live && !current.current.ended) update({ ...current.current, error: current.current.error ?? "The agent stream is unreachable; the viewer may be closed." }) },
    events: {
      rows: message => { try { update(receive(current.current, JSON.parse(message.data) as AgentStreamPage, "after", false)) } catch (cause) { update({ ...current.current, error: String(cause) }) } },
      reset: message => { try { update({ ...empty(state.identity, history), generation: (JSON.parse(message.data) as AgentStreamPage).generation, ready: true, loading: false }) } catch (cause) { update({ ...current.current, error: String(cause) }) } },
      end: () => update({ ...current.current, alive: false, ended: true, loading: false, error: undefined }),
      unavailable: () => update({ ...current.current, error: "Live updates are temporarily unavailable" }),
    },
  })
  let entries: AgentTranscriptEntry[] = [], error = state.error
  try { entries = foldAgentRows([], history?.projectRows?.(state.rows) ?? state.rows) } catch (cause) { error = cause instanceof Error ? cause.message : String(cause) }
  return { generation: state.generation, entries, lastSeq: state.lastSeq, alive: state.alive, error,
    ...(history ? { history: { loading: state.loading, earlier: state.earlier, more: state.more, reading: state.reading, beginning, emptyTail: state.ended && !state.rows.length && state.first === null && state.lastSeq < 0,
      older: () => { if (current.current.identity === state.identity) pageReader.current("before") }, newer: () => { if (current.current.identity === state.identity) pageReader.current("after") }, latest: () => { begin(undefined); reload(value => value + 1) }, beginningPage: () => begin(state.identity) } } : {}) }
}
