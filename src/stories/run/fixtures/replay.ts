import type { AgentStreamOpener } from "../../../run"

/** One row as an agent's producer streams it: a message, reasoning, a tool call or its result. */
export type ReplayRow = { kind: string; text?: string; toolName?: string; toolCallId?: string; args?: unknown; result?: unknown; isError?: boolean }
export const call = (id: string, toolName: string, args: unknown, result: unknown, isError?: boolean): ReplayRow[] => [
  { kind: "tool-call", toolCallId: id, toolName, args }, { kind: "tool-result", toolCallId: id, toolName, result, isError },
]

/** A host transport that replays each agent's recorded rows 20 s apart from its start, then ends finished agents and keeps a running one open. */
export const replayOpener = (transcripts: Record<string, { rows: ReplayRow[]; ends: boolean }>, startOf: (id: string) => number): AgentStreamOpener => url => {
  const id = decodeURIComponent(url.split("/").at(-2) ?? ""), recorded = transcripts[id] ?? { rows: [], ends: true }, start = startOf(id)
  const listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>()
  const timer = setTimeout(() => {
    const events = recorded.rows.map((event, seq) => ({ seq, at: new Date(start + seq * 20_000).toISOString(), event }))
    for (const listener of listeners.get("rows") ?? []) listener(new MessageEvent("rows", { data: JSON.stringify({ events, lastSeq: events.length - 1 }) }))
    if (recorded.ends) for (const listener of listeners.get("end") ?? []) listener(new MessageEvent("end", { data: "{}" }))
  }, 50)
  return { addEventListener: (type, listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]), close: () => clearTimeout(timer) }
}
