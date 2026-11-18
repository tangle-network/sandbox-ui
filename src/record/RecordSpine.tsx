import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { clockUtc, formatSpan, type RecordAgent, type RecordStep, type RecordStory, type RecordTurningPoint, type StepKind } from '@drewstone/agent-record/story'

/** A selected stretch of the run, in epoch milliseconds. */
export type TimeWindow = [number, number]

const MIN = 60_000
export const KINDS: StepKind[] = ['read', 'compute', 'check', 'write', 'coordinate', 'wait', 'other']
const KIND_NAME: Record<StepKind, string> = { read: 'Reading', compute: 'Computing', check: 'Checking', write: 'Writing', coordinate: 'Coordinating', wait: 'Waiting', other: 'Other' }
const TICK_STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 360, 720, 1440].map(m => m * MIN)
const FOCUS_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map(s => s * 1000)
/** Average glyph widths of the body font at 12 px, for deciding whether a label fits; a label that does not fit is left out, never cut. */
const textWidth = (text: string, bold = false) => text.length * (bold ? 7.1 : 6.6)

interface Segment { t0: number; t1: number; x0: number; x1: number; gap?: boolean }
interface Axis { segments: Segment[]; X: (t: number) => number; T: (x: number) => number; k: number; x0: number; x1: number }

/** A time axis that keeps active stretches to scale and compresses each stretch with no activity into a short break. */
function timeAxis(intervals: Array<[number, number]>, start: number, end: number, x0: number, x1: number, narrow: boolean): Axis {
  const busy = intervals.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)).sort((a, b) => a[0] - b[0])
  const limit = Math.max(3 * MIN, (end - start) * 0.03)
  const gaps: Array<[number, number]> = []
  let reach = busy.length ? busy[0]![1] : start
  for (const [a, b] of busy) { if (a - reach > limit) gaps.push([reach, a]); reach = Math.max(reach, b) }
  const segments: Segment[] = []
  let t = start
  for (const [a, b] of gaps) { segments.push({ t0: t, t1: a, x0: 0, x1: 0 }, { t0: a, t1: b, x0: 0, x1: 0, gap: true }); t = b }
  segments.push({ t0: t, t1: end, x0: 0, x1: 0 })
  const breakWidth = narrow ? 18 : 28
  const active = segments.filter(s => !s.gap).reduce((sum, s) => sum + s.t1 - s.t0, 0) || 1
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
  const step = TICK_STEPS.find(s => s * axis.k >= minPx) ?? TICK_STEPS[TICK_STEPS.length - 1]!
  const ticks: Array<{ t: number; x: number }> = []
  let last = -Infinity
  for (const s of axis.segments.filter(item => !item.gap)) {
    for (let t = Math.ceil(s.t0 / step) * step; t <= s.t1; t += step) {
      const x = axis.X(t)
      if (x - last < minPx * 0.8 || x < axis.x0 + 18 || x > axis.x1 - 18) continue
      if (axis.segments.some(b => b.gap && Math.abs(x - (b.x0 + b.x1) / 2) < minPx * 0.6)) continue
      ticks.push({ t, x }); last = x
    }
  }
  return ticks
}

const SHAPE: Record<RecordTurningPoint['kind'], 'circle' | 'diamond' | 'square'> = {
  spawn: 'circle', 'never-started': 'circle', errors: 'circle', check: 'diamond', input: 'diamond', steer: 'diamond', page: 'square', attempt: 'square', end: 'square',
}
function Badge({ point, x, y }: { point: RecordTurningPoint; x: number; y: number }) {
  const fill = `var(--rv-tone-${point.tone})`, r = 9
  return <g className="rv-badge" transform={`translate(${x} ${y})`}>
    {SHAPE[point.kind] === 'diamond' ? <path d={`M0 ${-r - 2}L${r + 2} 0L0 ${r + 2}L${-r - 2} 0Z`} fill={fill} />
      : SHAPE[point.kind] === 'square' ? <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={3} fill={fill} /> : <circle r={r} fill={fill} />}
    <text y={4} textAnchor="middle">{point.n}</text>
  </g>
}
/** The numbered glyph a turning point shares with its pin on the spine. */
export function PointGlyph({ point }: { point: RecordTurningPoint }) {
  return <svg className="rv-glyph" viewBox="-12 -12 24 24" width={24} height={24} aria-hidden="true"><Badge point={point} x={0} y={0} /></svg>
}

