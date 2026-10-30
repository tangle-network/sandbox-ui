import type { FlowSpan, FlowTrace } from '@tangle-network/charts'
import { formatCompact as fmt, formatSpanDuration as interval, formatUtcTime as utcTime, reportedCount, sumReportedCounts } from '@tangle-network/charts'
export { fmt, interval, utcTime }
import { isOpen, runStatus } from '@tangle-network/ui/run/status-meta'
import type { ConversationEvent as RecordEvent, ConversationNode as RecordNode, ConversationRecord as RunRecord } from './types.js'

export interface ToolCall {
  id: string
  name: string
  input?: string
  publicationNote?: string | null
}

export const ms = (value: string) => Date.parse(value)
export const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
/**
 * Recorded text names the host folders an agent ran in (`/home/<user>/.cache/disco/host/<run>/sessions/<session>/inputs/x.md`).
 * The reader needs the path inside the run, and a page must not publish the host's: a session or run folder reads as the
 * path under it (`inputs/x.md`, or `./` for the folder itself), any other home folder as `~/`.
 */
const HOST_PATH = /\/(?:home|Users)\/[^/\s"'`]+(?:\/\.cache\/disco\/host\/[^/\s"'`]+(?:\/sessions\/[^/\s"'`]+)?)?(\/?)/g
export function hostless(text: string): string
export function hostless(text: string | undefined): string | undefined
export function hostless(text: string | undefined) {
  if (!text || !(text.includes('/home/') || text.includes('/Users/'))) return text
  return text.replace(HOST_PATH, (match: string, slash: string, at: number, all: string) => {
    if (!match.includes('/.cache/disco/host/')) return slash ? '~/' : '~'
    const next = all[at + match.length]
    return slash && next !== undefined && !/[\s"'`)]/.test(next) ? '' : './'
  })
}
/** An event with every recorded text read through `hostless`; an event without a host path is returned as it is. */
function withoutHostPaths<T extends RecordEvent>(event: T): T {
  const d = event.detail
  const text = hostless(d.publicText), reasoning = hostless(d.reasoning)
  const calls = d.publicToolCalls?.map((call) => (call.input && hostless(call.input) !== call.input ? { ...call, input: hostless(call.input) } : call))
  if (text === d.publicText && reasoning === d.reasoning && calls?.every((call, i) => call === d.publicToolCalls![i]) !== false) return event
  return { ...event, detail: { ...d, ...(text !== undefined ? { publicText: text } : {}), ...(reasoning !== undefined ? { reasoning } : {}), ...(calls ? { publicToolCalls: calls } : {}) } }
}
export const roleOf = (node?: RecordNode) =>
  node?.role ??
  (node?.kind === 'session'
    ? 'Session'
    : node?.kind === 'finding'
      ? 'Finding'
      : 'Agent')
export const textOf = (event: RecordEvent) =>
  event.detail.publicText ?? event.detail.recordedClaim ?? ''
export const toolKey = (node: string, id: string) => JSON.stringify([node, id])

export function callsOf(event: RecordEvent): ToolCall[] {
  const published = event.detail.publicToolCalls ?? []
  const byId = new Map(published.map((call) => [call.id, call]))
  const ids = [
    ...new Set([
      ...(event.detail.toolCallIds ?? []),
      ...published.map((call) => call.id),
    ]),
  ]
  return ids.map(
    (id) =>
      byId.get(id) ?? {
        id,
        name:
          event.detail.toolNames?.length === 1
            ? event.detail.toolNames[0]!
            : 'Tool call',
      },
  )
}

/** A run-scoped id (`<run>:s37`) reads as its own part. */
const local = (value: string) => value.replace(/^[a-z0-9][\w.-]*-\d{8}[a-z]?:/i, '')
/** A tool call's subject: its command, path or question, never its JSON. */
export function preview(call: ToolCall) {
  if (call.input === undefined) return 'args not captured'
  try {
    const value: unknown = JSON.parse(call.input)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const args = value as Record<string, unknown>
      for (const key of ['command', 'cmd', 'filePath', 'file_path', 'path', 'query', 'question', 'pattern', 'url', 'pageId', 'title', 'task', 'prompt', 'message'])
        if (typeof args[key] === 'string' && args[key]) return compact(local(args[key]))
      const words = Object.values(args).filter((item): item is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof item))
      if (words.length) return compact(words.map((item) => local(String(item))).join(' · '))
    }
  } catch {
    /* Tool inputs can be plain text. */
  }
  return compact(call.input)
}

