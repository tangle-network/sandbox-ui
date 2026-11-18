import { formatSpanDuration as spanLabel, formatUtcTime as utcTime } from '@tangle-network/charts'
import { toolLabel } from '@tangle-network/charts/react/agent-graph'
import type { CSSProperties } from 'react'
import { AgentTimelineStep, type AgentTimelineItem, type AgentTimelineStepKind } from '@tangle-network/ui/chat/agent-timeline'
import { InlineThinkingItem } from '@tangle-network/ui/run/inline-thinking-item'
import type { ToolCallType } from '@tangle-network/ui/run'
import type { ToolPart } from '@tangle-network/ui/types'
import { getToolCategory, getToolDisplayMetadata } from '@tangle-network/ui/utils'
import { promptText } from './prompt-text.js'
import type { AgentTranscriptEntry } from '../agent-stream.js'

/** A live agent's transcript as the kit's timeline items: its words, its tool calls folded between them, idle replies folded. */

interface ToolCall { id: string; name: string; input?: string }
type CallState = 'returned' | 'error' | 'pending' | 'missing'

export function ToolStep({ item, previous }: { item: Extract<AgentTimelineItem, { kind: 'tool' }>; previous?: AgentTimelineStepKind }) {
  if (!item.part) return <AgentTimelineStep item={item} previous={previous} />
  const part = item.part, category = getToolCategory(part.tool)
  const tone = part.state.status === 'error' ? 'var(--surface-danger-text)' : ['command', 'write', 'edit'].includes(category) ? 'var(--tone-teal-icon)' : 'var(--accent-text)'
  return <div className="record-tool-row [&>[data-timeline-step]]:mx-0 [&_[data-run-row-duration]]:hidden rounded-[var(--radius-control)] border-l-2 border-l-[var(--record-tool-tone)] bg-[color-mix(in_srgb,var(--record-tool-tone)_7%,transparent)] px-1.5 py-0.5 hover:bg-[color-mix(in_srgb,var(--record-tool-tone)_14%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--record-tool-tone)_14%,transparent)]" style={{ '--record-tool-tone': tone } as CSSProperties} data-tool-category={category} data-tool-status={part.state.status}>
    <AgentTimelineStep item={item} previous={previous} renderToolActions={toolNote} />
  </div>
}

