import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { span, utc, type RecordStep, type RecordStory, type RecordTurningPoint, type StepKind } from '@drewstone/agent-record/story'

/** A selected stretch of the run, in epoch milliseconds. */
export type TimeWindow = [number, number]
/** A separator that stays at the end of a wrapped line, never at the start of the next. */
export const SEP = ' · '

const MIN = 60_000
export const KINDS: StepKind[] = ['read', 'compute', 'check', 'write', 'coordinate', 'wait', 'other']
const KIND_NAME: Record<StepKind, string> = { read: 'Read', compute: 'Compute', check: 'Check', write: 'Write', coordinate: 'Coordinate', wait: 'Wait', other: 'Other' }
const TICK_STEPS = [5_000, 10_000, 15_000, 30_000, ...[1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * MIN)]
/** Average glyph width of the UI font at 12 px; a label that does not fit is left out, never cut. */
const textWidth = (text: string) => text.length * 6.8

interface Segment { t0: number; t1: number; x0: number; x1: number; gap?: boolean }
interface Axis { segments: Segment[]; X: (t: number) => number; T: (x: number) => number; k: number; x0: number; x1: number }

/** A time axis that keeps active stretches to scale and compresses each stretch with no activity into a short break. */
function timeAxis(intervals: Array<[number, number]>, start: number, end: number, x0: number, x1: number, breakWidth: number): Axis {
  const busy = intervals.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)).sort((a, b) => a[0] - b[0])
  const limit = Math.max(3 * MIN, (end - start) * 0.04)
  const gaps: Array<[number, number]> = []
  let reach = busy.length ? busy[0]![1] : start
  for (const [a, b] of busy) { if (a - reach > limit) gaps.push([reach, a]); reach = Math.max(reach, b) }
  const segments: Segment[] = []
  let t = start
  for (const [a, b] of gaps) { segments.push({ t0: t, t1: a, x0: 0, x1: 0 }, { t0: a, t1: b, x0: 0, x1: 0, gap: true }); t = b }
  segments.push({ t0: t, t1: end, x0: 0, x1: 0 })
  const active = segments.filter((s) => !s.gap).reduce((sum, s) => sum + s.t1 - s.t0, 0) || 1
  const k = Math.max(0, x1 - x0 - gaps.length * breakWidth) / active
  let x = x0
  for (const s of segments) { s.x0 = x; s.x1 = x + (s.gap ? breakWidth : (s.t1 - s.t0) * k); x = s.x1 }
  const X = (time: number) => {
    if (time <= start) return x0
    for (const s of segments) if (time <= s.t1) return s.x0 + (s.t1 > s.t0 ? (time - s.t0) / (s.t1 - s.t0) : 0) * (s.x1 - s.x0)
    return x1
  }
  const T = (pos: number) => {
    for (const s of segments) if (pos <= s.x1) return s.t0 + (s.x1 > s.x0 ? Math.max(0, pos - s.x0) / (s.x1 - s.x0) : 0) * (s.t1 - s.t0)
    return end
  }
  return { segments, X, T, k, x0, x1 }
}

function axisTicks(axis: Axis, minPx: number) {
  const step = TICK_STEPS.find((s) => s * axis.k >= minPx) ?? TICK_STEPS[TICK_STEPS.length - 1]!
  const ticks: Array<{ t: number; x: number; text: string }> = []
  let last = -Infinity
  for (const s of axis.segments) {
    if (s.gap) continue
    for (let t = Math.ceil(s.t0 / step) * step; t <= s.t1; t += step) {
      const x = axis.X(t)
      if (x - last < minPx * 0.8 || x < axis.x0 + 16 || x > axis.x1 - 16) continue
      if (axis.segments.some((b) => b.gap && Math.abs(x - (b.x0 + b.x1) / 2) < minPx * 0.6)) continue
      ticks.push({ t, x, text: utc(t, step < MIN ? 'second' : 'minute')! }); last = x
    }
  }
  return ticks
}

/** Markers in one row at their times, nudged apart just enough that none overlaps; a leader joins each to its time. */
function placeMarkers(xs: number[], lo: number, hi: number, d: number): number[] {
  const out = xs.slice()
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i]!, i ? out[i - 1]! + d : lo)
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i]!, i < out.length - 1 ? out[i + 1]! - d : hi)
  return out
}

/** The numbered glyph a turning point shares with its marker on the spine and its row in the episode list. */
export function PointNumber({ point }: { point: Pick<RecordTurningPoint, 'n' | 'tone'> }) {
  return <span className={`rv-num tone-${point.tone}`}>{point.n}</span>
}