/** Preserve importer identity; retained `down` means stopped, unlike a live Runtime failure. */
export function indexRecord<R extends RunRecord>(record: R) {
  type Event = R['events'][number]
  const inputNodes = (record.nodes as R['nodes'][number][]).map(node => node.status === 'down' ? { ...node, status: 'stopped' } : node)
  const inputEvents = record.events as Event[]
  const nodes = new Map(inputNodes.map((node) => [node.id, node]))
  const canonical = (id: string) => nodes.get(id)?.agentId ?? id
  const actors = inputNodes.filter(
    (node) => node.kind !== 'session' || !node.agentId,
  )
  const events = inputEvents.map(event => withoutHostPaths(event)).sort((a, b) => ms(a.at) - ms(b.at))
  const byEvent = new Map(events.map((event) => [event.id, event]))
  const recordedOrder = new Map(inputEvents.map((event, i) => [event.id, i]))
  const byActor = new Map<string, Event[]>()
  const results = new Map<string, Event[]>()
  const calls = new Map<string, { event: Event; call: ToolCall }[]>()
  for (const event of events) {
    const actor = canonical(event.node)
    const lane = byActor.get(actor) ?? []
    lane.push(event)
    byActor.set(actor, lane)
    for (const call of callsOf(event)) {
      const key = toolKey(event.node, call.id)
      const matching = calls.get(key) ?? []
      matching.push({ event, call })
      calls.set(key, matching)
    }
    if (event.detail.toolCallId !== undefined) {
      const key = toolKey(event.node, event.detail.toolCallId)
      const matching = results.get(key) ?? []
      matching.push(event)
      results.set(key, matching)
    }
  }
  const times = [...events.map(event => ms(event.at)), ...actors.flatMap(node => node.start ? [ms(node.start)] : [])].filter(Number.isFinite)
  const start = times.length ? times.reduce((first, at) => Math.min(first, at)) : 0
  const observedEnd = events.reduce((latest, event) => Math.max(latest, event.end ? ms(event.end) : ms(event.at)), start)
  const end = actors.reduce((latest, node) => typeof node.end === 'string' && Number.isFinite(ms(node.end)) ? Math.max(latest, ms(node.end)) : latest, observedEnd)
  return {
    nodes,
    canonical,
    actors,
    events,
    byEvent,
    recordedOrder,
    byActor,
    calls,
    results,
    start,
    end,
  }
}
export type RecordIndex<R extends RunRecord = RunRecord> = ReturnType<typeof indexRecord<R>>

/** Whether any event of this agent recorded token usage or a list price: a status alone measures nothing. */
export function measuredUsage(index: RecordIndex, id: string) {
  return (index.byActor.get(id) ?? []).some(
    (event) =>
      typeof event.detail.costListUsd === 'number' ||
      Object.values(event.detail.usage ?? {}).some((value) => typeof value === 'number' && value > 0),
  )
}

/** An agent's recorded state, qualified when nothing about it was measured or captured. A live agent has no terminal
 * state yet: `live` is its state while the run runs (Runtime's progress document), and it reads as working. */
export function agentState(node: RecordNode | undefined, measured: boolean, live?: string | null) {
  if (!node?.status && live) return live === 'running' ? 'working' : live.replaceAll('-', ' ')
  const status = node?.status ?? 'no terminal state recorded'
  if (measured) return status
  const capture = (node?.capture as { status?: string } | undefined)?.status
  return `${status} · no usage recorded${capture === 'absent' ? '; capture missing' : capture === 'lossy' ? '; capture partial' : ''}`
}

