import { formatCompact as tokenLabel, formatSpanDuration as spanLabel, formatCost } from '@tangle-network/charts'
import type { CSSProperties, ReactNode } from 'react'
import { AgentTimelineStep, agentTimelineStepKind, type AgentTimelineItem, type AgentTimelineStepKind } from '@tangle-network/ui/chat/agent-timeline'
import { SpeakerHeader } from '@tangle-network/ui/chat/speaker'
import { ExpandedToolDetail } from '@tangle-network/ui/run/expanded-tool-detail'
import { InlineThinkingItem } from '@tangle-network/ui/run/inline-thinking-item'
import { RunRowShell } from '@tangle-network/ui/run/run-row-shell'
import type { ToolCallType } from '@tangle-network/ui/run'
import type { ToolPart } from '@tangle-network/ui/types'
import { getToolCategory, getToolDisplayMetadata } from '@tangle-network/ui/utils'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@tangle-network/ui/primitives'
import { Brain, Timer, Settings } from 'lucide-react'
import type { ConversationEvent as RecordEvent } from './types.js'
import { callsOf, compact, ms, preview, textOf, toolKey, utcTime } from './model.js'
import type { RecordIndex, ToolCall } from './model.js'
import { argsLabel, callStatus, foldRows, hollowSummary, idleReply, outputTokens, pollSummary, thinkingMarkers } from './conversation-rows.js'
import type { CallState, ConversationRow } from './conversation-rows.js'
import type { EventFlag } from './Conversation.js'
import { promptText } from './prompt-text.js'
import type { AgentTranscriptEntry } from '../agent-stream.js'

/** A run-lifecycle event (start, stop, restart), drawn as a thin marker row. */
export const isLifecycle = (event: RecordEvent) =>
  event.category === 'lifecycle' || event.detail.lifecycle !== undefined


export function ToolStep({ item, previous }: { item: Extract<AgentTimelineItem, { kind: 'tool' }>; previous?: AgentTimelineStepKind }) {
  if (!item.part) return <AgentTimelineStep item={item} previous={previous} />
  const part = item.part, cost = part.state.metadata?.costUsd, time = part.state.time, category = getToolCategory(part.tool)
  const tone = part.state.status === 'error' ? 'var(--surface-danger-text)' : ['command', 'write', 'edit'].includes(category) ? 'var(--tone-teal-icon)' : 'var(--accent-text)'
  return <HoverCard><HoverCardTrigger asChild><div className="record-tool-row [&>[data-timeline-step]]:mx-0 [&_[data-run-row-duration]]:hidden rounded-[var(--radius-control)] border-l-2 border-l-[var(--record-tool-tone)] bg-[color-mix(in_srgb,var(--record-tool-tone)_7%,transparent)] px-1.5 py-0.5 hover:bg-[color-mix(in_srgb,var(--record-tool-tone)_14%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--record-tool-tone)_14%,transparent)]" style={{ '--record-tool-tone': tone } as CSSProperties} data-tool-category={category} data-tool-status={part.state.status}>
    <AgentTimelineStep item={item} previous={previous} renderToolActions={toolNote} />
  </div></HoverCardTrigger><HoverCardContent className="record-tool-preview w-[min(640px,calc(100vw-32px))] max-h-[min(70vh,620px)] overflow-auto text-sm [&_pre]:text-[13px] [&_code]:text-[13px]" side="top" collisionPadding={16}>
    <strong>{item.call.label}</strong><dl className="my-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1"><dt>Duration</dt><dd className="m-0 text-right">{time?.end != null && time.start != null ? spanLabel(time.end - time.start) : 'Not recorded'}</dd><dt>Cost</dt><dd className="m-0 text-right">{typeof cost === 'number' ? formatCost(cost) : 'Not recorded'}</dd></dl>
    <ExpandedToolDetail part={part} />
  </HoverCardContent></HoverCard>
}

