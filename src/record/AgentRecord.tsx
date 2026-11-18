import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RecordSelection, RunRecord } from '@drewstone/agent-record/record'
import { recordStory, span, utc, type RecordAgent, type RecordStory, type RecordSummary, type RecordTurningPoint } from '@drewstone/agent-record/story'
import { PointNumber, RecordSpine, SEP, type TimeWindow } from './RecordSpine.js'
import { EpisodeList, Inline, readable, type Opened } from './RecordEpisodes.js'
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
 * A retained record read as a story: what was asked and what came of it, who did what, one slim time spine, the turning
 * points, then the work in episodes. Every value comes from `@drewstone/agent-record/story`; the view computes none.
 */
export function AgentRecord({ records, selection, defaultSelection, onSelectionChange, theme = 'auto', className = '' }: AgentRecordProps) {
  const [own, setOwn] = useState(defaultSelection)
  const chosen = selection ?? own
  const record = records.find((item) => item.runId === chosen?.runId) ?? records[0]
  const change = useCallback((next: RecordSelection) => {
    if (selection === undefined) setOwn(next)
    onSelectionChange?.(next)
  }, [selection, onSelectionChange])
  return <div className={`agent-record rv ${className}`} data-theme={theme === 'auto' ? undefined : theme}>
    {records.length > 1 && <div className="rv-switch" role="group" aria-label="Records">
      {records.map((item) => <button key={item.runId} type="button" aria-pressed={item.runId === record?.runId} onClick={() => change({ runId: item.runId })}>{item.title}</button>)}
    </div>}
    {record ? <RecordView key={record.runId} record={record} eventId={chosen?.runId === record.runId ? chosen.eventId : undefined} onChange={change} />
      : <p className="rv-line">No records supplied.</p>}
  </div>
}

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const DATE: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }
const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', DATE)
/** "JSON, 592 KB" */
const size = (bytes: number) => bytes >= 1_048_576 ? `JSON, ${(bytes / 1_048_576).toFixed(1)} MB` : `JSON, ${Math.max(1, Math.round(bytes / 1024))} KB`