interface Row { agent: RecordAgent; y: number; labelH: number; tickY: number; tickH: number; bandY: number; h: number; steps: RecordStep[]; empty: boolean }

function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => { const w = Math.floor(entries[0]?.contentRect.width ?? 0); if (w > 0) setWidth(w) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export function RecordSpine({ story, agent, onAgent, window, onWindow, openEpisode, openStep, openPoint }: {
  story: RecordStory
  agent?: string
  onAgent: (id: string | undefined) => void
  window?: TimeWindow
  onWindow: (window: TimeWindow | undefined) => void
  openEpisode: (id: string) => void
  openStep: (episode: string, step: string) => void
  openPoint: (point: RecordTurningPoint) => void
}) {
  const [ref, W] = useWidth(1086)
  const [drag, setDrag] = useState<{ a: number; b: number }>()
  const { summary, steps, episodes, turningPoints, gaps } = story
  const narrow = W < 640
  const layout = useMemo(() => {
    const labelW = narrow ? 0 : 190
    const x0 = labelW + (narrow ? 4 : 16), x1 = W - (narrow ? 4 : 8)
    const intervals: Array<[number, number]> = [
      ...steps.map(step => [step.at, step.end] as [number, number]),
      ...episodes.flatMap(episode => episode.items.map(item => [item.at, item.at] as [number, number])),
      ...turningPoints.map(point => [point.at, point.end ?? point.at] as [number, number]),
      ...gaps.map(gap => [gap.start, gap.end] as [number, number]),
      ...summary.agents.flatMap(item => item.start !== undefined ? [[item.start, item.start] as [number, number]] : []),
    ]
    const axis = timeAxis(intervals, summary.start, summary.end, x0, x1, narrow)
    // Pins stack in rows so they never touch.
    const placed = turningPoints.map(point => ({ point, x: axis.X(point.at), row: 0 }))
    for (const pin of placed) while (placed.some(other => other !== pin && other.row === pin.row && Math.abs(other.x - pin.x) < 22 && placed.indexOf(other) < placed.indexOf(pin)) && pin.row < 3) pin.row++
    const pinRows = placed.length ? Math.max(...placed.map(pin => pin.row)) + 1 : 0
    const AX = 22, pinTop = AX + 4
    let y = pinTop + pinRows * 22 + (pinRows ? 6 : 0)
    const tall = summary.agents.length <= 2 ? 34 : 24
    const rows: Row[] = summary.agents.map(item => {
      const own = steps.filter(step => step.node === item.id)
      const empty = !own.length && !gaps.some(gap => gap.node === item.id)
      const label = narrow ? `${item.label} ${item.status} · ${item.steps} steps${item.errors ? ` · ${item.errors} failed` : ''}` : item.label
      const perLine = narrow ? Math.max(20, Math.floor((W - 8) / 7.4)) : 24
      const labelLines = Math.max(1, Math.ceil(label.length / perLine)) + (narrow ? 0 : 1)
      const labelH = narrow ? labelLines * 18 + 2 : 0
      const content = empty ? 20 : tall + 6 + 18 + 8
      const h = Math.max(labelH + content, narrow ? 0 : labelLines * 18 + 14)
      const tickY = y + labelH + (narrow ? 2 : Math.max(6, (h - content) / 2))
      const row: Row = { agent: item, y, labelH, tickY, tickH: empty ? 14 : tall, bandY: tickY + tall + 6, h, steps: own, empty }
      y += h
      return row
    })
    return { labelW, axis, AX, pinTop, placed, rows, H: y + 2, ticks: axisTicks(axis, narrow ? 54 : 70) }
  }, [W, narrow, steps, episodes, turningPoints, gaps, summary])
  const { axis, rows, H, AX } = layout

  const pointer = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
    return Math.max(axis.x0, Math.min(axis.x1, event.clientX - box.left))
  }
  const brushStart = (event: PointerEvent<SVGRectElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const x = pointer(event)
    setDrag({ a: x, b: x })
  }
  const brushMove = (event: PointerEvent<SVGRectElement>) => { if (drag) setDrag({ a: drag.a, b: pointer(event) }) }
  const brushEnd = () => {
    if (drag && Math.abs(drag.b - drag.a) > 6) onWindow([axis.T(Math.min(drag.a, drag.b)), axis.T(Math.max(drag.a, drag.b))])
    setDrag(undefined)
  }
  const shown = drag && Math.abs(drag.b - drag.a) > 6 ? [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)] : window ? [axis.X(window[0]), axis.X(window[1])] : undefined
  const kinds = KINDS.filter(kind => steps.some(step => step.kind === kind))
  const label = `Timeline of ${summary.agents.length === 1 ? 'one agent' : `${summary.agents.length} agents`}, ${episodes.length} episodes and ${turningPoints.length} turning points. Drag across it to look at a stretch.`

  return <section className="rv-card rv-spine-card" aria-label="Timeline">
    <div className="rv-spine" ref={ref} style={{ height: H }}>
      <svg width={W} height={H} role="img" aria-label={label}>
        <defs><pattern id="rv-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" className="rv-hatch-bg" /><line x1="0" y1="0" x2="0" y2="6" className="rv-hatch-line" /></pattern></defs>
        {layout.ticks.map(tick => <g key={tick.t}><line className="rv-ax-line" x1={tick.x} x2={tick.x} y1={AX - 4} y2={H} /><text className="rv-ax-label" x={tick.x} y={14} textAnchor="middle">{clockUtc(tick.t)}</text></g>)}
        <text className="rv-ax-label rv-ax-utc" x={narrow ? 0 : axis.x0 - 10} y={14} textAnchor={narrow ? 'start' : 'end'}>UTC</text>
        {axis.segments.filter(s => s.gap).map(s => {
          const cx = (s.x0 + s.x1) / 2
          let zig = ''
          for (let yy = AX; yy < H; yy += 8) zig += `${zig ? 'L' : 'M'}${cx - 3} ${yy}L${cx + 3} ${yy + 4}`
          const text = formatSpan(s.t1 - s.t0).replace(/ \d+ s$/, '')
          return <g key={s.t0} className="rv-break"><rect x={s.x0 + 2} y={AX} width={Math.max(0, s.x1 - s.x0 - 4)} height={H - AX} /><path d={zig} />
            {textWidth(text) < 60 && <text className="rv-ax-label" x={cx} y={14} textAnchor="middle">{text}</text>}</g>
        })}
        <rect className="rv-brush-area" x={axis.x0} y={AX} width={Math.max(0, axis.x1 - axis.x0)} height={H - AX} onPointerDown={brushStart} onPointerMove={brushMove} onPointerUp={brushEnd} onPointerCancel={() => setDrag(undefined)} />
        {rows.map((row, i) => <Lane key={row.agent.id} row={row} first={i === 0} axis={axis} story={story} width={W} selected={agent === row.agent.id} openEpisode={openEpisode} />)}
        {layout.placed.map(({ point, x, row }) => <g key={point.n} className="rv-pin" role="button" tabIndex={0} aria-label={`Turning point ${point.n}: ${point.title}`}
          onClick={() => openPoint(point)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPoint(point) } }}>
          <Badge point={point} x={x} y={layout.pinTop + 11 + row * 22} /></g>)}
        {shown && <><rect className="rv-dim" x={axis.x0} y={AX} width={Math.max(0, shown[0]! - axis.x0)} height={H - AX} /><rect className="rv-dim" x={shown[1]} y={AX} width={Math.max(0, axis.x1 - shown[1]!)} height={H - AX} />
          <rect className="rv-brush" x={shown[0]} y={AX} width={Math.max(2, shown[1]! - shown[0]!)} height={H - AX} rx={3} /></>}
      </svg>
      {rows.map(row => <button key={row.agent.id} type="button" className={`rv-lane-label${narrow ? ' narrow' : ''}`} aria-pressed={agent === row.agent.id}
        style={narrow ? { top: row.y } : { top: row.y + 6, width: layout.labelW - 8, paddingLeft: row.agent.depth * 12 }}
        onClick={() => onAgent(agent === row.agent.id ? undefined : row.agent.id)}>
        <b>{row.agent.label}</b>
        <span>{row.agent.status}{row.agent.steps ? ` · ${row.agent.steps.toLocaleString('en-US')} ${row.agent.steps === 1 ? 'step' : 'steps'}` : ''}{row.agent.errors ? <> · <span className="rv-error">{row.agent.errors} failed</span></> : ''}</span>
      </button>)}
    </div>
    <ul className="rv-legend">
      {kinds.map(kind => <li key={kind}><i style={{ background: `var(--rv-k-${kind})` }} />{KIND_NAME[kind]}</li>)}
      {summary.errors > 0 && <li><i className="rv-legend-error" />Failed step</li>}
      {gaps.length > 0 && <li><i className="rv-legend-gap" />Steps not captured</li>}
    </ul>
    {window && <Focus story={story} window={window} width={W} onClear={() => onWindow(undefined)} openStep={openStep} />}
  </section>
}