/** The tools the kit names itself ("Read", "Shell"); any other tool reads by its own name. */
const KIT_TOOLS = new Set(['bash', 'shell', 'command', 'execute', 'write', 'write_file', 'create_file', 'edit', 'patch', 'read', 'read_file', 'cat', 'grep', 'search', 'rg', 'glob', 'find', 'ls', 'web_search', 'web_fetch', 'fetch', 'task', 'agent', 'spawn'])
const TYPES: Record<string, ToolCallType> = { bash: 'bash', shell: 'bash', command: 'bash', execute: 'bash', read: 'read', read_file: 'read', cat: 'read', write: 'write', write_file: 'write', create_file: 'write', edit: 'edit', patch: 'edit', grep: 'grep', search: 'grep', rg: 'grep', glob: 'glob', find: 'glob', ls: 'list' }
/** `mcp__server__tool` reads as `tool` and `agent-runtime-coordination_send` as `coordination_send`. */
const toolName = (name: string) => (name.startsWith('mcp__') ? name.slice(name.lastIndexOf('__') + 2) || name : name).replace(/^agent-runtime-/, '')
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
  return compact(body.split('\n').find((line) => line.trim()) ?? '').slice(0, 200)
}

/** One tool call as the kit's row: its verb and subject, collapsed; the input and output when opened; failures inline. */
function toolItem(id: string, call: ToolCall, output: string | undefined, state: CallState, durationMs: number | null, live: boolean, cost?: number): Extract<AgentTimelineItem, { kind: 'tool' }> {
  const name = toolName(call.name), status = state === 'error' ? 'error' : state === 'pending' || (state === 'missing' && live) ? 'running' : 'completed'
  const note = state === 'ambiguous' || (state === 'missing' && !live) ? callStatus(state, live) : undefined
  const duration = durationMs !== null && durationMs >= 0 ? durationMs : undefined
  const part: ToolPart = { type: 'tool', id, tool: name, state: {
    status, input: inputOf(call.input), ...(output !== undefined ? { output } : {}),
    ...(status === 'error' ? { error: failureText(output ?? '') || 'The call failed.' } : {}),
    ...(duration !== undefined ? { time: { start: 0, end: duration } } : {}),
    metadata: { ...(note ? { note } : {}), ...(cost !== undefined ? { costUsd: cost } : {}) },
  } }
  const known = KIT_TOOLS.has(name.toLowerCase()), meta = getToolDisplayMetadata(part)
  const detail = argsLabel(call.input) ?? (meta.description || (known ? undefined : preview(call)))
  return { id, kind: 'tool', part, call: { id, type: TYPES[name.toLowerCase()] ?? 'unknown', label: known ? meta.title : name.replaceAll('_', ' '), status: status === 'error' ? 'error' : status === 'running' ? 'running' : 'success', ...(detail ? { detail } : {}), ...(duration !== undefined ? { duration } : {}) } }
}

function toolItems(id: string, call: ToolCall, result: RecordEvent | undefined, state: CallState, durationMs: number | null, live: boolean, opener: ConversationRenderContext['opener']): AgentTimelineItem[] {
  const output = result ? textOf(result) || result.detail.contentOmitted || '' : undefined
  const item = toolItem(id, call, output, state, durationMs, live, typeof result?.detail.costListUsd === 'number' ? result.detail.costListUsd : undefined)
  const clip = clipOf(result?.detail.clip)
  return result && clip ? [item, { id: `${id}:clip`, kind: 'custom', content: <ClipNote clip={clip} open={opener(result)} /> }] : [item]
}

/** The same prompt control for retained and streamed turns; opening state belongs to the reader. */
export function PromptMore({ text, id, opened, setOpen }: { text: string; id: string; opened: ReadonlySet<string>; setOpen: (id: string, open: boolean) => void }) {
  if (promptText(text).length <= 280) return null
  const short = !opened.has(id)
  return <p className="ar-prompt-more"><button type="button" className="link-button" data-open-key={id} aria-expanded={!short} onClick={() => setOpen(id, short)}>{short ? 'Full prompt' : 'Shorter'}</button></p>
}