/** The tools the kit names itself ("Read", "Shell"); any other tool reads by its own name. */
const KIT_TOOLS = new Set(['bash', 'shell', 'command', 'execute', 'write', 'write_file', 'create_file', 'edit', 'patch', 'read', 'read_file', 'cat', 'grep', 'search', 'rg', 'glob', 'find', 'ls', 'web_search', 'web_fetch', 'fetch', 'task', 'agent', 'spawn'])
const TYPES: Record<string, ToolCallType> = { bash: 'bash', shell: 'bash', command: 'bash', execute: 'bash', read: 'read', read_file: 'read', cat: 'read', write: 'write', write_file: 'write', create_file: 'write', edit: 'edit', patch: 'edit', grep: 'grep', search: 'grep', rg: 'grep', glob: 'glob', find: 'glob', ls: 'list' }
/** `mcp__server__tool` reads as `tool`. */
const toolName = (name: string) => name.startsWith('mcp__') ? name.slice(name.lastIndexOf('__') + 2) || name : name
const inputOf = (raw: string | undefined): unknown => {
  if (raw === undefined) return undefined
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' ? value : raw
  } catch {
    return raw
  }
}
/** A failure reads as its message: `{"error":"File not found: x"}` is `File not found: x`. */
const failureText = (text: string) => {
  let body = text
  try {
    const value = JSON.parse(text) as { error?: unknown; message?: unknown }
    const said = typeof value?.error === 'string' ? value.error : typeof value?.message === 'string' ? value.message : undefined
    if (said) body = said
  } catch {
    /* Plain text. */
  }
  return (body.split('\n').find((line) => line.trim()) ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
}
/** The argument text shown on a collapsed call row, or the absence of it. */
const argsLabel = (input: string | undefined) => input === undefined ? 'args not captured' : /^\s*(\{\s*\}|null)?\s*$/.test(input) ? 'empty args' : null

/** One tool call as the kit's row: its verb and subject, collapsed; the input and output when opened; failures inline. */
function toolItem(id: string, call: ToolCall, output: string | undefined, state: CallState, durationMs: number | null, live: boolean, cost?: number): Extract<AgentTimelineItem, { kind: 'tool' }> {
  const name = toolName(call.name), status = state === 'error' ? 'error' : state === 'pending' || (state === 'missing' && live) ? 'running' : 'completed'
  const note = state === 'missing' && !live ? 'Result not captured' : undefined
  const duration = durationMs !== null && durationMs >= 0 ? durationMs : undefined
  const part: ToolPart = { type: 'tool', id, tool: name, state: {
    status, input: inputOf(call.input), ...(output !== undefined ? { output } : {}),
    ...(status === 'error' ? { error: failureText(output ?? '') || 'The call failed.' } : {}),
    ...(duration !== undefined ? { time: { start: 0, end: duration } } : {}),
    metadata: { ...(note ? { note } : {}), ...(cost !== undefined ? { costUsd: cost } : {}) },
  } }
  const known = KIT_TOOLS.has(name.toLowerCase()), meta = getToolDisplayMetadata(part)
  // A kit tool's subject (a path, a command) and absent arguments read inline; another tool's arguments wait in its opened row.
  const detail = argsLabel(call.input) ?? (known && meta.description || undefined)
  return { id, kind: 'tool', part, call: { id, type: TYPES[name.toLowerCase()] ?? 'unknown', label: known ? meta.title : toolLabel(name), status: status === 'error' ? 'error' : status === 'running' ? 'running' : 'success', ...(detail ? { detail } : {}), ...(duration !== undefined ? { duration } : {}) } }
}

/** The same prompt control for every turn; opening state belongs to the reader. */
export function PromptMore({ text, id, opened, setOpen }: { text: string; id: string; opened: ReadonlySet<string>; setOpen: (id: string, open: boolean) => void }) {
  if (promptText(text).length <= 280) return null
  const short = !opened.has(id)
  return <p className="ar-prompt-more"><button type="button" className="link-button" data-open-key={id} aria-expanded={!short} onClick={() => setOpen(id, short)}>{short ? 'Full prompt' : 'Shorter'}</button></p>
}

const idleReply = (text: string): string | null => text.trim().length <= 280 && /\b(waiting|ending the turn|end turn|no new updates|nothing new)\b/i.test(text) ? text.trim() : null

export function timelineItems(entries: readonly AgentTranscriptEntry[], streaming: boolean, opened?: ReadonlySet<string>): AgentTimelineItem[] {
  // Two or more identical idle replies in a row fold into one row; any other entry breaks the run.
  const rows: Array<{ entry: AgentTranscriptEntry; idle?: AgentTranscriptEntry[] }> = []
  let run: AgentTranscriptEntry[] = [], said: string | null = null
  const close = () => { if (run.length >= 2) rows.push({ entry: run[0]!, idle: run }); else for (const entry of run) rows.push({ entry }); run = []; said = null }
  for (const entry of entries) {
    const idle = entry.kind === 'message' && entry.role === 'assistant' && entry.provenance !== 'recorded-result' ? idleReply(entry.content) : null
    if (idle === null) { close(); rows.push({ entry }); continue }
    if (said !== null && said !== idle) close()
    said = idle; run.push(entry)
  }
  close()
  return foldTools(rows.map(({ entry, idle }, index): AgentTimelineItem => {
    if (idle) return idleItem(entry.id, idle.map((event) => ({ id: event.id, ...(Number.isFinite(event.at) ? { at: new Date(event.at).toISOString() } : {}), text: (event as Extract<AgentTranscriptEntry, { kind: 'message' }>).content })))
    if (entry.kind === 'message') {
      const body = entry.role === 'user' ? promptText(entry.content) : entry.content
      const short = entry.role === 'user' && opened && !opened.has(`prompt:${entry.id}`) && body.length > 280
      return { id: entry.id, kind: 'message', role: entry.role, content: short ? `${body.slice(0, 280).trimEnd()}…` : body, isStreaming: streaming && index === rows.length - 1, ...(entry.role === 'user' ? { ...(opened ? {} : { collapsedLines: 6 }), ...(Number.isFinite(entry.at) ? { timestamp: new Date(entry.at) } : {}) } : {}) }
    }
    if (entry.kind === 'tool') return toolItem(entry.id, { id: entry.id, name: entry.name ?? entry.call.label, input: entry.input === undefined ? entry.call.detail : typeof entry.input === 'string' ? entry.input : JSON.stringify(entry.input) }, entry.call.output, entry.call.status === 'error' ? 'error' : entry.call.status === 'running' ? streaming ? 'pending' : 'missing' : 'returned', entry.call.duration ?? null, streaming, entry.costUsd)
    if (entry.kind === 'notice' && entry.isError) return { id: entry.id, kind: 'status', tone: 'error', label: 'Execution error', detail: entry.text }
    if (entry.kind === 'notice') return { id: entry.id, kind: 'custom', content: <p className="text-xs text-muted-foreground">{entry.text}</p> }
    return { id: `reasoning:${entry.id}`, kind: 'custom', content: <InlineThinkingItem part={{ type: 'reasoning', text: entry.text }} defaultOpen={false} openWhileActive={false} /> }
  }), streaming)
}

/** Back-to-back tool calls (and the reasoning between them) fold into one row that names them, "Ran 6 tools · Read ×3,
 *  knowledge record"; their arguments and results open with it, so the agent's own words stay the conversation. A live
 *  agent's newest call stays its own row so the reader sees what is running now. */
function foldTools(items: AgentTimelineItem[], streaming: boolean): AgentTimelineItem[] {
  const out: AgentTimelineItem[] = []
  let run: AgentTimelineItem[] = []
  const flush = (last: boolean) => {
    const open = last && streaming ? run.splice(-1) : []
    const tools = run.filter((item): item is Extract<AgentTimelineItem, { kind: 'tool' }> => item.kind === 'tool')
    if (tools.length > 1) {
      const counts = new Map<string, number>()
      for (const tool of tools) counts.set(tool.call.label, (counts.get(tool.call.label) ?? 0) + 1)
      const names = [...counts].map(([name, n]) => n > 1 ? `${name} ×${n}` : name), more = names.length - 3
      out.push({ id: `fold:${run[0]!.id}`, kind: 'fold', items: run, summary: `Ran ${tools.length} tools · ${names.slice(0, 3).join(', ')}${more > 0 ? ` +${more} more` : ''}` })
    } else out.push(...run)
    out.push(...open)
    run = []
  }
  for (const item of items) {
    if (item.kind === 'tool' || item.kind === 'custom' && item.id.startsWith('reasoning:')) run.push(item)
    else { flush(false); out.push(item) }
  }
  flush(true)
  return out
}

const toolNote = (part: ToolPart) => {
  const note = part.state.metadata?.note, time = part.state.time
  // A duration only where measured and an outcome only when it says something; never a placeholder per row.
  const duration = time?.end != null && time.start != null ? spanLabel(time.end - time.start) : ''
  const result = typeof note === 'string' ? note : part.state.status === 'error' ? 'Failed' : part.state.status === 'running' ? 'Running' : ''
  return <span data-record-tool-summary="" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] tabular-nums" style={{ color: part.state.status === 'error' ? 'var(--surface-danger-text)' : 'hsl(var(--muted-foreground))' }}>{duration && <time data-record-tool-duration="">{duration}</time>}{result && <span data-record-tool-result="">{result}</span>}</span>
}

/** The exact idle replies stay inspectable inside one fold; a reply with no recorded time shows none. */
function idleItem(id: string, events: readonly { id: string; at?: string; text: string }[]): AgentTimelineItem {
  return {
    id, kind: 'fold', summary: `${events.length} idle turns · ${events[0]!.text}`,
    items: events.map((event) => ({ id: event.id, kind: 'custom', content: <div className="ar-idle-event" data-message={event.id}>{event.at && <time dateTime={event.at}>{utcTime(event.at)}</time>}<AgentTimelineStep item={{ id: event.id, kind: 'message', role: 'assistant', content: event.text }} /></div> })),
  }
}