/** One step on a lane. Each kind keeps its own colour and shape, so the lane reads as reading, computing, writing and waiting. */
function StepMark({ step, X, y, h }: { step: RecordStep; X: (t: number) => number; y: number; h: number }) {
  const x = X(step.at), w = X(step.end) - x, kind = `rv-mark-step k-${step.kind}`
  if (step.kind === 'coordinate') return <circle className={kind} cx={x} cy={y + h / 2} r={2.2} />
  if (step.kind === 'wait') return <rect className={kind} x={x} y={y + h / 2 - 1.5} width={Math.max(2, w)} height={3} rx={1.5} />
  return w >= 3 ? <rect className={`${kind} bar`} x={x + 0.5} y={y + 3} width={w - 1} height={h - 6} rx={1.5} />
    : <rect className={kind} x={x - 0.6} y={y + 2} width={1.4} height={h - 4} />
}

function LegendMark({ kind }: { kind: StepKind }) {
  return <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
    {kind === 'coordinate' ? <circle className={`rv-mark-step k-${kind}`} cx={6} cy={6} r={2.4} />
      : kind === 'wait' ? <rect className={`rv-mark-step k-${kind}`} x={1} y={4.5} width={10} height={3} rx={1.5} />
      : <rect className={`rv-mark-step k-${kind}`} x={5.2} y={1} width={1.6} height={10} />}
  </svg>
}

/** The width of whichever element currently holds the ref: the empty placeholder first, then the drawn spine. */
function useWidth(fallback: number) {
  const [element, ref] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    if (!element) return
    const read = () => { const w = Math.floor(element.getBoundingClientRect().width); if (w > 0) setWidth(w) }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [ref, width] as const
}

/**
 * The run on one slim spine: a lane per agent with its steps marked by kind, failed steps as red ticks, its episodes as
 * bands, and the turning points numbered above. Dragging across the lanes zooms to that stretch.
 */
