import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { countPhrase, span, utc, type EpisodeItem, type RecordEpisode, type RecordStep, type RecordStory, type StepOutcome } from '@drewstone/agent-record/story'
import { PointNumber, SEP } from './RecordSpine.js'

/** Which episodes, steps and folded runs of quiet episodes the reader has opened. */
export interface Opened { episodes: Set<string>; steps: Set<string>; folds: Set<string> }

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const ISO = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z\b/g
/** A raw timestamp inside quoted words reads as a UTC clock time; the instant is unchanged. */
export const readable = (text: string) => text.replace(ISO, (stamp) => `${utc(stamp, 'second')} UTC`)
/** Literal stars and underscores inside $…$ stay text, so a formula never turns into emphasis. */
const keepMath = (text: string) => text.replace(/\$[^$\n]+\$/g, (math) => math.replace(/([*_])/g, '\\$1'))

/** Agent words and inputs as Markdown in the prose font; tables scroll in their own region. */
export function Prose({ text }: { text: string }) {
  return <div className="rv-prose"><Markdown skipHtml remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => /^https?:\/\//i.test(href ?? '') ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span>,
    img: ({ alt }) => <span>{alt || 'Image not published'}</span>,
    table: ({ children }) => <div className="rv-table-scroll" role="region" aria-label="Table" tabIndex={0}><table>{children}</table></div>,
  }}>{keepMath(readable(text))}</Markdown></div>
}
/** One line of someone's words: code spans and emphasis, nothing else. */
export function Inline({ text }: { text: string }) {
  return <Markdown allowedElements={['p', 'code', 'em', 'strong']} unwrapDisallowed components={{ p: ({ children }) => <>{children}</> }}>{keepMath(readable(text))}</Markdown>
}

const MARK_LABEL: Record<StepOutcome, string> = { ok: 'Returned without error', error: 'Failed', none: 'No result recorded' }
function Mark({ outcome }: { outcome: StepOutcome }) {
  return <svg className={`rv-mark ${outcome}`} viewBox="0 0 16 16" role="img" aria-label={MARK_LABEL[outcome]}>
    {outcome === 'ok' ? <path d="M3.5 8.5l3 3 6-7" /> : outcome === 'error' ? <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /> : <circle cx="8" cy="8" r="3.5" />}
  </svg>
}
const Chevron = () => <span className="rv-chev" aria-hidden="true" />