/** Live values use the same canonical items and tool presentation as retained conversations. */
export function timelineItems(entries: readonly AgentTranscriptEntry[], streaming: boolean, opened?: ReadonlySet<string>): AgentTimelineItem[] {
  const rows = foldRows<AgentTranscriptEntry, string>(entries.map(event => ({ kind: 'event', key: event.id, event })),
    entry => entry.kind === 'message' && entry.role === 'assistant' && entry.provenance !== 'recorded-result' ? idleReply(entry.content) : null,
    (a, b) => a === b, events => ({ kind: 'idle', key: events[0]!.id, events }))
  return rows.map((row, index): AgentTimelineItem => {
    const entry = row.kind === 'event' ? row.event : row.events[0]!
    if (row.kind === 'idle') return idleItem(entry.id, row.events.map(event => ({ id: event.id, at: Number.isFinite(event.at) ? new Date(event.at).toISOString() : undefined, text: (event as Extract<AgentTranscriptEntry, { kind: 'message' }>).content })))
    if (entry.kind === 'message') {
      const body = entry.role === 'user' ? promptText(entry.content) : entry.content
      const short = entry.role === 'user' && opened && !opened.has(`prompt:${entry.id}`) && body.length > 280
      return { id: entry.id, kind: 'message', role: entry.role, content: short ? `${body.slice(0, 280).trimEnd()}…` : body, isStreaming: streaming && index === rows.length - 1, ...(entry.role === 'user' && Number.isFinite(entry.at) ? { timestamp: new Date(entry.at) } : {}) }
    }
    if (entry.kind === 'tool') return toolItem(entry.id, { id: entry.id, name: entry.name ?? entry.call.label, input: entry.input === undefined ? entry.call.detail : typeof entry.input === 'string' ? entry.input : JSON.stringify(entry.input) }, entry.call.output, entry.call.status === 'error' ? 'error' : entry.call.status === 'running' ? streaming ? 'pending' : 'missing' : 'returned', entry.call.duration ?? null, streaming, entry.costUsd)
    if (entry.kind === 'notice' && entry.isError) return { id: entry.id, kind: 'status', tone: 'error', label: 'Execution error', detail: entry.text }
    if (entry.kind === 'notice') return { id: entry.id, kind: 'custom', content: <p className="text-xs text-muted-foreground">{entry.text}</p> }
    return { id: entry.id, kind: 'custom', content: <InlineThinkingItem part={{ type: 'reasoning', text: entry.text }} defaultOpen={false} openWhileActive={false} /> }
  })
}

const toolNote = (part: ToolPart) => {
  const note = part.state.metadata?.note, time = part.state.time
  const duration = time?.end != null && time.start != null ? spanLabel(time.end - time.start) : 'Not recorded'
  const result = typeof note === 'string' ? note : part.state.status === 'error' ? 'Failed' : part.state.status === 'running' ? 'Running' : 'Returned'
  return <span data-record-tool-summary="" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] tabular-nums" style={{ color: part.state.status === 'error' ? 'var(--surface-danger-text)' : 'hsl(var(--muted-foreground))' }}><time data-record-tool-duration="">{duration}</time><span data-record-tool-result="">{result}</span></span>
}

type Clip = { bytes: number; sha256: string | null }
const clipOf = (value: unknown): Clip | undefined => (value && typeof value === 'object' && 'bytes' in value ? (value as Clip) : undefined)
/** A clipped body names what was left out and opens its full source text. */
function ClipNote({ clip, open }: { clip?: Clip; open?: (sha256: string) => void }) {
  if (!clip) return null
  return (
    <p className="clip-note">
      <span>{new Intl.NumberFormat('en-US').format(clip.bytes)} bytes, middle omitted.</span>
      {clip.sha256 && open ? <button type="button" className="link-button" data-load-full={clip.sha256} onClick={() => open(clip.sha256!)}>Full output</button> : null}
    </p>
  )
}

export interface ConversationRenderContext {
  index: RecordIndex
  cutoff: number
  selected?: string
  opened: ReadonlySet<string>
  anchor: (event: RecordEvent) => string
  opener: (event: RecordEvent) => ((sha256: string) => void) | undefined
  setOpen: (key: string, open: boolean) => void
  flagMarks: (event: RecordEvent) => ReactNode
  paired: (event: RecordEvent, call: ToolCall) => RecordEvent[]
  thinkingSpan: ReadonlyMap<string, number>
  flags?: ReadonlyMap<string, readonly EventFlag[]>
  live: boolean
}