function RecordView({ record, eventId, onChange }: { record: RunRecord; eventId?: string; onChange: (selection: RecordSelection) => void }) {
  const story = useMemo(() => recordStory(record), [record])
  const { summary } = story
  const [agent, setAgent] = useState<string>()
  const [range, setRange] = useState<TimeWindow>()
  const [opened, setOpened] = useState<Opened>({ episodes: new Set(), steps: new Set(), folds: new Set() })
  const [focus, setFocus] = useState<{ episode: string; target?: string; at: number }>()
  const emitted = useRef<string | undefined>(undefined)
  const root = useRef<HTMLDivElement>(null)
  const colors = useMemo(() => new Map(summary.agents.map((item, i) => [item.id, `var(--rv-a${i % 6})`])), [summary])
  const colorOf = useCallback((id: string) => colors.get(id) ?? 'var(--rv-a0)', [colors])

  const select = useCallback((stepId: string) => {
    const step = story.steps.find((item) => item.id === stepId)
    if (!step) return
    emitted.current = step.callEventId
    onChange({ runId: record.runId, eventId: step.callEventId, at: new Date(step.at).toISOString() })
  }, [story, record.runId, onChange])
  // Opening a step from the result, a marker or a turning point selects it too, so the host's link names it.
  const reveal = useCallback((episode: string | undefined, target?: { step?: string; item?: string }, emit = true) => {
    if (!episode) return
    setAgent(undefined); setRange(undefined)
    setOpened((prev) => ({ ...prev, episodes: new Set(prev.episodes).add(episode), steps: target?.step ? new Set(prev.steps).add(target.step) : prev.steps }))
    setFocus({ episode, ...(target?.step ? { target: `[data-step="${CSS.escape(target.step)}"]` } : target?.item ? { target: `[data-item="${CSS.escape(target.item)}"]` } : {}), at: Date.now() })
    if (target?.step && emit) select(target.step)
  }, [select])
  // Scroll only after the opened episode has rendered.
  useEffect(() => {
    if (!focus) return
    const element = (focus.target && root.current?.querySelector(focus.target)) || root.current?.querySelector(`[data-episode="${CSS.escape(focus.episode)}"]`)
    element?.scrollIntoView({ block: focus.target ? 'center' : 'start', behavior: 'smooth' })
  }, [focus])

  // A link to an event (?event=) opens its episode and step once; the view's own selections do not scroll again.
  useEffect(() => {
    if (!eventId || eventId === emitted.current) return
    emitted.current = eventId
    const step = story.steps.find((item) => item.callEventId === eventId || item.resultEventId === eventId)
    const episode = story.episodes.find((item) => step ? item.steps.includes(step) : item.items.some((entry) => 'id' in entry && entry.id === eventId))
    if (episode) reveal(episode.id, step?.published ? { step: step.id } : { item: eventId }, false)
  }, [eventId, story, reveal])

  const inWindow = (start: number, end = start) => !range || (end >= range[0] && start <= range[1])
  const points = story.turningPoints.filter((point) => (!agent || point.node === agent) && inWindow(point.at, point.end))
  const episodes = story.episodes.filter((episode) => (!agent || episode.node === agent) && inWindow(episode.start, episode.end))
  const chosen = agent ? summary.agents.find((item) => item.id === agent) : undefined
  const openPoint = (point: RecordTurningPoint) => reveal(point.episode, point.stepId ? { step: point.stepId } : undefined)
  const allOpen = episodes.length > 0 && episodes.every((item) => opened.episodes.has(item.id))
  const toggleAll = () => setOpened((prev) => allOpen ? { ...prev, episodes: new Set(), folds: new Set() }
    : { ...prev, episodes: new Set(episodes.map((item) => item.id)), folds: new Set(episodes.map((item) => `fold-${item.id}`)) })
  const claim = summary.claim

  return <div className="rv-view" ref={root}>
    <Header summary={summary} openClaim={claim?.episode ? () => reveal(claim.episode, claim.eventId ? { item: claim.eventId } : undefined) : undefined} />
    {summary.agents.length > 1 && <Cast summary={summary} colorOf={colorOf} agent={agent} onAgent={setAgent} />}
    <RecordSpine story={story} points={points} colorOf={colorOf} agent={agent} onAgent={setAgent} window={range} onWindow={setRange}
      openEpisode={(id) => reveal(id)} openPoint={openPoint} />
    {(chosen || range) && <p className="rv-filter">
      {chosen ? <>Showing only {chosen.label}{range ? `, ${utc(range[0], 'minute')}–${utc(range[1], 'minute')} UTC` : ''}</> : <>Showing {utc(range![0], 'minute')}–{utc(range![1], 'minute')} UTC</>}
      <button type="button" className="rv-text-button" onClick={() => { setAgent(undefined); setRange(undefined) }}>Show the whole run</button></p>}
    {points.length > 0 && <section className="rv-section" aria-labelledby="rv-points">
      <div className="rv-section-head"><h4 id="rv-points">Turning points</h4></div>
      <ol className="rv-moments">{points.map((point) => <li key={point.n}>
        <button type="button" className="rv-moment" onClick={() => openPoint(point)} disabled={!point.episode}>
          <time>{utc(point.at, 'minute')}</time><PointNumber point={point} />
          <span><Inline text={point.title} />{point.excerpt && <small>{SEP}<Inline text={point.excerpt} /></small>}</span>
        </button>
      </li>)}</ol>
    </section>}
    <section className="rv-section" aria-labelledby="rv-episodes">
      <div className="rv-section-head"><h4 id="rv-episodes">Episodes</h4>
        {episodes.length > 1 && <button type="button" className="rv-text-button" onClick={toggleAll}>{allOpen ? 'Close every episode' : 'Open every episode'}</button>}
      </div>
      <EpisodeList story={story} episodes={episodes} colorOf={colorOf} opened={opened} setOpened={setOpened} onStep={select} />
      {!episodes.length && <p className="rv-line">{story.episodes.length ? 'No episode falls in this stretch.' : 'This record keeps no steps.'}</p>}
    </section>
    <Footer record={record} story={story} />
  </div>
}

