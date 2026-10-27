"use client"

import { useEffect, useReducer } from "react"
import type { ToolCallData, ToolCallType } from "@tangle-network/ui/run"
import type { ToolPart } from "@tangle-network/ui/types"

/** One row of an agent's message stream (tangle-tools `/api/discovery/runs/<run>/agents/<agent>/stream`). */
export interface AgentStreamRow {
  seq: number
  /** ISO time the event happened. */
  at: string
  stream?: string
  attempt?: number
  event: {
    kind: "text" | "reasoning" | "tool-call" | "tool-result" | "user" | "notice" | (string & {})
    text?: string
    /** A notice's origin: "delegated-input" (the task its parent recorded) or "capture-unavailable"; never agent text. */
    provenance?: string
    /** Where a notice's record lives, e.g. "parent root; task sha256:…; Runtime FileResultBlobStore". */
    source?: string
    toolCallId?: string
    toolName?: string
    args?: unknown
    result?: unknown
  }
}

/** A transcript entry with the time it began, so a time cursor can show the conversation as of any moment. */
export type AgentTranscriptEntry =
  | { id: string; at: number; kind: "message"; role: "assistant" | "user"; content: string }
  | { id: string; at: number; kind: "reasoning"; text: string }
  // `part` keeps the raw arguments and result, so the expanded row shows them whole, not the one-line `call.detail`.
  | { id: string; at: number; kind: "tool"; call: ToolCallData; part: ToolPart }
  | { id: string; at: number; kind: "notice"; provenance: string; text: string; source?: string }

export interface AgentStreamState {
  generation?: string | number
  entries: AgentTranscriptEntry[]
  lastSeq: number
  /** The agent is still producing output. */
  alive: boolean
  error?: string
}

type Action =
  | { type: "rows"; generation?: string | number; rows: AgentStreamRow[]; alive?: boolean }
  | { type: "reset"; generation?: string | number }
  | { type: "end" }
  | { type: "error"; message: string }

const TOOL_TYPES: ReadonlySet<string> = new Set(["bash", "read", "write", "edit", "glob", "grep", "list", "download", "inspect", "audit"])

const toolType = (name: string | undefined): ToolCallType => {
  const key = (name ?? "").toLowerCase()
  return (TOOL_TYPES.has(key) ? key : "unknown") as ToolCallType
}

