"use client"

import { useEffect, useReducer } from "react"
import type { ToolCallData, ToolCallType } from "@tangle-network/ui/run"

/** Host-owned authenticated streams keep their own reconnect and session lifecycle. */
export interface AgentStreamSource {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void
  close(): void
}
export type AgentStreamOpener = (url: string, onLiveChange?: (live: boolean) => void) => AgentStreamSource

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
    /** A notice's origin: the agent's `delegated-input`, its `recorded-result`, or a capture fact such as `capture-unavailable`. */
    provenance?: string
    toolCallId?: string
    toolName?: string
    args?: unknown
    result?: unknown
  }
}

/** A transcript entry with the time it began, so a time cursor can show the conversation as of any moment. */
export type AgentTranscriptEntry =
  | { id: string; at: number; kind: "message"; role: "assistant" | "user"; content: string; sealed?: true }
  | { id: string; at: number; kind: "reasoning"; text: string }
  | { id: string; at: number; kind: "tool"; call: ToolCallData }
  | { id: string; at: number; kind: "notice"; text: string }

export interface AgentStreamState {
  generation?: string | number
  entries: AgentTranscriptEntry[]
  lastSeq: number
  /** The agent is still producing output. */
  alive: boolean
  /** Why the stream shows nothing new; a reconnect that delivers rows clears it. */
  error?: string
}

type Action =
  | { type: "rows"; generation?: string | number; rows: AgentStreamRow[]; alive?: boolean }
  | { type: "reset"; generation?: string | number }
  | { type: "end" }
  | { type: "error"; message: string }
  | { type: "unreachable" }

const TOOL_TYPES: ReadonlySet<string> = new Set(["bash", "read", "write", "edit", "glob", "grep", "list", "download", "inspect", "audit"])

const toolType = (name: string | undefined): ToolCallType => {
  const key = (name ?? "").toLowerCase()
  return (TOOL_TYPES.has(key) ? key : "unknown") as ToolCallType
}

const toolText = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined
  return typeof value === "string" ? value : JSON.stringify(value)
}

const failed = (result: unknown): boolean =>
  typeof result === "object" && result !== null && ("error" in result || (result as { is_error?: unknown }).is_error === true)

// A recorded input or result is JSON when it is not plain text; fence it so it reads as data.
const recorded = (text: string): string => {
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === "object" && value !== null ? `\`\`\`json\n${text}\n\`\`\`` : text
  } catch {
    return text
  }
}

/** Fold stream rows into transcript entries: text of one turn merges, a tool call becomes a row its result completes. */
export function foldAgentRows(entries: AgentTranscriptEntry[], rows: readonly AgentStreamRow[]): AgentTranscriptEntry[] {
  const next = [...entries]
  for (const row of rows) {
    const at = Date.parse(row.at)
    const { event } = row
    const last = next[next.length - 1]
    if (event.kind === "text" && event.text) {
      if (last?.kind === "message" && last.role === "assistant" && !last.sealed) next[next.length - 1] = { ...last, content: last.content + event.text }
      else next.push({ id: `m-${row.seq}`, at, kind: "message", role: "assistant", content: event.text })
    } else if (event.kind === "user" && event.text) {
      next.push({ id: `u-${row.seq}`, at, kind: "message", role: "user", content: event.text })
    } else if (event.kind === "notice" && event.text) {
      // The agent's delegated input and its recorded result are its conversation when no native one was captured.
      if (event.provenance === "delegated-input") next.push({ id: `u-${row.seq}`, at, kind: "message", role: "user", content: recorded(event.text) })
      // A recorded result is whole; later text starts its own message rather than appending to it.
      else if (event.provenance === "recorded-result") next.push({ id: `m-${row.seq}`, at, kind: "message", role: "assistant", content: recorded(event.text), sealed: true })
      else next.push({ id: `n-${row.seq}`, at, kind: "notice", text: event.text })
    } else if (event.kind === "reasoning" && event.text) {
      if (last?.kind === "reasoning") next[next.length - 1] = { ...last, text: last.text + event.text }
      else next.push({ id: `r-${row.seq}`, at, kind: "reasoning", text: event.text })
    } else if (event.kind === "tool-call") {
      const id = event.toolCallId ?? `t-${row.seq}`
      next.push({
        id, at, kind: "tool",
        call: { id, type: toolType(event.toolName), label: event.toolName ?? "tool", status: "running", detail: toolText(event.args) },
      })
    } else if (event.kind === "tool-result") {
      const index = next.findIndex((entry) => entry.kind === "tool" && entry.call.id === event.toolCallId)
      const entry = next[index]
      if (entry?.kind === "tool") {
        next[index] = {
          ...entry,
          call: { ...entry.call, status: failed(event.result) ? "error" : "success", output: toolText(event.result), duration: Math.max(0, at - entry.at) },
        }
      }
    }
  }
  return next
}

function reduce(state: AgentStreamState, action: Action): AgentStreamState {
  switch (action.type) {
    case "reset":
      return { generation: action.generation, entries: [], lastSeq: 0, alive: true }
    case "rows": {
      // A new generation means the server rebuilt the stream: start over rather than append to stale rows.
      const base = action.generation !== undefined && action.generation !== state.generation ? { entries: [], lastSeq: 0 } : state
      const fresh = action.rows.filter((row) => row.seq > base.lastSeq)
      return {
        generation: action.generation ?? state.generation,
        entries: foldAgentRows(base.entries, fresh),
        lastSeq: fresh.reduce((max, row) => Math.max(max, row.seq), base.lastSeq),
        alive: action.alive ?? state.alive,
        error: undefined,
      }
    }
    case "end":
      return { ...state, alive: false, error: undefined }
    case "error":
      return { ...state, error: action.message }
    case "unreachable":
      // A refused stream is not a thinking agent: stop the ellipsis and say so until a reconnect delivers rows.
      return { ...state, error: "The agent stream is unreachable; the viewer may be closed." }
  }
}

/**
 * Follow one agent's message stream over Server-Sent Events: `rows`, `reset` and `end` events, reconnecting with
 * `?after=<lastSeq>` when the server closes the connection, so a long turn streams without gaps or repeats.
 */
export function useAgentStream(url: string | undefined, openEventSource?: AgentStreamOpener): AgentStreamState {
  const [state, dispatch] = useReducer(reduce, { entries: [], lastSeq: 0, alive: false })
  useEffect(() => {
    if (!url || (!openEventSource && typeof EventSource === "undefined")) return
    dispatch({ type: "reset" })
    let lastSeq = 0
    let closed = false
    let source: AgentStreamSource | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    const open = () => {
      const target = new URL(url, globalThis.location?.href)
      if (lastSeq > 0) target.searchParams.set("after", String(lastSeq))
      source = openEventSource ? openEventSource(target.toString(), live => { if (!closed && !live) dispatch({ type: "unreachable" }) }) : new EventSource(target.toString())
      // The native transport reconnects here; an injected transport owns its session and reconnect policy.
      let opened = false
      if (!openEventSource) (source as EventSource).onopen = () => { opened = true }
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
      if (!openEventSource) (source as EventSource).onerror = () => {
        source?.close()
        if (closed) return
        if (!opened) dispatch({ type: "unreachable" })
        retry = setTimeout(open, 1_000)
      }
    }
    open()
    return () => { closed = true; clearTimeout(retry); source?.close() }
  }, [url, openEventSource])
  return state
}