function Lane({ row, first, axis, story, width, selected, openEpisode }: { row: Row; first: boolean; axis: Axis; story: RecordStory; width: number; selected: boolean; openEpisode: (id: string) => void }) {
  const { agent } = row, X = axis.X
  const mid = row.tickY + row.tickH / 2
  const own = story.episodes.filter(episode => episode.node === agent.id)
  const from = X(agent.start ?? row.steps[0]?.at ?? story.summary.start), to = X(agent.end ?? Math.max(...row.steps.map(step => step.end), agent.start ?? story.summary.start))
  const never = story.turningPoints.find(point => point.node === agent.id && point.kind === 'never-started')
  return <g className={`rv-lane${selected ? ' selected' : ''}`}>
    {selected && <rect className="rv-lane-selected" x={0} y={row.y} width={width} height={row.h} />}
    {!first && <line className="rv-lane-rule" x1={0} x2={width} y1={row.y + 0.5} y2={row.y + 0.5} />}
    <line className="rv-alive" x1={from} x2={Math.max(from + 1, to)} y1={mid} y2={mid} />
    {agent.neverStarted && <g transform={`translate(${X(never?.at ?? agent.start ?? story.summary.start)} ${mid})`} className="rv-never"><circle r={6} /><path d="M-2.4 -2.4l4.8 4.8M2.4 -2.4l-4.8 4.8" /></g>}
    {story.gaps.filter(gap => gap.node === agent.id).map(gap => {
      const a = X(gap.start), b = X(gap.end), text = `not captured, ${formatSpan(gap.end - gap.start)}`
      return <g key={gap.start} className="rv-gap"><rect x={a} y={row.tickY + 2} width={Math.max(2, b - a)} height={row.tickH - 4} rx={3} fill="url(#rv-hatch)" />
        {b - a > textWidth(text) + 12 && <text x={(a + b) / 2} y={mid + 4} textAnchor="middle">{text}</text>}</g>
    })}
    {row.steps.map(step => {
      const sx = X(step.at), w = X(step.end) - sx, error = step.outcome === 'error'
      return <g key={step.id} className={`rv-step-mark k-${step.kind}${error ? ' error' : ''}`}>
        {w >= 3 && <rect x={sx} y={row.tickY + 5} width={w} height={row.tickH - 10} rx={2} />}
        <line x1={sx} x2={sx} y1={row.tickY + (error ? 0 : 3)} y2={row.tickY + row.tickH - (error ? 0 : 3)} />
        {error && <circle cx={sx} cy={row.tickY - 3} r={2.4} />}
      </g>
    })}
    {!row.empty && own.map((episode, i) => {
      const next = own[i + 1]
      const a = X(episode.start), b = Math.max(Math.min(X(episode.end), next ? X(next.start) - 1 : Infinity), a + 6)
      const w = b - a - 1.5, full = `${episode.n} ${episode.title}`
      const text = textWidth(full, true) + 10 <= w ? full : textWidth(String(episode.n), true) + 8 <= w ? String(episode.n) : ''
      return <g key={episode.id} className={`rv-band${i % 2 ? ' alt' : ''}${episode.notCaptured ? ' gap' : ''}`} role="button" tabIndex={0} aria-label={`Episode ${episode.n}: ${episode.title}`}
        onClick={() => openEpisode(episode.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEpisode(episode.id) } }}>
        <rect x={a} y={row.bandY} width={Math.max(4, w)} height={18} rx={3} />
        {text && <text x={a + 5} y={row.bandY + 13}>{text}</text>}
        {episode.errors > 0 && w > 14 && <circle className="rv-band-error" cx={a + w - 6} cy={row.bandY + 9} r={2.6} />}
      </g>
    })}
  </g>
}

