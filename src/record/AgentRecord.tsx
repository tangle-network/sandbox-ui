import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RecordSelection, RunRecord } from '@drewstone/agent-record/record'
import { clockUtc, firstSentence, formatSpan, recordStory, type RecordStory, type RecordSummary, type RecordTurningPoint } from '@drewstone/agent-record/story'
import { RecordSpine, PointGlyph, type TimeWindow } from './RecordSpine.js'
import { EpisodeList, type Opened } from './RecordEpisodes.js'
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
  /** Accepted for hosts that pass behavior reports; the record view does not draw them. */
  behaviors?: readonly BehaviorReport[]
}

/**
 * A retained record read as a story: what was asked and what happened, one time spine of every agent, the turning
 * points, then the work in episodes. Every value comes from `@drewstone/agent-record/story`; the view computes none.
 */
export function AgentRecord({ records, selection, defaultSelection, onSelectionChange, theme = 'auto', className = '' }: AgentRecordProps) {
  const [own, setOwn] = useState(defaultSelection)
  const chosen = selection ?? own
  const record = records.find(item => item.runId === chosen?.runId) ?? records[0]
  const change = useCallback((next: RecordSelection) => {
    if (selection === undefined) setOwn(next)
    onSelectionChange?.(next)
  }, [selection, onSelectionChange])
  return <div className={`agent-record rv ${className}`} data-theme={theme === 'auto' ? undefined : theme}>
    {records.length > 1 && <div className="rv-switch" role="group" aria-label="Record">
      {records.map(item => <button key={item.runId} type="button" aria-pressed={item.runId === record?.runId} onClick={() => change({ runId: item.runId })}>{item.title}</button>)}
    </div>}
    {record ? <RecordView key={record.runId} record={record} eventId={chosen?.runId === record.runId ? chosen.eventId : undefined} onChange={change} />
      : <p className="rv-empty">No records supplied.</p>}
  </div>
}

const DATE: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }
const day = (ms: number, year = true) => new Date(ms).toLocaleDateString('en-US', year ? DATE : { ...DATE, year: undefined })
const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
/** "JSON, 592 KB" */
const size = (bytes: number) => bytes >= 1_048_576 ? `JSON, ${(bytes / 1_048_576).toFixed(1)} MB` : `JSON, ${Math.max(1, Math.round(bytes / 1024))} KB`

function RecordView({ record, eventId, onChange }: { record: RunRecord; eventId?: string; onChange: (selection: RecordSelection) => void }) {
  const story = useMemo(() => recordStory(record), [record])
  const { summary } = story
  const multi = summary.agents.length > 1
  const [agent, setAgent] = useState<string>()
  const [range, setRange] = useState<TimeWindow>()
  const [opened, setOpened] = useState<Opened>({ episodes: new Set(), steps: new Set() })
  const [focus, setFocus] = useState<{ id: string; step?: string; at: number }>()
  const emitted = useRef<string | undefined>(undefined)
  const root = useRef<HTMLDivElement>(null)

  const select = useCallback((stepId: string) => {
    const step = story.steps.find(item => item.id === stepId)
    if (!step) return
    emitted.current = step.callEventId
    onChange({ runId: record.runId, eventId: step.callEventId, at: new Date(step.at).toISOString() })
  }, [story, record.runId, onChange])
  // Opening a step from the claim, a pin or a turning point selects it too, so the host's link names it.
  const reveal = useCallback((episodeId: string | undefined, stepId?: string, emit = true) => {
    if (!episodeId) return
    setOpened(prev => ({ episodes: new Set(prev.episodes).add(episodeId), steps: stepId ? new Set(prev.steps).add(stepId) : prev.steps }))
    setFocus({ id: episodeId, ...(stepId ? { step: stepId } : {}), at: Date.now() })
    if (stepId && emit) select(stepId)
  }, [select])
  // Scroll only after the opened episode has rendered.
  useEffect(() => {
    if (!focus) return
    const target = root.current?.querySelector(focus.step ? `[data-step="${CSS.escape(focus.step)}"]` : `[data-episode="${CSS.escape(focus.id)}"]`)
    target?.scrollIntoView({ block: focus.step ? 'center' : 'start', behavior: 'smooth' })
  }, [focus])

  // A link to an event (?event=) opens its episode and step once; the view's own selections do not scroll again.
  useEffect(() => {
    if (!eventId || eventId === emitted.current) return
    emitted.current = eventId
    const step = story.steps.find(item => item.callEventId === eventId || item.resultEventId === eventId)
    const episode = story.episodes.find(item => step ? item.steps.includes(step) : item.items.some(entry => 'id' in entry && entry.id === eventId))
    if (episode) { setAgent(undefined); setRange(undefined); reveal(episode.id, step?.published ? step.id : undefined, false) }
  }, [eventId, story, reveal])

  const inWindow = (start: number, end = start) => !range || (end >= range[0] && start <= range[1])
  const points = story.turningPoints.filter(point => (!agent || point.node === agent) && inWindow(point.at, point.end))
  const episodes = story.episodes.filter(episode => (!agent || episode.node === agent) && inWindow(episode.start, episode.end))
  const chosen = agent ? summary.agents.find(item => item.id === agent) : undefined
  const openPoint = (point: RecordTurningPoint) => reveal(point.episode, point.stepId)

  return <div className="rv-view" ref={root}>
    <Header summary={summary} multi={multi} openClaim={() => summary.claim && reveal(summary.claim.episode, summary.claim.stepId)} />
    <RecordSpine story={story} agent={agent} onAgent={setAgent} window={range} onWindow={setRange}
      openEpisode={id => reveal(id)} openStep={(episode, step) => reveal(episode, step)} openPoint={openPoint} />
    {points.length > 0 && <section className="rv-section" aria-labelledby="rv-points">
      <h3 id="rv-points">Turning points</h3>
      <ol className="rv-points">{points.map(point => <li key={point.n}>
        <button type="button" onClick={() => openPoint(point)}>
          <PointGlyph point={point} />
          <time>{clockUtc(point.at, true)}</time>
          <span><b>{point.title}</b>{multi && !point.title.toLowerCase().includes((summary.agents.find(item => item.id === point.node)?.label ?? '').toLowerCase()) && <span className="rv-quiet"> · {summary.agents.find(item => item.id === point.node)?.label}</span>}
            {point.excerpt && <span className="rv-excerpt">{point.excerpt}</span>}</span>
        </button>
      </li>)}</ol>
    </section>}
    <section className="rv-section" aria-labelledby="rv-episodes">
      <div className="rv-section-head"><h3 id="rv-episodes">Episodes</h3>
        {episodes.length > 1 && <button type="button" className="rv-text-button" onClick={() => setOpened(prev => ({ ...prev, episodes: episodes.every(item => prev.episodes.has(item.id)) ? new Set() : new Set(episodes.map(item => item.id)) }))}>
          {episodes.every(item => opened.episodes.has(item.id)) ? 'Close every episode' : 'Open every episode'}</button>}
      </div>
      {chosen && <p className="rv-filter">{chosen.label}{chosen.assignment || chosen.role ? `: ${firstSentence(chosen.assignment ?? chosen.role ?? '')}` : ''} <button type="button" className="rv-text-button" onClick={() => setAgent(undefined)}>All agents</button></p>}
      <EpisodeList story={story} episodes={episodes} multi={multi} opened={opened} setOpened={setOpened} onStep={select} />
      {!episodes.length && <p className="rv-empty">{story.episodes.length ? 'No episode falls in this stretch.' : 'This record keeps no steps.'}</p>}
    </section>
    <Footer record={record} story={story} />
  </div>
}