/** Long text shows its first 380 px with a fade and a button for the rest. */
function Clip({ children, limit = 380 }: { children: ReactNode; limit?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(false), [all, setAll] = useState(false)
  useEffect(() => { if (ref.current) setOver(ref.current.scrollHeight > limit + 48) }, [children, limit])
  return <>
    <div ref={ref} className={`rv-clip${over && !all ? ' clipped' : ''}`} style={over && !all ? { maxHeight: limit } : undefined}>{children}</div>
    {over && <button type="button" className="rv-more" onClick={() => setAll(!all)}>{all ? 'Show less' : 'Show all'}</button>}
  </>
}

/** A list this long folds each run of two or more quiet episodes (no turning point, no failure) into one row. */
const FOLD_FROM = 9
type Row = { type: 'episode'; episode: RecordEpisode } | { type: 'fold'; id: string; episodes: RecordEpisode[] }
function rowsOf(episodes: RecordEpisode[], opened: Opened): Row[] {
  if (episodes.length < FOLD_FROM) return episodes.map((episode) => ({ type: 'episode', episode }))
  const out: Row[] = []
  let run: RecordEpisode[] = []
  const flush = () => {
    const id = run.length ? `fold-${run[0]!.id}` : ''
    if (run.length >= 2 && !opened.folds.has(id)) out.push({ type: 'fold', id, episodes: run })
    else for (const episode of run) out.push({ type: 'episode', episode })
    run = []
  }
  for (const episode of episodes) {
    if (!episode.turningPoints.length && !episode.errors && !episode.notCaptured && !opened.episodes.has(episode.id)) run.push(episode)
    else { flush(); out.push({ type: 'episode', episode }) }
  }
  flush()
  return out
}

export function EpisodeList({ story, episodes, colorOf, opened, setOpened, onStep }: {
  story: RecordStory
  episodes: RecordEpisode[]
  colorOf: (id: string) => string
  opened: Opened
  setOpened: Dispatch<SetStateAction<Opened>>
  onStep: (id: string) => void
}) {
  const { agents } = story.summary
  const multi = agents.length > 1
  const agentOf = new Map(agents.map((agent) => [agent.id, agent]))
  const pointOf = new Map(story.turningPoints.map((point) => [point.n, point]))
  const toggle = (id: string) => setOpened((prev) => { const next = new Set(prev.episodes); if (!next.delete(id)) next.add(id); return { ...prev, episodes: next } })
  const toggleStep = (id: string) => {
    const opening = !opened.steps.has(id)
    setOpened((prev) => { const next = new Set(prev.steps); if (opening) next.add(id); else next.delete(id); return { ...prev, steps: next } })
    if (opening) onStep(id)
  }
  return <ol className="rv-eps">{rowsOf(episodes, opened).map((row) => {
    if (row.type === 'fold') {
      const first = row.episodes[0]!, last = row.episodes[row.episodes.length - 1]!
      const steps = row.episodes.reduce((sum, episode) => sum + episode.steps.length, 0)
      return <li key={row.id} className="rv-ep fold">
        <button type="button" className="rv-ep-head" aria-expanded={false} onClick={() => setOpened((prev) => ({ ...prev, folds: new Set(prev.folds).add(row.id) }))}>
          <time className="rv-ep-time">{utc(first.start, 'minute')}</time>
          <span className="rv-ep-rail"><span className="rv-dot hollow" /></span>
          <span className="rv-ep-main"><span className="rv-ep-title quiet">{count(row.episodes.length, 'quieter episode')}</span>
            <span className="rv-ep-sub">{row.episodes.map((episode) => readable(episode.title)).join(SEP)}</span></span>
          <span className="rv-ep-facts">{[steps ? count(steps, 'step') : '', span(last.end - first.start) ?? ''].filter(Boolean).join(SEP)}<Chevron /></span>
        </button>
      </li>
    }
    const { episode } = row
    const open = opened.episodes.has(episode.id), owner = agentOf.get(episode.node)
    const point = episode.turningPoints.length ? pointOf.get(episode.turningPoints[0]!) : undefined
    const who = multi && owner && owner.depth > 0 ? owner.label : undefined
    const facts = [episode.steps.length ? count(episode.steps.length, 'step') : '', episode.end - episode.start >= 1000 ? span(episode.end - episode.start) ?? '' : ''].filter(Boolean)
    return <li key={episode.id} data-episode={episode.id} className={`rv-ep${open ? ' open' : ''}${episode.notCaptured ? ' gap' : ''}`} style={{ ['--rv-agent' as string]: colorOf(episode.node) }}>
      <button type="button" className="rv-ep-head" aria-expanded={open} onClick={() => toggle(episode.id)}>
        <time className="rv-ep-time">{utc(episode.start, 'minute')}</time>
        <span className="rv-ep-rail">{point ? <PointNumber point={point} /> : <span className="rv-dot" />}</span>
        <span className="rv-ep-main">
          <span className="rv-ep-title"><Inline text={episode.title} /></span>
          {(who || episode.quote) && <span className="rv-ep-sub">{who && <span className="rv-agent-name">{who}</span>}{who && episode.quote ? SEP : ''}{episode.quote && <Inline text={episode.quote} />}</span>}
        </span>
        <span className="rv-ep-facts">{facts.join(SEP)}{episode.errors > 0 && <>{facts.length ? SEP : ''}<span className="rv-bad">{episode.errors} failed</span></>}<Chevron /></span>
      </button>
      {open && <div className="rv-ep-body">
        {episode.errors > 0 && !episode.errorTextPublished && <p className="rv-line">The error text of these failed steps is not published.</p>}
        {episode.items.map((item, i) => <Item key={itemKey(item, i)} item={item} title={i === firstSay(episode) ? episode.title : undefined} label={multi ? owner?.label : undefined} opened={opened} toggle={toggleStep} />)}
      </div>}
    </li>
  })}</ol>
}
const itemKey = (item: EpisodeItem, i: number) => item.type === 'step' ? item.step.id : item.type === 'repeat' ? `repeat-${item.steps[0]!.id}` : `${item.id}-${i}`
const firstSay = (episode: RecordEpisode) => episode.items.findIndex((item) => item.type === 'say')

function Item({ item, title, label, opened, toggle }: { item: EpisodeItem; title?: string; label?: string; opened: Opened; toggle: (id: string) => void }) {
  switch (item.type) {
    case 'say': {
      // The episode's title is the first sentence of these words; the body goes on from there.
      const text = title && item.text.startsWith(title) ? item.text.slice(title.length).trim() : item.text
      if (!text && !item.note) return null
      return <div className="rv-beat" data-item={item.id}>{text && <Prose text={text} />}{item.note && <p className="rv-footnote">{item.note}</p>}</div>
    }
    case 'input': {
      const check = item.check
      const tone = check ? (check.outcome === 'passed' ? 'ok' : 'error') : 'warn'
      const head = check ? `Check ${check.outcome}${check.by ? `, ${check.by}` : ''}${check.subject ? ` on ${check.subject}` : ''}` : 'Prompt'
      return <div className={`rv-callout tone-${tone}`} data-item={item.id}>
        <p className="rv-callout-head"><span>{head}</span><time>{utc(item.at, 'second')} UTC</time></p>
        <Prose text={item.text} />
        {item.note && <p className="rv-footnote">{item.note}</p>}
      </div>
    }
    case 'note': return <p className={`rv-line tone-${item.tone}`} data-item={item.id}><time>{utc(item.at, 'minute')}</time>{SEP}{readable(item.text)}</p>
    case 'repeat': {
      const first = item.steps[0]!, last = item.steps[item.steps.length - 1]!
      const failed = item.steps.filter((step) => step.outcome === 'error').length
      return <div className={`rv-step${failed ? ' fail' : ''}`}><div className="rv-step-head">
        <Mark outcome={item.outcome} />
        <span className="rv-step-text"><span className="rv-step-title">{countPhrase(item.action, item.steps.length)}</span>
          <span className="rv-step-line">{failed ? <><span className="rv-bad">{failed === item.steps.length ? 'all failed' : `${failed} failed`}</span>{SEP}</> : ''}<span className="rv-tool">{first.tool}{first.server ? `${SEP}${first.server}` : ''}</span></span></span>
        <span className="rv-step-right">{utc(first.at, 'minute')}{utc(last.at, 'minute') !== utc(first.at, 'minute') ? `–${utc(last.at, 'minute')}` : ''}</span>
      </div></div>
    }
    case 'step': return <StepRow step={item.step} open={opened.steps.has(item.step.id)} toggle={toggle} agent={label} />
  }
}

/** The first line of a result, or of an error, shown whole. */
const firstLine = (text: string) => text.split('\n').map((line) => line.trim()).find(Boolean) ?? ''

function StepRow({ step, open, toggle, agent }: { step: RecordStep; open: boolean; toggle: (id: string) => void; agent?: string }) {
  const object = step.object && (step.command ? <code className="rv-cmd">{firstLine(step.command)}</code> : step.objectMono ? <code>{step.object}</code> : <span>{step.object}</span>)
  const line = step.output ? <span className="rv-step-line mono">{firstLine(step.output)}</span>
    : <span className="rv-step-line"><span className="rv-tool">{step.tool}{step.server ? `${SEP}${step.server}` : ''}</span></span>
  const body = <>
    <Mark outcome={step.outcome} />
    <span className="rv-step-text"><span className="rv-step-title">{step.action}{object && <> {object}</>}</span>{line}</span>
    <span className="rv-step-right">{step.durationMs !== undefined && span(step.durationMs)}{step.published && <Chevron />}</span>
  </>
  return <div className={`rv-step${step.outcome === 'error' ? ' fail' : ''}${open ? ' open' : ''}`} data-step={step.id}>
    {step.published ? <button type="button" className="rv-step-head" aria-expanded={open} onClick={() => toggle(step.id)}>{body}</button> : <div className="rv-step-head">{body}</div>}
    {open && step.published && <StepDetail step={step} agent={agent} />}
  </div>
}

function Block({ label, tag, note, children }: { label: string; tag?: string; note?: string; children: ReactNode }) {
  return <section className="rv-io"><p className="rv-io-head"><b>{label}</b>{tag && <span className="rv-io-tag">{tag}</span>}</p>{note && <p className="rv-io-note">{note}</p>}<Clip>{children}</Clip></section>
}

function StepDetail({ step, agent }: { step: RecordStep; agent?: string }) {
  const meta = [
    step.server ? `${step.tool} on ${step.server}` : step.tool,
    ...(agent ? [agent] : []),
    `called ${utc(step.at, 'second')} UTC`,
    ...(step.durationMs !== undefined ? [`took ${span(step.durationMs)}`] : []),
  ]
  return <div className="rv-detail">
    {step.command && <Block label="Command"><pre>{step.command}</pre></Block>}
    {step.input !== undefined && <Block label={step.command ? 'All arguments' : 'Input'} tag={step.inputFormat === 'json' ? 'JSON' : undefined} note={step.inputNote}><pre>{step.input}</pre></Block>}
    {step.output !== undefined ? <Block label="Output" tag={step.outputFormat === 'json' ? 'JSON' : undefined} note={step.outputNote}><pre>{step.output}</pre></Block>
      : <section className="rv-io"><p className="rv-io-note">The output is not published in this record.</p></section>}
    <p className="rv-io-meta">{meta.join(SEP)}{SEP}{step.outcome === 'ok' ? 'returned without error' : step.outcome === 'error' ? <span className="rv-bad">returned an error</span> : 'no result recorded'}</p>
  </div>
}