/** The selected stretch drawn at full width: every step in it, named where the name fits. */
function Focus({ story, window, width, onClear, openStep }: { story: RecordStory; window: TimeWindow; width: number; onClear: () => void; openStep: (episode: string, step: string) => void }) {
  const [b0, b1] = window
  const narrow = width < 640
  const labelW = narrow ? 0 : 190, x0 = labelW + (narrow ? 4 : 16), x1 = width - (narrow ? 4 : 8)
  const k = (x1 - x0) / Math.max(1, b1 - b0), X = (t: number) => x0 + (t - b0) * k
  const inside = story.steps.filter(step => step.end >= b0 && step.at <= b1)
  const lanes = story.summary.agents.filter(agent => inside.some(step => step.node === agent.id))
  const errors = inside.filter(step => step.outcome === 'error').length
  const stepMs = FOCUS_STEPS.find(v => v * k >= (narrow ? 60 : 80)) ?? 3_600_000
  const episodeOf = (step: RecordStep) => story.episodes.find(episode => episode.steps.includes(step))
  let y = 22
  const drawn = lanes.map(agent => {
    const labelH = narrow ? 18 : 0, top = y, tickY = y + labelH + 4, th = 24
    y += labelH + th + 14
    return { agent, top, tickY, th, steps: inside.filter(step => step.node === agent.id) }
  })
  const H = y
  const ticks: number[] = []
  for (let t = Math.ceil(b0 / stepMs) * stepMs; t <= b1; t += stepMs) { const x = X(t); if (x >= x0 + 24 && x <= x1 - 24) ticks.push(t) }
  return <div className="rv-focus">
    <div className="rv-focus-head">
      <b>{clockUtc(b0, true)}–{clockUtc(b1, true)} UTC</b>
      <span>{formatSpan(b1 - b0)} · {inside.length.toLocaleString('en-US')} {inside.length === 1 ? 'step' : 'steps'}{errors ? <> · <span className="rv-error">{errors} failed</span></> : ''}</span>
      <button type="button" className="rv-button rv-small" onClick={onClear}>Whole run</button>
    </div>
    {drawn.length > 0 && <div className="rv-spine" style={{ height: H }}>
      <svg width={width} height={H} aria-label="Steps in the selected stretch" role="img">
        {ticks.map(t => <g key={t}><line className="rv-ax-line" x1={X(t)} x2={X(t)} y1={18} y2={H} /><text className="rv-ax-label" x={X(t)} y={13} textAnchor="middle">{clockUtc(t, stepMs < MIN)}</text></g>)}
        {drawn.map(lane => {
          let lastEnd = -Infinity
          return <g key={lane.agent.id}>{lane.steps.map((step, i) => {
            const sx = Math.max(x0, X(step.at)), ex = Math.min(x1, X(step.end)), w = ex - sx
            const next = lane.steps.slice(i + 1).find(other => X(other.at) > sx + 1)
            const room = Math.max(w >= 3 ? w - 8 : 0, Math.min(x1, next ? X(next.at) : x1) - sx - 10)
            const name = step.object && textWidth(`${step.action} ${step.object}`) <= room ? `${step.action} ${step.object}` : step.action
            const text = sx > lastEnd && textWidth(name) <= room ? name : ''
            if (text) lastEnd = sx + 5 + textWidth(text)
            const episode = episodeOf(step)
            return <g key={step.id} className={`rv-focus-step k-${step.kind}${step.outcome === 'error' ? ' error' : ''}`} role="button" tabIndex={0} aria-label={`${clockUtc(step.at, true)} ${step.action}${step.object ? ` ${step.object}` : ''}`}
              onClick={() => episode && openStep(episode.id, step.id)} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && episode) { event.preventDefault(); openStep(episode.id, step.id) } }}>
              {w >= 3 && <rect x={sx} y={lane.tickY + 4} width={w} height={lane.th - 8} rx={2} />}
              <line x1={sx} x2={sx} y1={lane.tickY} y2={lane.tickY + lane.th} />
              <rect className="rv-hit" x={sx - 4} y={lane.tickY} width={Math.max(8, w + 4)} height={lane.th} />
              {text && <text x={sx + 5} y={lane.tickY + lane.th / 2 + 4}>{text}</text>}
            </g>
          })}</g>
        })}
      </svg>
      {drawn.map(lane => <div key={lane.agent.id} className={`rv-lane-label static${narrow ? ' narrow' : ''}`} style={narrow ? { top: lane.top } : { top: lane.tickY + 2, width: labelW - 8, paddingLeft: lane.agent.depth * 12 }}><b>{lane.agent.label}</b></div>)}
    </div>}
  </div>
}