function Header({ summary, multi, openClaim }: { summary: RecordSummary; multi: boolean; openClaim: () => void }) {
  const timed = Number.isFinite(summary.start) && Number.isFinite(summary.end)
  const sameDay = timed && day(summary.start) === day(summary.end)
  const facts: Array<{ key: string; node: ReactNode }> = []
  if (timed) facts.push({ key: 'span', node: sameDay ? `${day(summary.start)}, ${clockUtc(summary.start)}–${clockUtc(summary.end)} UTC` : `${day(summary.start, false)} ${clockUtc(summary.start)} UTC to ${day(summary.end)} ${clockUtc(summary.end)} UTC` })
  if (timed && summary.durationMs > 0) facts.push({ key: 'duration', node: formatSpan(summary.durationMs) })
  if (multi) facts.push({ key: 'agents', node: `${count(summary.agents.length, 'agent')}${summary.neverStarted ? `, ${summary.neverStarted} never started` : ''}` })
  if (summary.models.length) facts.push({ key: 'model', node: summary.models.join(', ') })
  if (summary.steps) facts.push({ key: 'steps', node: <>{count(summary.steps, 'step')}, {summary.errors ? <span className="rv-error">{summary.errors.toLocaleString('en-US')} failed</span> : 'no errors'}</> })
  if (summary.outputTokens !== undefined) facts.push({ key: 'tokens', node: `${summary.outputTokens.toLocaleString('en-US')} output tokens` })
  facts.push({ key: 'cost', node: summary.costUsd !== undefined ? `$${summary.costUsd.toFixed(2)} at list price, not billed` : 'cost not recorded' })
  return <header className="rv-head">
    <h3 className="rv-title">{summary.title}</h3>
    {summary.asked && <p className="rv-asked">{summary.asked}</p>}
    {summary.result.length > 0 && <p className="rv-result">{summary.result.join(' ')}</p>}
    {summary.claim && <figure className="rv-claim">
      <blockquote>{summary.claim.text}</blockquote>
      <figcaption>{summary.claim.by}{summary.claim.episode && <> · <button type="button" className="rv-link" onClick={openClaim}>{summary.claim.stepId ? 'Open the page' : 'Open the input'}</button></>}</figcaption>
    </figure>}
    {facts.length > 0 && <ul className="rv-facts">{facts.map(fact => <li key={fact.key}>{fact.node}</li>)}</ul>}
  </header>
}

function Footer({ record, story }: { record: RunRecord; story: RecordStory }) {
  const download = useDownload()
  const json = useMemo(() => JSON.stringify(record, null, 2), [record])
  const bytes = useMemo(() => new TextEncoder().encode(json).length, [json])
  const { summary } = story
  return <footer className="rv-foot">
    {summary.leavesOut.length > 0 && <section aria-labelledby="rv-leaves"><h3 id="rv-leaves">What this record leaves out</h3>
      <p className="rv-leaves">{summary.leavesOut.join(' ')}</p></section>}
    <div className="rv-foot-actions">
      <button type="button" className="rv-button" onClick={() => download(json, `${record.runId}.json`, 'application/json')}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" /></svg>Download the record <span className="rv-quiet">{size(bytes)}</span></button>
    </div>
    {summary.brief.length > 0 && <details className="rv-brief"><summary>Full assignment</summary>
      <dl>{summary.brief.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.text}</dd></div>)}</dl></details>}
  </footer>
}