/** One line of facts, each from the summary: when, how long, who, how much work, what it cost. */
function facts(summary: RecordSummary): Array<[string, ReactNode]> {
  const out: Array<[string, ReactNode]> = []
  const push = (key: string, node: ReactNode) => out.push([key, node])
  const { start, end } = summary
  if (start !== undefined && end !== undefined) push('when', day(start) === day(end) ? `${day(start)}, ${utc(start, 'minute')}–${utc(end, 'minute')} UTC` : `${day(start)} ${utc(start, 'minute')} UTC to ${day(end)} ${utc(end, 'minute')} UTC`)
  if (summary.durationMs) push('span', span(summary.durationMs))
  if (summary.agents.length > 1) push('agents', `${count(summary.agents.length, 'agent')}${summary.uncaptured ? `, ${summary.uncaptured} not captured` : ''}`)
  else if (summary.models.length) push('model', summary.models.join(', '))
  if (summary.steps) push('steps', <>{count(summary.steps, 'step')}, {summary.errors ? <span className="rv-bad">{summary.errors.toLocaleString('en-US')} failed</span> : 'none failed'}</>)
  if (summary.outputTokens !== undefined) push('tokens', `${summary.outputTokens.toLocaleString('en-US')} output tokens`)
  const cost = summary.cost
  push('cost', cost ? `$${cost.usd.toFixed(2)} ${cost.billed ? 'billed' : 'at list price, not confirmed by a bill'}${cost.of < cost.agents ? ` for ${cost.of} of ${count(cost.agents, 'agent')}` : ''}` : 'No cost recorded')
  return out
}

function Header({ summary, openClaim }: { summary: RecordSummary; openClaim?: () => void }) {
  const claim = summary.claim
  return <header className="rv-head">
    <h3 className="rv-title">{summary.title}</h3>
    <dl className="rv-qa">
      {summary.asked && <><dt>Asked</dt><dd>{readable(summary.asked)}
        {summary.brief.length > 0 && <details className="rv-brief"><summary>Full brief</summary>
          <dl>{summary.brief.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{readable(item.text)}</dd></div>)}</dl></details>}</dd></>}
      <dt>Result</dt>
      <dd className="rv-result">{claim ? <>
        <q><Inline text={claim.text} /></q>
        <span className="rv-cite">{claim.by}{openClaim && <>{SEP}<button type="button" className="rv-text-button" onClick={openClaim}>See where it landed</button></>}</span>
        {summary.result.map((line) => <span key={line} className="rv-then">{line}</span>)}
      </> : summary.result.join(' ')}</dd>
    </dl>
    <ul className="rv-facts">{facts(summary).map(([key, node]) => <li key={key}>{node}</li>)}</ul>
  </header>
}

function Cast({ summary, colorOf, agent, onAgent }: { summary: RecordSummary; colorOf: (id: string) => string; agent?: string; onAgent: (id: string | undefined) => void }) {
  const when = (item: RecordAgent) => {
    const a = utc(item.start, 'minute'), b = utc(item.end, 'minute')
    return a && b && a !== b ? `${a}–${b}` : a ?? b ?? ''
  }
  return <>
    <ul className="rv-cast" aria-label="Agents">{summary.agents.map((item) => {
      // The root's outcome is the run's, which the result above states.
      const status = item.depth === 0 || item.status === 'ended' ? '' : item.status
      return <li key={item.id} style={{ ['--rv-agent' as string]: colorOf(item.id) }}>
        <button type="button" className={`rv-who d${Math.min(item.depth, 3)}`} aria-pressed={agent === item.id} onClick={() => onAgent(agent === item.id ? undefined : item.id)}><i />{item.label}</button>
        <span className="rv-did">{item.did ? readable(item.did) : ''}</span>
        <span className="rv-when">{when(item)}{status && <>{when(item) ? SEP : ''}<span className={item.tone === 'error' ? 'rv-bad' : undefined}>{status}</span></>}</span>
      </li>
    })}</ul>
    <p className="rv-cast-note">{summary.models.length === 1 ? `Every agent ran ${summary.models[0]}. ` : summary.models.length ? `Models: ${summary.models.join('; ')}. ` : ''}Choose an agent to read only its episodes.</p>
  </>
}

function Footer({ record, story }: { record: RunRecord; story: RecordStory }) {
  const download = useDownload()
  const json = useMemo(() => JSON.stringify(record, null, 2), [record])
  const bytes = useMemo(() => new TextEncoder().encode(json).length, [json])
  const { leavesOut } = story.summary
  return <footer className="rv-foot">
    {leavesOut.length > 0 && <details className="rv-leaves"><summary><b>What the record leaves out</b><span>{leavesOut[0]}</span></summary>
      <ul>{leavesOut.map((line) => <li key={line}>{line}</li>)}</ul></details>}
    <button type="button" className="rv-download" onClick={() => download(json, `${record.runId}.json`, 'application/json')}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" /></svg>Download the record <small>{size(bytes)}</small></button>
  </footer>
}
