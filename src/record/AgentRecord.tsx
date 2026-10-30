import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { RecordEvent, RecordSelection, RunRecord } from '@drewstone/agent-record/record'
import { FlowWaterfall } from '@tangle-network/charts/react'
import type { FlowSpan } from '@tangle-network/charts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tangle-network/ui/primitives'
import { AgentTree } from '../run/record/AgentTree.js'
import { Conversation } from '../run/record/Conversation.js'
import { eventMatches, eventSource, indexRecord, modelIdentity, ms, recordFlowTrace, roleOf, textOf, utcTime, type RecordIndex } from '../run/record/model.js'
import { StructuredContent } from './StructuredContent.js'
import { categories, RecordUsage, type Axis, type Metric } from './RecordUsage.js'
import { useDownload } from './useDownload.js'

export interface BehaviorVerdict {
  behavior: string
  verdict: 'yes' | 'no' | 'unclear'
  confidence: number
  evidence?: Array<{ eventId: string; quote?: string }>
  note?: string
}
export interface BehaviorReport { runId: string; verdicts: readonly BehaviorVerdict[]; summary?: string }
export interface AgentRecordProps {
  records: readonly RunRecord[]
  selection?: RecordSelection
  defaultSelection?: RecordSelection
  onSelectionChange?: (selection: RecordSelection) => void
  theme?: 'light' | 'dark' | 'auto'
  className?: string
  behaviors?: readonly BehaviorReport[]
}
function Select({ label, value, onChange, children, field }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; field: string }) {
  return <label className="ui-field ar-select"><span className="ui-label">{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} {...{ [`data-${field}`]: '' }}>{children}</select></label>
}
/** Normalized retained data only. Producers retain parsing and publication authority. */
export function AgentRecord({ records, selection, defaultSelection, onSelectionChange, theme = 'auto', className = '', behaviors }: AgentRecordProps) {
  const [own, setOwn] = useState(defaultSelection)
  const chosen = selection ?? own
  const record = records.find(item => item.runId === chosen?.runId) ?? records[0]
  const change = useCallback((next: RecordSelection) => {
    if (selection === undefined) setOwn(next)
    onSelectionChange?.(next)
  }, [selection, onSelectionChange])
  return <div className={`agent-record ${className}`} data-theme={theme === 'auto' ? undefined : theme}>
    {record ? <RecordView key={record.runId} records={records} record={record} selection={chosen?.runId === record.runId ? chosen : { runId: record.runId }} onChange={change} behaviors={behaviors} />
      : <p className="chat-empty">No records supplied.</p>}
  </div>
}
/** One retained record keeps its selection across timeline, transcript, source and measured usage. */
function RecordView({ records, record, selection, onChange, behaviors }: { records: readonly RunRecord[]; record: RunRecord; selection: RecordSelection; onChange: (selection: RecordSelection) => void; behaviors?: readonly BehaviorReport[] }) {
  const index = useMemo(() => indexRecord(record), [record])
  const trace = useMemo(() => recordFlowTrace(record), [record])
  const [category, setCategory] = useState('all'), [search, setSearch] = useState('')
  const [metric, setMetric] = useState<Metric>('cumulative'), [axis, setAxis] = useState<Axis>('time')
  const download = useDownload()
  const explicit = selection.eventId ? index.byEvent.get(selection.eventId) : undefined
  const requested = selection.nodeId ? index.canonical(selection.nodeId) : undefined
  const actor = explicit ? index.canonical(explicit.node) : requested && index.nodes.has(requested) ? requested : index.actors[0]?.id ?? ''
  const event = explicit ?? index.byActor.get(actor)?.[0], node = index.nodes.get(actor)
  const selectedAt = selection.at ? ms(selection.at) : index.end
  const cutoff = Number.isFinite(selectedAt) ? Math.max(index.start, Math.min(index.end, selectedAt)) : index.end
  const query = search.trim().toLowerCase(), view = selection.view ?? 'chat'
  const visible = useMemo(() => index.events.filter(item => eventMatches(item, index, query, category)), [index, query, category])
  const options = [...new Set([...categories, ...record.events.map(item => item.category)])].filter(item => item !== 'all' && item !== 'findings')
  const marks = (behaviors?.find(item => item.runId === record.runId)?.verdicts ?? []).filter(item => item.verdict === 'yes').flatMap(item =>
    (item.evidence ?? []).flatMap(evidence => { const event = index.byEvent.get(evidence.eventId); return event ? [{ ...item, event, quote: evidence.quote }] : [] }))
  const update = useCallback((patch: Partial<RecordSelection>) => onChange({ ...selection, runId: record.runId, nodeId: actor, eventId: event?.id, ...patch }), [selection, record.runId, actor, event?.id, onChange])
  const inspect = (item: RecordEvent, source = false) => onChange({ runId: record.runId, nodeId: index.canonical(item.node), eventId: item.id, at: item.at, view: source ? 'source' : 'chat' })
  const selectActor = (id: string) => {
    const first = index.byActor.get(id)?.find(item => item.detail.role || item.detail.publicText || item.detail.publicToolCalls?.length) ?? index.byActor.get(id)?.[0]
    onChange({ runId: record.runId, nodeId: id, eventId: first?.id, view: 'chat', at: first && ms(first.at) > cutoff ? first.at : selection.at })
  }
  const selectSpan = (span: FlowSpan) => {
    const item = index.byEvent.get(typeof span.meta?.eventId === 'string' ? span.meta.eventId : span.id ?? '')
    if (item) inspect(item)
    else if (span.id !== undefined && index.nodes.has(span.id)) selectActor(span.id)
  }
  const navigate = (direction: number) => {
    if (!visible.length) return
    const at = visible.findIndex(item => item.id === event?.id)
    inspect(visible[at < 0 ? direction > 0 ? 0 : visible.length - 1 : (at + direction + visible.length) % visible.length]!)
  }
  const position = visible.findIndex(item => item.id === event?.id)
  return <div className="ar-view">
    <div className="controls">
      {records.length > 1 && <Select label="Run" field="run" value={record.runId} onChange={runId => onChange({ runId })}>{records.map(item => <option key={item.runId} value={item.runId}>{item.title}</option>)}</Select>}
      <Select label="Activity type" field="category" value={category} onChange={setCategory}><option value="all">All activity</option><option value="findings">Recorded findings</option>{options.map(item => <option key={item} value={item}>{item}</option>)}</Select>
      <label className="ui-field"><span className="ui-label">Search all agents</span><input data-search type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Message, tool, agent…" /></label>
    </div>
    <details className="activity-replay" open><summary>Timeline and replay</summary>
      <FlowWaterfall trace={trace} live={false} label="Recorded activity" defaultView="agents" selectedId={actor}
        position={selection.at ? cutoff - index.start : null} onTimeChange={time => {
          const at = time === null ? undefined : new Date(index.start + time).toISOString()
          if (at !== selection.at) update({ at })
        }} onSelect={selectSpan} query={search} onQueryChange={setSearch}
        matchSpan={span => { const item = index.byEvent.get(typeof span.meta?.eventId === 'string' ? span.meta.eventId : span.id ?? ''); return item ? eventMatches(item, index, query, category) : !query && category === 'all' }}
        markers={marks.map(mark => ({ at: ms(mark.event.at) - index.start, label: `${mark.behavior} · ${Math.round(mark.confidence * 100)}%` }))} />
      {marks.length > 0 && <ul aria-label="Recorded behavior verdicts">{marks.map((mark, i) => <li key={i}><button type="button" onClick={() => inspect(mark.event, true)}>{mark.behavior} · {Math.round(mark.confidence * 100)}%{mark.quote ? ` · ${mark.quote}` : ''}</button></li>)}</ul>}
    </details>
    {query && <section className="activity-search-results" aria-label="Matching activity"><p role="status">{visible.length} matching events</p>
      {visible.slice(0, 100).map(item => <button key={item.id} onClick={() => { setSearch(''); inspect(item) }}><span>{index.nodes.get(index.canonical(item.node))?.label ?? item.node}</span><time>{utcTime(item.at)}</time><strong>{item.label}</strong><small>{(textOf(item) || item.detail.publicToolCalls?.map(call => `${call.name} ${call.input}`).join(' ') || 'Recorded event').replace(/\s+/g, ' ').slice(0, 240)}</small></button>)}
      {visible.length > 100 && <p className="small">Showing the first 100 matches. Narrow the search to find a particular event.</p>}
      {!visible.length && <p className="chat-empty">No retained activity matches. Missing captures are not searched.</p>}
    </section>}
    <div className="workspace flat-activity" hidden={!!query}>
      <details className="topology"><summary>Agents <span data-agent-count>{index.actors.filter(item => item.kind !== 'finding').length}</span></summary>
        {record.nodes.some(item => item.kind === 'session' && !item.agentId) && <p className="small" data-graph-caption>Not linked to an agent: {record.nodes.filter(item => item.kind === 'session' && !item.agentId).map(item => item.label).join(', ')}</p>}
        <AgentTree index={index} actor={actor} cutoff={cutoff} select={selectActor} />
      </details>
      <section className="conversation-panel" aria-label="Agent record details">
        <div className="conversation-head"><div className="agent-identity"><span className="agent-avatar" data-agent-avatar aria-hidden>{roleOf(node).slice(0, 1).toUpperCase()}</span><div><h3 data-agent-title>{node?.label ?? 'Messages'}</h3><p data-agent-role>{[roleOf(node), modelIdentity(node, record), node?.status ?? 'State unknown'].filter(Boolean).join(' · ')}</p></div></div>
          <Select label="Agent" field="agent" value={actor} onChange={selectActor}>{index.actors.map(item => <option key={item.id} value={item.id}>{item.label} · {roleOf(item)}</option>)}</Select>
        </div>
        <Capture record={record} index={index} actor={actor} />
        <Tabs value={view} onValueChange={view => update({ view: view as RecordSelection['view'] })}>
          <TabsList aria-label="Agent evidence">{(['chat', 'source', 'usage'] as const).map(tab => <TabsTrigger key={tab} value={tab} data-view={tab}>{tab === 'chat' ? 'Messages' : tab === 'source' ? 'Event details' : 'Usage'}</TabsTrigger>)}</TabsList>
          <TabsContent value="chat" forceMount hidden={view !== 'chat'} data-panel="chat"><Conversation index={index} actor={actor} cutoff={cutoff} query={query} category={category} selected={event?.id} /></TabsContent>
          <TabsContent value="source" forceMount hidden={view !== 'source'} data-panel="source"><EventDetails event={event} record={record} index={index} cutoff={cutoff} /></TabsContent>
          <TabsContent value="usage" forceMount hidden={view !== 'usage'} data-panel="usage">
            <div className="metric-controls"><Select label="Measure" field="metric" value={metric} onChange={value => setMetric(value as Metric)}><option value="cumulative">Cumulative tokens</option><option value="response">Tokens per response</option><option value="tool-time">Tool return time</option></Select>
              <Select label="Horizontal axis" field="axis" value={axis} onChange={value => setAxis(value as Axis)}><option value="time">Elapsed time</option><option value="order">Recorded order</option></Select></div>
            <RecordUsage index={index} cutoff={cutoff} actor={actor} metric={metric} axis={axis} inspect={inspect} navigate={navigate} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
    <div className="navigation"><Select label="Jump to a moment" field="moment" value={event?.id ?? ''} onChange={id => { const item = index.byEvent.get(id); if (item) inspect(item) }}>
      {!visible.some(item => item.id === event?.id) && <option value={event?.id ?? ''}>{event ? 'Selected event is outside this filter' : 'Select an event'}</option>}
      {visible.map(item => <option key={item.id} value={item.id}>{utcTime(item.at)} · {item.label}</option>)}
    </Select><button className="ui-button" data-prev disabled={!visible.length} onClick={() => navigate(-1)}>Previous</button><button className="ui-button" data-next disabled={!visible.length} onClick={() => navigate(1)}>Next</button><span data-position>{position >= 0 ? position + 1 : '—'} / {visible.length}</span>
      <button className="download-record" data-download onClick={() => download(JSON.stringify(record, null, 2), record.runId + '.json', 'application/json')}>Download record</button>
    </div>
    <details className="assignment"><summary>Original assignment</summary><dl data-assignment>{Object.entries(record.assignment).filter(([key]) => key !== 'source').map(([key, value]) => <div key={key}><dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</dd></div>)}</dl>
      {record.assignment.source && <details className="assignment-source"><summary>Provenance</summary><pre>{JSON.stringify(record.assignment.source, null, 2)}</pre></details>}
    </details>
    <details className="coverage"><summary>Sources, redactions &amp; capture gaps</summary><div data-coverage>
      {record.coverage.publicContent && <p>{record.coverage.publicContent}</p>}{record.coverage.categoryMethod && <p>{record.coverage.categoryMethod}</p>}{record.coverage.cost && record.coverage.cost !== 'Not recorded' && <p>Cost: {record.coverage.cost}</p>}
      {record.terminal && <p>Recorded terminal: {record.terminal.kind ?? 'unknown'}{record.terminal.reason ? ` · ${record.terminal.reason}` : ''}</p>}
      <pre>{JSON.stringify({ coverage: record.coverage, sources: record.sources }, null, 2)}</pre>
    </div></details>
  </div>
}
function Capture({ record, index, actor }: { record: RunRecord; index: RecordIndex<RunRecord>; actor: string }) {
  const node = index.nodes.get(actor), capture = node?.metadata && typeof node.metadata === 'object' ? node.metadata as Record<string, unknown> : undefined
  const retained = index.byActor.get(actor)?.length ?? 0
  const note = typeof node?.captureNote === 'string' ? node.captureNote : typeof capture?.captureReason === 'string' ? capture.captureReason : node?.capture && node.capture.status !== 'complete' ? (record.coverage?.gaps ?? []).filter(gap => gap.nodeId === actor).map(gap => gap.detail).join(' ') : null
  const label = capture?.captureStatus === 'retained-partial' || node?.capture?.status === 'lossy' ? 'Partial capture' : capture?.captureStatus === 'missing-source' || node?.capture?.status === 'absent' || !retained ? 'Conversation unavailable' : capture?.captureStatus === 'retained' ? 'Retained capture' : null
  return (label || note || node?.assignment) ? <div className="agent-capture-summary" role="status">{label}{note && <details><summary>Capture details</summary><p>{note}</p></details>}{node?.assignment && <details><summary>What this agent did</summary><p>{node.assignment}</p></details>}</div> : null
}
function EventDetails({ event, record, index, cutoff }: { event?: RecordEvent; record: RunRecord; index: RecordIndex<RunRecord>; cutoff: number }) {
  if (!event) return <p className="chat-empty">No source event selected.</p>
  return <><h4 data-event-title>{event.label}</h4><p className="small" data-event-meta>{utcTime(event.at, true)} · {index.nodes.get(index.canonical(event.node))?.label ?? event.node}</p>
    {ms(event.at) > cutoff ? <p>This event occurs after the selected time. Advance the timeline to read it.</p> : <>
      {textOf(event) && <StructuredContent text={textOf(event)} />}{event.detail.publicToolCalls?.map(call => <section className="event-tool" key={call.id}><h4>{call.name}</h4>{call.input === undefined ? <p className="publication-note">Args not captured.</p> : <StructuredContent text={call.input} rawLabel="Raw input" />}</section>)}
      {!textOf(event) && !event.detail.publicToolCalls?.length && <p>{event.detail.contentOmitted ?? event.detail.publicationNote ?? 'No visible message or tool payload was retained for this event.'}</p>}
      <details className="raw-data"><summary>Raw event and source</summary><pre data-event-detail>{JSON.stringify(event.detail, null, 2)}</pre><pre data-event-source>{JSON.stringify(eventSource(event, record, index), null, 2)}</pre></details>
    </>}
  </>
}