export function eventMatches(
  event: RecordEvent,
  index: RecordIndex,
  query: string,
  category: string,
) {
  const categoryMatches =
    category === 'all' ||
    (category === 'prompts' && (event.detail.promptKind === 'initial' || event.detail.promptKind === 'steering')) ||
    event.category === category ||
    (category === 'findings' &&
      (event.kind === 'finding-record' ||
        event.detail.recordedClaim !== undefined))
  return (
    categoryMatches &&
    (!query ||
      JSON.stringify({
        label: event.label,
        node: index.nodes.get(index.canonical(event.node)),
        detail: event.detail,
      })
        .toLowerCase()
        .includes(query))
  )
}

export function eventSource(
  event: RecordEvent,
  record: RunRecord,
  index: RecordIndex,
) {
  const node = index.nodes.get(event.node)
  return {
    ...event.source,
    runId: record.runId,
    at: event.at,
    observedNodeId: event.node,
    agentId: node?.kind === 'agent' ? node.id : (node?.agentId ?? null),
    nativeSessionId: node?.nativeSessionId ?? null,
    joinBasis: node?.joinBasis ?? null,
    joinProof: node?.joinProof ?? null,
  }
}

export function hoverLines(
  event: RecordEvent,
  index: RecordIndex,
  cutoff: number,
) {
  const lines = [
    `${index.nodes.get(index.canonical(event.node))?.label ?? event.node} · ${utcTime(event.at)}`,
    `${event.detail.role ?? event.kind}${event.detail.isError ? ' · tool error' : event.detail.responseStatus === 'error' ? ' · request failed' : ''}`,
  ]
  if (ms(event.at) > cutoff)
    return [...lines, 'After the selected time. Select this event to advance.']
  const usage = event.detail.usage
  if (usage)
    lines.push(
      `Input ${usage.input === undefined ? 'unknown' : fmt(usage.input)} · output ${usage.output === undefined ? 'unknown' : fmt(usage.output)} · cache read ${usage.cacheRead === undefined ? 'unknown' : fmt(usage.cacheRead)} · cache write ${usage.cacheWrite === undefined ? 'unknown' : fmt(usage.cacheWrite)}`,
    )
  const text = textOf(event)
  if (text) lines.push(text.slice(0, 220) + (text.length > 220 ? '…' : ''))
  for (const call of callsOf(event).slice(0, 3))
    lines.push(`${call.name}: ${preview(call).slice(0, 220)}`)
  if (!text && !callsOf(event).length && event.detail.role)
    lines.push(
      event.detail.contentOmitted ??
        event.detail.publicationNote ??
        'No text body is present in this record.',
    )
  return lines
}

/** A declared model is configuration; only response metadata shows which model served. */
export function modelIdentity(
  node: RecordNode | undefined,
  record: RunRecord,
) {
  if (!node) return null
  const served = [
    ...new Set(
      record.nodes
        .filter(
          (session) => session.agentId === node.id || session.id === node.id,
        )
        .map((session) => session.servedModel)
        .filter((model): model is string => Boolean(model)),
    ),
  ]
  return served.length
    ? `${served.join(', ')} (served)`
    : node.model
      ? `${node.model} (declared; served model unknown)`
      : null
}

export interface TooltipSection {
  kind: 'header' | 'body' | 'usage' | 'status' | 'note'
  label?: string
  value: string
  tone?: 'default' | 'error' | 'ok' | 'warn' | 'muted' | 'accent'
}