const brief = (value: unknown, max = 240): string | undefined => {
  if (value === undefined || value === null) return undefined
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const failed = (result: unknown): boolean =>
  typeof result === "object" && result !== null && ("error" in result || (result as { is_error?: unknown }).is_error === true)

/** Fold stream rows into transcript entries: text of one turn merges, a tool call becomes a row its result completes. */
export function foldAgentRows(entries: AgentTranscriptEntry[], rows: readonly AgentStreamRow[]): AgentTranscriptEntry[] {
  const next = [...entries]
  for (const row of rows) {
    const at = Date.parse(row.at)
    const { event } = row
    const last = next[next.length - 1]
    if (event.kind === "text" && event.text) {
      if (last?.kind === "message" && last.role === "assistant") next[next.length - 1] = { ...last, content: last.content + event.text }
      else next.push({ id: `m-${row.seq}`, at, kind: "message", role: "assistant", content: event.text })
    } else if (event.kind === "user" && event.text) {
      next.push({ id: `u-${row.seq}`, at, kind: "message", role: "user", content: event.text })
    } else if (event.kind === "notice" && event.text) {
      next.push({ id: `n-${row.seq}`, at, kind: "notice", provenance: event.provenance ?? "notice", text: event.text, source: event.source })
    } else if (event.kind === "reasoning" && event.text) {
      if (last?.kind === "reasoning") next[next.length - 1] = { ...last, text: last.text + event.text }
      else next.push({ id: `r-${row.seq}`, at, kind: "reasoning", text: event.text })
    } else if (event.kind === "tool-call") {
      const id = event.toolCallId ?? `t-${row.seq}`
      next.push({
        id, at, kind: "tool",
        call: { id, type: toolType(event.toolName), label: event.toolName ?? "tool", status: "running", detail: brief(event.args, 120) },
        part: { type: "tool", id, tool: event.toolName ?? "tool", state: { status: "running", input: event.args, time: { start: at } } },
      })
    } else if (event.kind === "tool-result") {
      const index = next.findIndex((entry) => entry.kind === "tool" && entry.call.id === event.toolCallId)
      const entry = next[index]
      if (entry?.kind === "tool") {
        const status = failed(event.result) ? "error" : "success"
        next[index] = {
          ...entry,
          call: { ...entry.call, status, output: brief(event.result), duration: Math.max(0, at - entry.at) },
          part: { ...entry.part, state: { ...entry.part.state, status: status === "error" ? "error" : "completed", output: event.result, time: { start: entry.at, end: at } } },
        }
      }
    }
  }
  return next
}

/** When the stream ends, a tool call that never got its result has an unknown outcome: it settles to pending with "completion
 *  not captured", never left spinning and never given an invented result. */
function settle(entries: AgentTranscriptEntry[]): AgentTranscriptEntry[] {
  return entries.map((entry) => entry.kind === "tool" && entry.part.state.status === "running"
    ? { ...entry, call: { ...entry.call, detail: "completion not captured" }, part: { ...entry.part, state: { ...entry.part.state, status: "pending" } } }
    : entry)
}

function reduce(state: AgentStreamState, action: Action): AgentStreamState {
  switch (action.type) {
    case "reset":
      return { generation: action.generation, entries: [], lastSeq: 0, alive: true }
    case "rows": {
      // A new generation means the server rebuilt the stream: start over rather than append to stale rows.
      const base = action.generation !== undefined && action.generation !== state.generation ? { entries: [], lastSeq: 0 } : state
      const fresh = action.rows.filter((row) => row.seq > base.lastSeq)
      const next: AgentStreamState = {
        generation: action.generation ?? state.generation,
        entries: foldAgentRows(base.entries, fresh),
        lastSeq: fresh.reduce((max, row) => Math.max(max, row.seq), base.lastSeq),
        alive: action.alive ?? state.alive,
      }
      return next.alive ? next : { ...next, entries: settle(next.entries) }
    }
    case "end":
      return { ...state, alive: false, entries: settle(state.entries) }
    case "error":
      return { ...state, error: action.message }
  }
}

/**
 * Follow one agent's message stream over Server-Sent Events: `rows`, `reset` and `end` events, reconnecting with
 * `?after=<lastSeq>` when the server closes the connection, so a long turn streams without gaps or repeats.
 */
export function useAgentStream(url: string | undefined): AgentStreamState {
  const [state, dispatch] = useReducer(reduce, { entries: [], lastSeq: 0, alive: false })
  useEffect(() => {
    if (!url || typeof EventSource === "undefined") return
    dispatch({ type: "reset" })
    let lastSeq = 0
    let closed = false
    let source: EventSource | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const open = () => {
      const target = new URL(url, globalThis.location?.href)
      if (lastSeq > 0) target.searchParams.set("after", String(lastSeq))
      source = new EventSource(target.toString())
      source.addEventListener("rows", (message) => {
        const data = JSON.parse((message as MessageEvent<string>).data) as { generation?: string | number; events: AgentStreamRow[]; lastSeq?: number; alive?: boolean }
        lastSeq = Math.max(lastSeq, data.lastSeq ?? 0, ...data.events.map((row) => row.seq))
        dispatch({ type: "rows", generation: data.generation, rows: data.events, alive: data.alive })
      })
      source.addEventListener("reset", (message) => {
        lastSeq = 0
        dispatch({ type: "reset", generation: (JSON.parse((message as MessageEvent<string>).data) as { generation?: string | number }).generation })
      })
      source.addEventListener("end", () => { closed = true; source?.close(); dispatch({ type: "end" }) })
      source.onerror = () => {
        source?.close()
        if (!closed) retry = setTimeout(open, 1_000)
      }
    }
    open()
    return () => { closed = true; clearTimeout(retry); source?.close() }
  }, [url])
  return state
}