/** Repeated calls answered only by pending receipts: one row, the calls listed when opened. */
function pollItem(row: Extract<ConversationRow, { kind: 'polls' }>): AgentTimelineItem {
  const summary = pollSummary(row.events)
  const args = argsLabel(row.input) ?? compact(row.input ?? '')
  return {
    id: row.key,
    kind: 'custom',
    content: (
      <RunRowShell icon={<Timer size={14} aria-hidden="true" />} title={toolName(row.name)} description={[summary.label, args].filter(Boolean).join(' · ')} descriptionMono>
        <ol className="poll-calls">
          {row.events.map((event) => (
            <li key={event.id} data-message={event.id}><time dateTime={event.at}>{utcTime(event.at)}</time><span className="mono">{argsLabel(callsOf(event)[0]?.input) ?? compact(callsOf(event)[0]?.input ?? '')}</span></li>
          ))}
        </ol>
      </RunRowShell>
    ),
  }
}

/** The exact idle replies stay inspectable inside one shared fold in either conversation. */
function idleItem(id: string, events: readonly { id: string; at?: string; text: string }[], selected?: string): AgentTimelineItem {
  return {
    id, kind: 'fold', summary: `${events.length} idle turns · ${events[0]!.text}`,
    defaultOpen: events.some(event => event.id === selected),
    items: events.map(event => ({ id: event.id, kind: 'custom', content: <div className="ar-idle-event" data-message={event.id}><time dateTime={event.at}>{event.at ? utcTime(event.at) : 'Unknown time'}</time><AgentTimelineStep item={{ id: event.id, kind: 'message', role: 'assistant', content: event.text }} /></div> })),
  }
}

/** What one record row shows, as the kit's timeline items. */
export function rowItems(row: ConversationRow, context: ConversationRenderContext): AgentTimelineItem[] {
  if (row.kind === 'polls') return [pollItem(row)]
  if (row.kind === 'hollow') return [{ id: row.key, kind: 'custom', content: <RunRowShell icon={<Settings size={14} aria-hidden="true" />} title={hollowSummary(row.calls)} description="args not captured" durationMs={row.spanMs || undefined} /> }]
  if (row.kind === 'idle') return [idleItem(`${row.key}:${context.selected ?? ''}`, row.events.map(event => ({ id: event.id, at: event.at, text: textOf(event) })), context.selected)]
  const { index, cutoff, anchor, thinkingSpan, opened, paired, live } = context
  const event = row.event
  if (isLifecycle(event)) {
    const text = textOf(event)
    return [{ id: event.id, kind: 'custom', content: <p className={`lifecycle-note${event.detail.isError ? ' lifecycle-error' : ''}`}><b>{event.label}</b>{text && <span>{compact(text).slice(0, 280)}</span>}</p> }]
  }
  const message = textOf(event)
  const calls = callsOf(event)
  const reasoning = typeof event.detail.reasoning === 'string' ? event.detail.reasoning : ''
  const withheld = thinkingMarkers(event.detail)
  const failed = event.detail.responseStatus === 'error'
  const finding = event.detail.recordedClaim !== undefined
  const standalone = event.detail.toolCallId !== undefined || event.detail.role === 'toolResult'
  // The prompt an agent received is the reader's own bubble; a long one opens in full on request.
  if (event.detail.role === 'user' && message && !standalone) {
    const body = promptText(message)
    const short = body.length > 280 && !opened.has(`prompt:${anchor(event)}`)
    return [{ id: event.id, kind: 'message', role: 'user', content: short ? `${body.slice(0, 280).trimEnd()}…` : body, timestamp: new Date(event.at) }]
  }
  const items: AgentTimelineItem[] = []
  if (reasoning) items.push({ id: `${event.id}:reasoning`, kind: 'custom', content: <InlineThinkingItem part={{ type: 'reasoning', text: reasoning }} autoCollapse={false} /> })
  if (withheld.length) {
    // The provider withheld the text; the turn is sized by what the record measured: its output tokens and the time
    // since the agent's previous event.
    const output = outputTokens(event.detail)
    const span = thinkingSpan.get(event.id)
    const label = output !== null ? `${span !== undefined && span >= 1000 ? `for ${spanLabel(span)} · ` : ''}${tokenLabel(output)} output tokens · ${withheld.join(' · ')}` : withheld.join(' · ')
    items.push({ id: `${event.id}:thinking`, kind: 'custom', content: <span data-thinking-withheld><RunRowShell icon={<Brain size={14} aria-hidden="true" />} title="Thought" description={label} /></span> })
  }
  if (failed) items.push({ id: event.id, kind: 'status', tone: 'error', label: 'The request failed', detail: message ? compact(message).slice(0, 400) : 'No assistant response is present in this record.' })
  else if (finding) items.push({ id: event.id, kind: 'status', tone: 'info', label: 'Recorded finding', detail: compact(message).slice(0, 600) })
  else if (standalone) {
    const unpaired = event.detail.toolCallId !== undefined && (index.calls.get(toolKey(event.node, event.detail.toolCallId))?.length ?? 0) > 1
    items.push(...toolItems(event.id, { id: event.id, name: event.label || 'Tool result' }, event, unpaired ? 'ambiguous' : event.detail.isError ? 'error' : 'returned', null, live, context.opener))
  } else if (message) items.push({ id: event.id, kind: 'message', role: 'assistant', content: message })
  else if (!calls.length && !reasoning && !withheld.length) items.push({ id: event.id, kind: 'status', label: event.detail.contentOmitted ?? 'No text body is present in this record.' })
  const at = anchor(event)
  for (const call of calls) {
    const all = paired(event, call)
    const returned = all.filter((result) => ms(result.at) <= cutoff)
    const last = returned.at(-1)
    const ambiguous = (index.calls.get(toolKey(event.node, call.id))?.length ?? 0) > 1
    const state: CallState = ambiguous ? 'ambiguous' : last ? (last.detail.isError ? 'error' : 'returned') : all.some((result) => ms(result.at) > cutoff) ? 'pending' : 'missing'
    const recorded = typeof last?.detail.durationMs === 'number' ? last.detail.durationMs : null
    const duration = recorded ?? (last && last.detail.atBasis !== 'carried' ? ms(last.at) - ms(event.at) : null)
    items.push(...toolItems(`tool:${at}:${call.id}`, call, last, state, duration, live, context.opener))
  }
  return items
}