export function tooltipSections(event: RecordEvent, index: RecordIndex, cutoff: number): { title: string; category: string; tone: string; sections: TooltipSection[] } {
  const node = index.nodes.get(index.canonical(event.node))
  const isError = event.detail.isError === true || event.detail.responseStatus === 'error'
  const category = event.detail.role ?? event.kind
  const title = event.label || category
  const sections: TooltipSection[] = [
    { kind: 'header', value: `${node?.label ?? event.node} · ${utcTime(event.at)}`, tone: 'muted' },
  ]
  if (ms(event.at) > cutoff) {
    sections.push({ kind: 'note', value: 'After the selected time. Select this event to advance.' })
    return { title, category, tone: isError ? 'error' : 'default', sections }
  }
  if (event.detail.isError) sections.push({ kind: 'status', value: 'Tool error', tone: 'error' })
  if (event.detail.responseStatus === 'error') sections.push({ kind: 'status', value: 'Request failed', tone: 'error' })
  const text = textOf(event)
  if (text) sections.push({ kind: 'body', value: text.slice(0, 200) + (text.length > 200 ? '…' : '') })
  const calls = callsOf(event)
  for (const call of calls.slice(0, 2)) {
    sections.push({ kind: 'body', label: call.name, value: preview(call).slice(0, 160) })
  }
  const usage = event.detail.usage
  if (usage && !event.detail.usageScope) {
    const parts: string[] = []
    if (usage.input !== undefined) parts.push(`↑ ${fmt(usage.input)}`)
    if (usage.output !== undefined) parts.push(`↓ ${fmt(usage.output)}`)
    if (usage.cacheRead !== undefined) parts.push(`⟳ ${fmt(usage.cacheRead)}`)
    if (usage.cacheWrite !== undefined) parts.push(`→ ${fmt(usage.cacheWrite)}`)
    if (parts.length) sections.push({ kind: 'usage', value: parts.join('  '), tone: 'accent' })
  }
  const duration = event.detail.durationMs
  if (typeof duration === 'number') sections.push({ kind: 'status', value: `⏱ ${interval(duration)}`, tone: 'muted' })
  return { title, category, tone: isError ? 'error' : 'default', sections }
}


const time = (value: unknown) => typeof value === 'string' ? ms(value) : NaN

