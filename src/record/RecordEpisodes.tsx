import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { clockUtc, formatSpan, inputName, type EpisodeItem, type RecordEpisode, type RecordPage, type RecordStep, type RecordStory, type StepKind, type StepOutcome } from '@drewstone/agent-record/story'
import { KINDS } from './RecordSpine.js'

/** Which episodes and steps the reader has opened. */
export interface Opened { episodes: Set<string>; steps: Set<string> }

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const kb = (bytes: number) => bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} bytes`
/** Literal stars and underscores inside $…$ stay text, so a formula never turns into emphasis. */
const keepMath = (text: string) => text.replace(/\$[^$\n]+\$/g, math => math.replace(/([*_])/g, '\\$1'))

/** Agent narration and published pages as Markdown in the body font; tables scroll in their own region. */
export function Prose({ text }: { text: string }) {
  return <div className="rv-prose"><Markdown skipHtml remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => /^https?:\/\//i.test(href ?? '') ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span>,
    img: ({ alt }) => <span>{alt || 'Image not published'}</span>,
    table: ({ children }) => <div className="rv-table-scroll" role="region" aria-label="Table" tabIndex={0}><table>{children}</table></div>,
  }}>{keepMath(text)}</Markdown></div>
}

const ICON: Record<StepKind, ReactNode> = {
  read: <><path d="M3 3.5h4a2 2 0 0 1 2 2V13a1.5 1.5 0 0 0-1.5-1.5H3z" /><path d="M13 3.5H9a2 2 0 0 0-2 2V13a1.5 1.5 0 0 1 1.5-1.5H13z" /></>,
  compute: <><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M5 7l2 1.5L5 10M8.5 10.5H11" /></>,
  check: <><path d="M8 2.2l4.8 1.9v3.7c0 3-2.1 5.1-4.8 6-2.7-.9-4.8-3-4.8-6V4.1z" /><path d="M5.8 8.2l1.6 1.6 2.9-3.1" /></>,
  write: <path d="M10.5 3.2l2.3 2.3L6.3 12H4v-2.3z" />,
  coordinate: <><circle cx="5" cy="6" r="2" /><circle cx="11" cy="6" r="2" /><path d="M2.5 13c.4-1.8 1.4-2.8 2.5-2.8s2.1 1 2.5 2.8M8.5 13c.4-1.8 1.4-2.8 2.5-2.8s2.1 1 2.5 2.8" /></>,
  wait: <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></>,
  other: <circle cx="8" cy="8" r="2" />,
}
const KindIcon = ({ kind }: { kind: StepKind }) => <svg className={`rv-icon k-${kind}`} viewBox="0 0 16 16" aria-hidden="true">{ICON[kind]}</svg>
const MARK_LABEL: Record<StepOutcome, string> = { ok: 'Returned without error', error: 'Failed', none: 'No result recorded' }
function Mark({ outcome }: { outcome: StepOutcome }) {
  return <svg className={`rv-mark ${outcome}`} viewBox="0 0 16 16" role="img" aria-label={MARK_LABEL[outcome]}>
    {outcome === 'ok' ? <path d="M3.5 8.5l3 3 6-7" /> : outcome === 'error' ? <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /> : <circle cx="8" cy="8" r="3.5" />}
  </svg>
}
const Chevron = () => <svg className="rv-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
function Mix({ mix, total }: { mix: RecordEpisode['mix']; total: number }) {
  return <span className="rv-mix" aria-hidden="true">{KINDS.filter(kind => mix[kind]).map(kind => <i key={kind} className={`k-${kind}`} style={{ width: `${(mix[kind]! / total) * 100}%` }} />)}</span>
}

/** Long text shows its first 480 px with a fade and a button for the rest. */
function Clip({ children, limit = 480 }: { children: ReactNode; limit?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(false), [all, setAll] = useState(false)
  useEffect(() => { if (ref.current) setOver(ref.current.scrollHeight > limit + 48) }, [children, limit])
  return <div className={`rv-clip${over && !all ? ' clipped' : ''}`}>
    <div ref={ref} className="rv-clip-body" style={over && !all ? { maxHeight: limit } : undefined}>{children}</div>
    {over && <button type="button" className="rv-text-button" onClick={() => setAll(!all)}>{all ? 'Show less' : 'Show all'}</button>}
  </div>
}

export function EpisodeList({ story, episodes, multi, opened, setOpened, onStep }: {
  story: RecordStory
  episodes: RecordEpisode[]
  multi: boolean
  opened: Opened
  setOpened: Dispatch<SetStateAction<Opened>>
  onStep: (id: string) => void
}) {
  const label = (id: string) => story.summary.agents.find(agent => agent.id === id)?.label
  const toggle = (id: string) => setOpened(prev => { const next = new Set(prev.episodes); if (!next.delete(id)) next.add(id); return { ...prev, episodes: next } })
  const toggleStep = (id: string) => {
    const opening = !opened.steps.has(id)
    setOpened(prev => { const next = new Set(prev.steps); if (opening) next.add(id); else next.delete(id); return { ...prev, steps: next } })
    if (opening) onStep(id)
  }
  return <ol className="rv-episodes">{episodes.map(episode => {
    const open = opened.episodes.has(episode.id)
    return <li key={episode.id} data-episode={episode.id} className={`rv-episode${open ? ' open' : ''}${episode.notCaptured ? ' gap' : ''}`}>
      <button type="button" className="rv-episode-head" aria-expanded={open} onClick={() => toggle(episode.id)}>
        <span className="rv-num">{episode.n}</span>
        <span className="rv-episode-time">{clockUtc(episode.start)}–{clockUtc(episode.end)}</span>
        <span className="rv-episode-title"><b>{episode.title}</b>{multi && <span className="rv-quiet"> · {label(episode.node)}</span>}
          {episode.quote && <q>{episode.quote}</q>}</span>
        <span className="rv-episode-stats">
          {episode.steps.length > 0 && <span>{count(episode.steps.length, 'step')}</span>}
          {episode.end - episode.start >= 1000 && <span>{formatSpan(episode.end - episode.start)}</span>}
          {episode.errors > 0 && <span className="rv-error">{episode.errors} failed</span>}
          {episode.steps.length > 0 && <Mix mix={episode.mix} total={episode.steps.length} />}
        </span>
        <Chevron />
      </button>
      {open && <div className="rv-episode-body">
        {episode.errors > 0 && !episode.errorTextPublished && <p className="rv-note">Error text is not published in this record.</p>}
        <ol className="rv-items">{episode.items.map((item, i) => <li key={itemKey(item, i)}><Item item={item} story={story} multi={multi} opened={opened} toggle={toggleStep} /></li>)}</ol>
      </div>}
    </li>
  })}</ol>
}
const itemKey = (item: EpisodeItem, i: number) => item.type === 'step' ? item.step.id : item.type === 'repeat' ? `repeat-${item.steps[0]!.id}` : `${item.id}-${i}`

function Item({ item, story, multi, opened, toggle }: { item: EpisodeItem; story: RecordStory; multi: boolean; opened: Opened; toggle: (id: string) => void }) {
  const label = (id: string) => story.summary.agents.find(agent => agent.id === id)?.label
  switch (item.type) {
    case 'say': return <div className="rv-say"><time>{clockUtc(item.at, true)}</time><Prose text={item.text} />{item.note && <p className="rv-italic">{item.note}</p>}</div>
    case 'input': return <div className="rv-input"><p><b>{item.check ? `${item.check.outcome === 'passed' ? 'Check passed' : 'Check failed'}${item.check.by ? `, ${item.check.by}` : ''}` : inputName(item.note) ?? 'A new input'}</b> <time>{clockUtc(item.at, true)}</time></p><Prose text={item.text} /></div>
    case 'steer': return <div className="rv-steer"><p><b>{item.toLabel ? `To ${item.toLabel}` : 'A message to its team'}</b> <time>{clockUtc(item.at, true)}</time></p><Prose text={item.text} /></div>
    case 'note': return <p className={`rv-line tone-${item.tone}`}><time>{clockUtc(item.at, true)}</time> {item.text}</p>
    case 'repeat': {
      const first = item.steps[0]!, last = item.steps[item.steps.length - 1]!
      return <div className={`rv-step static${item.outcome === 'error' ? ' error' : ''}`}><div className="rv-step-row"><KindIcon kind={item.kind} />
        <span className="rv-step-main"><span className="rv-step-action">{item.action} ×{item.steps.length}, {clockUtc(first.at, true)}–{clockUtc(last.at, true)}</span></span>
        <span className="rv-step-meta"><span className="rv-tool">{first.tool}{first.server && <span className="rv-server"> · {first.server}</span>}</span><Mark outcome={item.outcome} /></span></div></div>
    }
    case 'step': return <StepRow step={item.step} open={opened.steps.has(item.step.id)} toggle={toggle} agent={multi ? label(item.step.node) : undefined} />
  }
}

/** The first line of a result, shown whole or not at all. */
function excerpt(step: RecordStep): string | undefined {
  const line = step.output?.split('\n').map(text => text.trim()).find(Boolean)
  return line && line.length <= 240 ? line : undefined
}

function Command({ text }: { text: string }) {
  const ref = useRef<HTMLElement>(null)
  const [over, setOver] = useState(false)
  useEffect(() => { const element = ref.current; if (element) setOver(element.scrollHeight > element.clientHeight + 2) }, [text])
  return <span className="rv-command-wrap"><code ref={ref} className="rv-command">{text}</code>{over && <span className="rv-show-all">Show all</span>}</span>
}

function StepRow({ step, open, toggle, agent }: { step: RecordStep; open: boolean; toggle: (id: string) => void; agent?: string }) {
  const out = excerpt(step)
  const body = <>
    <KindIcon kind={step.kind} />
    <span className="rv-step-main">
      <span className="rv-step-action">{step.action}{step.object && !step.command && <> <span className={step.objectMono ? 'rv-mono' : undefined}>{step.object}</span></>}</span>
      {step.command && <Command text={step.command} />}
      {out && <span className="rv-step-out">{out}</span>}
    </span>
    <span className="rv-step-meta">
      <span className="rv-tool">{step.tool}{step.server && <span className="rv-server"> · {step.server}</span>}</span>
      {step.durationMs !== undefined && <span className="rv-duration">{formatSpan(step.durationMs)}</span>}
      <Mark outcome={step.outcome} />
      <time>{clockUtc(step.at, true)}</time>
    </span>
  </>
  return <div className={`rv-step${step.outcome === 'error' ? ' error' : ''}${open ? ' open' : ''}`} data-step={step.id}>
    {step.published ? <button type="button" className="rv-step-row" aria-expanded={open} onClick={() => toggle(step.id)}>{body}</button> : <div className="rv-step-row">{body}</div>}
    {open && step.published && <StepDetail step={step} agent={agent} />}
  </div>
}

function PageBody({ page }: { page: RecordPage }) {
  return <section><h5>{page.path} <span className="rv-quiet">· {kb(page.bytes)}</span></h5><Clip><Prose text={page.body} /></Clip></section>
}

function StepDetail({ step, agent }: { step: RecordStep; agent?: string }) {
  const facts = [
    step.server ? `${step.tool} on ${step.server}` : step.tool,
    ...(agent ? [agent] : []),
    `started ${clockUtc(step.at, true)} UTC`,
    ...(step.durationMs !== undefined ? [`took ${formatSpan(step.durationMs)}`] : []),
    step.outcome === 'ok' ? 'returned without error' : step.outcome === 'error' ? 'returned an error' : 'no result recorded',
  ]
  return <div className="rv-step-detail">
    {step.command && <section><pre className="rv-code"><span className="rv-prompt" aria-hidden="true">$ </span>{step.command}</pre></section>}
    {step.page && <PageBody page={step.page} />}
    {step.input !== undefined && <section><h5>{step.inputJson ? 'Input, JSON' : 'Input'}</h5><Clip><pre className="rv-code">{step.input}</pre></Clip></section>}
    <section><h5>Output</h5>{step.output ? <>{step.outputNote && <p className="rv-italic">{step.outputNote}</p>}<Clip><pre className="rv-code">{step.output}</pre></Clip></>
      : <p className="rv-note">The output is not published in this record.</p>}</section>
    <p className="rv-detail-facts">{facts.join(' · ')}</p>
  </div>
}