export function ConversationRowView({ row, items, previous, turn, context }: { row: ConversationRow; items: readonly AgentTimelineItem[]; previous?: AgentTimelineStepKind; turn?: boolean; context: ConversationRenderContext }) {
  const { selected, opened, anchor, setOpen, flagMarks, opener, flags } = context
  const events = row.kind === 'event' ? [row.event] : row.events
  const event = events[0]!
  const steps = <>{turn && <div className="ar-turn" data-turn-start><SpeakerHeader speaker={{ id: event.node, name: context.index.nodes.get(event.node)?.label ?? 'Agent' }} /><time dateTime={event.at} title={event.at}>{utcTime(event.at)}</time></div>}{items.map((item, i) => item.kind === 'tool' && item.part ? <ToolStep key={item.id} item={item} previous={i ? agentTimelineStepKind(items[i - 1]!) : previous} /> : <AgentTimelineStep key={item.id} item={item} previous={i ? agentTimelineStepKind(items[i - 1]!) : previous} renderToolActions={toolNote} />)}</>
  const rowProps = {
    className: ['chat-row', events.some((e) => e.id === selected) && 'selected', row.kind === 'event' && flags?.has(event.id) && 'flagged'].filter(Boolean).join(' '),
    'data-entry': event.id,
    title: utcTime(event.at),
    ...(row.kind === 'event' ? { 'data-message': event.id, 'data-message-node': event.node } : { [`data-${row.kind === 'polls' ? 'poll' : row.kind}-group`]: row.events.length }),
  }
  if (row.kind !== 'event' || isLifecycle(event)) return <div {...rowProps}>{steps}{row.kind === 'event' && flagMarks(event)}</div>
  const message = textOf(event)
  const standalone = event.detail.toolCallId !== undefined || event.detail.role === 'toolResult'
  const clip = clipOf(event.detail.clip)
  const prompt = event.detail.role === 'user' && !!message && !standalone, key = `prompt:${anchor(event)}`
  const short = prompt && promptText(message).length > 280 && !opened.has(key)
  const finding = event.detail.recordedClaim !== undefined
  const notes = (prompt ? [] : [event.detail.publicationNote, finding ? event.detail.assessment : undefined]).filter((note): note is string => Boolean(note))
  return (
    <article {...rowProps}>
      {steps}
      {prompt && <PromptMore text={message} id={key} opened={opened} setOpen={setOpen} />}
      {message && !standalone && !short && <ClipNote clip={!prompt && callsOf(event).length ? undefined : clip} open={opener(event)} />}
      {notes.map((note) => <p key={note} className="publication-note">{note}</p>)}
      {flagMarks(event)}
    </article>
  )
}