/** Project retained identities and measured intervals; a message without a duration remains a point. */
export function recordFlowTrace(record: RunRecord, live = false, observedAt = Date.now()): FlowTrace {
  const index = indexRecord(record)
  const first = index.events.length || index.actors.some(node => Number.isFinite(time(node.start))) ? index.start : observedAt
  const last = Math.max(first, index.end, live ? observedAt : first)
  const spans: FlowSpan[] = []
  const actors = new Set(index.actors.map((node) => node.id))
  const runningNodes = new Set(index.actors.filter((node) => live && !node.end && isOpen(node.status ?? 'unknown')).map((node) => node.id))
  const offset = (at: number) => Math.max(0, at - first)
  for (const node of index.actors) {
    if (node.kind === 'finding') continue
    const events = index.byActor.get(node.id) ?? []
    const start = Number.isFinite(time(node.start)) ? time(node.start) : events[0] ? ms(events[0].at) : NaN
    if (!Number.isFinite(start)) continue
    const running = runningNodes.has(node.id)
    const end = running ? last : Number.isFinite(time(node.end)) ? time(node.end) : events.at(-1) ? ms(events.at(-1)!.at) : start
    const parent = node.parent ? index.canonical(node.parent) : undefined
    spans.push({ id: node.id, ...(parent && actors.has(parent) ? { parentId: parent } : {}), kind: 'pipeline', name: node.label, startMs: offset(start), endMs: offset(Math.max(start, end)), status: runStatus(node.status ?? 'unknown'), approx: !node.start || !node.end })
    if (parent && actors.has(parent)) spans.push({ id: `${node.id}:handoff`, parentId: parent, kind: 'handoff', name: `Handoff to ${node.label}`, startMs: offset(start), endMs: offset(start), approx: true, meta: { timing: 'Recorded child start; handoff duration was not measured' } })
  }
  const promptTokens: (number | undefined)[] = []
  const completionTokens: (number | undefined)[] = []
  let cost = 0
  let costKnown = false
  let costMissing = false
  const explicitTools = new Set<string>()
  let toolCalls = 0
  for (const event of index.events) {
    const detail = event.detail
    const response = detail.usageScope === undefined && detail.role === 'assistant'
    const counters = [detail.usage?.input, detail.usage?.cacheRead, detail.usage?.cacheWrite, detail.usage?.output].map(reportedCount)
    const prompt = sumReportedCounts(counters.slice(0, 3)), completion = counters[3]
    const measured = counters.filter((value): value is number => value !== undefined)
    const facts = measured.length && measured.length < counters.length ? [{ label: 'Tokens', value: `≥ ${fmt(measured.reduce((sum, value) => sum + value, 0))} measured; incomplete counters` }] : undefined
    // Scoped lifecycle meters are cumulative observations, not additional model responses.
    if (detail.usageScope === undefined) {
      if (response || detail.usage) { promptTokens.push(prompt); completionTokens.push(completion) }
      if (detail.usdKnown === false) costMissing = true
      else if (typeof detail.costListUsd === 'number') { cost += detail.costListUsd; costKnown = true }
      else if (detail.usage && Object.values(detail.usage).some((value) => typeof value === 'number' && value > 0)) costMissing = true
    }
    const start = ms(event.at)
    const parentId = index.canonical(event.node)
    if (typeof detail.spanId === 'string') {
      const kind = event.kind.replace(/^trace-/, '').toLowerCase()
      const end = time(detail.end)
      const state = runStatus(typeof detail.status === 'string' ? detail.status : 'unknown')
      const running = live && !Number.isFinite(end) && ['running', 'waiting', 'needs-you'].includes(state)
      const spanKind: FlowSpan['kind'] = ['llm', 'model'].includes(kind) ? 'model' : kind === 'tool' ? 'tool' : kind === 'waiting' ? 'waiting' : kind === 'handoff' ? 'handoff' : 'pipeline'
      const traceId = String(detail.traceId ?? event.node)
      spans.push({ id: `${traceId}:${detail.spanId}`, parentId: typeof detail.parentSpanId === 'string' ? `${traceId}:${detail.parentSpanId}` : parentId, kind: spanKind, name: event.label, startMs: offset(start), endMs: offset(Number.isFinite(end) ? Math.max(start, end) : running ? last : start), status: detail.isError ? 'failed' : state, meta: { eventId: event.id } })
      if (spanKind === 'tool') { toolCalls++; if (typeof detail.toolCallId === 'string') explicitTools.add(toolKey(event.node, detail.toolCallId)) }
    } else if (response) {
      spans.push({ id: event.id, parentId, kind: 'model', name: event.label, startMs: offset(start), endMs: offset(start), approx: true, status: runStatus(typeof detail.responseStatus === 'string' ? detail.responseStatus : 'unknown'), promptTokens: prompt, completionTokens: completion, facts, meta: { eventId: event.id, timing: 'Response timestamp; generation duration was not recorded' } })
    }
  }
  for (const key of new Set([...index.calls.keys(), ...index.results.keys()])) {
    if (explicitTools.has(key)) continue
    const calls = index.calls.get(key) ?? [], results = index.results.get(key) ?? []
    const result = calls.length === 1 && results.length === 1 && ms(results[0]!.at) >= ms(calls[0]!.event.at) ? results[0] : undefined
    const ambiguous = calls.length > 1 || results.length > 1
    const timing = ambiguous ? 'Ambiguous retained call/result identity; no duration measured' : calls.length && results.length ? 'Recorded result timestamp precedes call; no interval measured' : 'Unmatched retained call or result; no interval measured'
    for (const { event, call } of calls) {
      toolCalls++
      const start = ms(event.at), parentId = index.canonical(event.node)
      spans.push({ id: `${event.id}:tool:${call.id}`, parentId, kind: 'tool', name: call.name, startMs: offset(start), endMs: offset(result ? ms(result.at) : start), approx: !result || event.detail.atBasis === 'carried' || result.detail.atBasis === 'carried', status: result?.detail.isError ? 'failed' : result ? 'done' : 'unknown', facts: result ? undefined : [{ label: 'Timing', value: timing }], meta: { eventId: event.id, ...(!result ? { timing } : {}) } })
    }
    if (!result) for (const event of results) spans.push({ id: `${event.id}:result`, parentId: index.canonical(event.node), kind: 'tool', name: event.label, startMs: offset(ms(event.at)), endMs: offset(ms(event.at)), approx: true, status: event.detail.isError ? 'failed' : 'unknown', facts: [{ label: 'Timing', value: timing }], meta: { eventId: event.id } })
  }
  return { spans, totalMs: last - first, promptTokens: sumReportedCounts(promptTokens), completionTokens: sumReportedCounts(completionTokens), toolCalls, ...(costKnown && !costMissing ? { costUsd: cost, costBasis: 'list' } : {}) }
}