export function RecordSpine({ story, points, colorOf, agent, onAgent, window, onWindow, openEpisode, openPoint }: {
  story: RecordStory
  points: RecordTurningPoint[]
  colorOf: (id: string) => string
  agent?: string
  onAgent: (id: string | undefined) => void
  window?: TimeWindow
  onWindow: (window: TimeWindow | undefined) => void
  openEpisode: (id: string) => void
  openPoint: (point: RecordTurningPoint) => void
}) {
  const [ref, W] = useWidth(1000)
  const [drag, setDrag] = useState<[number, number]>()
  const press = useRef<{ x: number; left: number } | undefined>(undefined)
  const dragged = useRef(false)
  const { summary, steps, episodes } = story
  const geo = useMemo(() => {
    if (summary.start === undefined || summary.end === undefined) return undefined
    const narrow = W < 640, multi = summary.agents.length > 1, stacked = narrow && multi
    let longest = 0
    for (const item of summary.agents) longest = Math.max(longest, textWidth(item.label) + item.depth * 10)
    const labelW = multi && !narrow ? Math.round(Math.min(200, Math.max(96, longest + 14))) : 0
    const x0 = labelW + 8, x1 = W - 10
    const t0 = window?.[0] ?? summary.start, t1 = window?.[1] ?? summary.end
    const intervals: Array<[number, number]> = []
    if (!window) {
      for (const step of steps) intervals.push([step.at, step.end])
      for (const episode of episodes) intervals.push([episode.start, episode.end])
      for (const point of story.turningPoints) intervals.push([point.at, point.end ?? point.at])
    }
    const axis = timeAxis(intervals, t0, Math.max(t1, t0 + 1000), x0, x1, narrow ? 20 : 30)
    let R = narrow ? 8 : 9
    if (points.length * (2 * R + 2) > x1 - x0) R = Math.max(5, ((x1 - x0) / points.length - 2) / 2)
    const xs = points.map((point) => axis.X(point.at))
    const placed = placeMarkers(xs, x0 + R, x1 - R, 2 * R + 2)
    const top = points.length ? 2 * R + 16 : 6
    const laneH = multi ? 18 : 30, labelH = stacked ? 15 : 0, gap = stacked ? 8 : 5
    const rowH = labelH + laneH + gap
    const laneY = new Map(summary.agents.map((item, i) => [item.id, top + i * rowH + labelH]))
    const axisY = top + summary.agents.length * rowH - gap + 6
    const ticks = axisTicks(axis, narrow ? 56 : 80)
    const taken: Array<[number, number]> = ticks.map((tick) => [tick.x - textWidth(tick.text) / 2, tick.x + textWidth(tick.text) / 2])
    const quiet: Array<{ x: number; text: string }> = []
    for (const s of axis.segments) {
      if (!s.gap) continue
      const text = `${span(s.t1 - s.t0)!.replace(/ \d+ s$/, '')} quiet`, cx = (s.x0 + s.x1) / 2, half = textWidth(text) / 2
      if (taken.some(([a, b]) => cx + half + 6 > a && cx - half - 6 < b) || cx - half < 0 || cx + half > W) continue
      taken.push([cx - half, cx + half]); quiet.push({ x: cx, text })
    }
    return { narrow, multi, stacked, labelW, x0, x1, t0, t1, axis, R, xs, placed, top, laneH, labelH, laneY, axisY, ticks, quiet, H: axisY + 22 + (quiet.length ? 14 : 0) }
  }, [W, window, summary, steps, episodes, story.turningPoints, points])

  const stepsBy = useMemo(() => {
    const map = new Map<string, RecordStep[]>()
    for (const step of steps) { const list = map.get(step.node); if (list) list.push(step); else map.set(step.node, [step]) }
    return map
  }, [steps])
  const episodesBy = useMemo(() => {
    const map = new Map<string, typeof episodes>()
    for (const episode of episodes) { const list = map.get(episode.node); if (list) list.push(episode); else map.set(episode.node, [episode]) }
    return map
  }, [episodes])
  const kinds = useMemo(() => KINDS.filter((kind) => steps.some((step) => step.kind === kind)), [steps])

  if (!geo) return <div ref={ref} />
  const { axis, laneH, laneY, x0, x1, t0, t1 } = geo
  const X = axis.X
  const inside = (a: number, b = a) => b >= t0 && a <= t1

  const at = (event: PointerEvent<SVGSVGElement>) => { const box = event.currentTarget.getBoundingClientRect(); return Math.max(x0, Math.min(x1, (event.clientX - box.left) * W / (box.width || W))) }
  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    dragged.current = false
    press.current = { x: at(event), left: event.currentTarget.getBoundingClientRect().left }
  }
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!press.current) return
    const x = at(event)
    if (!drag && Math.abs(x - press.current.x) < 5) return
    if (!drag) event.currentTarget.setPointerCapture(event.pointerId)
    setDrag([press.current.x, x])
  }
  const up = () => {
    if (drag && Math.abs(drag[1] - drag[0]) > 6) {
      dragged.current = true
      const a = axis.T(Math.min(drag[0], drag[1])), b = axis.T(Math.max(drag[0], drag[1]))
      if (b - a >= 1000) onWindow([a, b])
    }
    press.current = undefined
    setDrag(undefined)
  }
  const click = (open: () => void) => () => { if (!dragged.current) open() }
  const key = (open: () => void) => (event: { key: string; preventDefault: () => void }) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } }

  const lanes: ReactNode[] = []
  for (const item of summary.agents) {
    const y = laneY.get(item.id)!, color = colorOf(item.id), own = stepsBy.get(item.id) ?? []
    let first = item.start, last = item.end
    for (const step of own) { if (first === undefined || step.at < first) first = step.at; if (last === undefined || step.end > last) last = step.end }
    const dim = agent !== undefined && agent !== item.id
    lanes.push(<g key={item.id} className={`rv-lane${dim ? ' dim' : ''}`} style={{ color }}>
      {first !== undefined && last !== undefined && inside(first, last) && <line className="rv-alive" x1={X(first)} x2={Math.max(X(last), X(first) + 1)} y1={y + laneH / 2} y2={y + laneH / 2} />}
      {(episodesBy.get(item.id) ?? []).filter((episode) => inside(episode.start, episode.end)).map((episode, i) => {
        const a = X(episode.start), b = Math.max(X(episode.end), a + 3)
        const open = () => openEpisode(episode.id)
        return <rect key={episode.id} className={`rv-band${i % 2 ? ' alt' : ''}${episode.notCaptured ? ' gap' : ''}`} x={a + 0.5} y={y} width={Math.max(2, b - a - 1)} height={laneH} rx={3}
          role="button" tabIndex={-1} aria-label={`Episode ${episode.n}: ${episode.title}`} onClick={click(open)}><title>{`${utc(episode.start, 'minute')} UTC · ${episode.title}`}</title></rect>
      })}
      {own.filter((step) => step.outcome !== 'error' && inside(step.at, step.end)).map((step) => <StepMark key={step.id} step={step} X={X} y={y} h={laneH} />)}
      {own.filter((step) => step.outcome === 'error' && inside(step.at)).map((step) => <rect key={step.id} className="rv-mark-fail" x={X(step.at) - 1.1} y={y - 1} width={2.2} height={laneH + 2} rx={1} />)}
    </g>)
  }
  const spawns: ReactNode[] = []
  for (const item of summary.agents) {
    if (!item.parent || item.start === undefined || !inside(item.start) || !laneY.has(item.parent)) continue
    const x = X(item.start), ya = laneY.get(item.parent)! + laneH / 2, yb = laneY.get(item.id)! + laneH / 2
    spawns.push(<g key={item.id} className="rv-spawn" style={{ color: colorOf(item.id) }}><line x1={x} x2={x} y1={ya} y2={yb} /><circle cx={x} cy={yb} r={2.4} /></g>)
  }
  const cy = 4 + geo.R
  const label = `Timeline of ${summary.agents.length === 1 ? 'one agent' : `${summary.agents.length} agents`} from ${utc(t0, 'minute')} to ${utc(t1, 'minute')} UTC, with ${points.length} numbered turning points. Drag across the lanes to zoom.`

  return <section className="rv-spine-card" aria-label="Timeline">
    <div className="rv-spine-top">
      {window ? <><span><b>{utc(t0, 'minute')}–{utc(t1, 'minute')} UTC</b>{SEP}{span(t1 - t0)}</span><button type="button" className="rv-text-button" onClick={() => onWindow(undefined)}>Whole run</button></>
        : <span>{utc(t0, 'minute')}–{utc(t1, 'minute')} UTC{SEP}drag across the lanes to zoom</span>}
    </div>
    <div className="rv-spine" ref={ref} style={{ height: geo.H }}>
      <svg viewBox={`0 0 ${W} ${geo.H}`} width="100%" role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { press.current = undefined; setDrag(undefined) }}>
        <defs><pattern id="rv-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="rv-hatch-line" /></pattern></defs>
        <rect className="rv-hit" x={x0} y={geo.top - 4} width={Math.max(0, x1 - x0)} height={geo.axisY - geo.top + 4} />
        {lanes}
        {spawns}
        {axis.segments.filter((s) => s.gap).map((s) => <g key={s.t0} className="rv-break">
          <rect x={s.x0 + 2} y={geo.top - 2} width={Math.max(0, s.x1 - s.x0 - 4)} height={geo.axisY - geo.top + 8} />
          <path d={`M${s.x0 + 6} ${geo.axisY + 5}l4 -10M${s.x1 - 10} ${geo.axisY + 5}l4 -10`} />
        </g>)}
        <line className="rv-axis" x1={x0} x2={x1} y1={geo.axisY} y2={geo.axisY} />
        {geo.ticks.map((tick) => <g key={tick.t}><line className="rv-axis" x1={tick.x} x2={tick.x} y1={geo.axisY} y2={geo.axisY + 4} /><text className="rv-axis-label" x={tick.x} y={geo.axisY + 16} textAnchor="middle">{tick.text}</text></g>)}
        {geo.quiet.map((item) => <text key={item.x} className="rv-axis-label" x={item.x} y={geo.axisY + 30} textAnchor="middle">{item.text}</text>)}
        {points.map((point, i) => {
          const open = () => openPoint(point)
          return <g key={point.n} className={`rv-marker tone-${point.tone}`} role="button" tabIndex={0} aria-label={`Turning point ${point.n}, ${utc(point.at, 'minute')} UTC: ${point.title}`} onClick={click(open)} onKeyDown={key(open)}>
            <path className="rv-leader" d={`M${geo.placed[i]} ${cy + geo.R}L${geo.xs[i]} ${geo.top - 3}`} />
            <circle cx={geo.placed[i]} cy={cy} r={geo.R} />
            <text x={geo.placed[i]} y={cy + 3.8} textAnchor="middle">{point.n}</text>
            <title>{`${utc(point.at, 'minute')} UTC · ${point.title}`}</title>
          </g>
        })}
        {drag && <rect className="rv-brush" x={Math.min(drag[0], drag[1])} y={geo.top - 4} width={Math.abs(drag[1] - drag[0])} height={geo.axisY - geo.top + 4} />}
      </svg>
      {geo.multi && summary.agents.map((item) => {
        const y = laneY.get(item.id)!
        return <button key={item.id} type="button" className={`rv-lane-label${geo.stacked ? ' stacked' : ''}`} aria-pressed={agent === item.id} title={item.label}
          style={geo.stacked ? { top: y - geo.labelH, left: x0, right: 0, height: geo.labelH, color: colorOf(item.id) }
            : { top: y, left: item.depth * 10, width: geo.labelW - 8 - item.depth * 10, height: laneH, color: colorOf(item.id) }}
          onClick={() => onAgent(agent === item.id ? undefined : item.id)}>{item.label}</button>
      })}
    </div>
    <ul className="rv-legend" aria-label="Marks on the timeline">
      {kinds.map((kind) => <li key={kind}><LegendMark kind={kind} />{KIND_NAME[kind]}</li>)}
      {summary.errors > 0 && <li><i className="rv-legend-fail" />Failed step</li>}
      {episodes.some((episode) => episode.notCaptured) && <li><i className="rv-legend-gap" />Not captured</li>}
    </ul>
  </section>
}
