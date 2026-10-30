import { useMemo, useState } from 'react'
import type { RecordEvent, RunRecord } from '@drewstone/agent-record/record'
import { timeSeries, type TimeSeriesRow } from '@tangle-network/charts'
import { FigureView } from '@tangle-network/charts/react'
import { fmt, interval, ms, toolKey, type RecordIndex } from '../run/record/model.js'
interface PlotProps {
  index: RecordIndex<RunRecord>
  cutoff: number
  inspect: (event: RecordEvent, source?: boolean) => void
  navigate: (direction: number) => void
}
export const categories = [
  'coordination',
  'compute',
  'computation',
  'verification',
  'literature',
  'writing',
  'setup',
  'infrastructure',
  'waiting',
  'reasoning',
  'lifecycle',
  'other',
] as const
const activityCategories: Record<string, string> = {
  'edit files': 'writing', build: 'compute', 'gate/test': 'verification', 'git/PR write': 'coordination',
  'prod/remote ops': 'infrastructure', 'workspace setup': 'setup', messaging: 'coordination',
  'read messages': 'coordination', 'query status': 'lifecycle', 'analysis script': 'reasoning',
  'read code/files': 'literature', 'memory search': 'literature', subagents: 'coordination',
}
export const categoryClass = (category: string) =>
  activityCategories[category] ?? (categories.includes(category as (typeof categories)[number]) ? category : 'other')
export type Metric = 'cumulative' | 'response' | 'tool-time'
export type Axis = 'time' | 'order'
const channels = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
type Channel = (typeof channels)[number]
const channelLabels: Record<Channel, string> = {
  input: 'Input',
  output: 'Output',
  cacheRead: 'Cache read',
  cacheWrite: 'Cache write',
}
interface Point {
  event: RecordEvent
  at: number
  values: Partial<Record<Channel, number>>
  elapsed?: number
  /** A usage-window marker (execution-to-date at metering time), not a per-response measurement. */
  scoped?: boolean
}

export function RecordUsage({
  index,
  cutoff,
  inspect,
  navigate,
  actor,
  metric,
  axis,
}: PlotProps & { actor: string; metric: Metric; axis: Axis }) {
  // Channels the reader toggled off; the scale follows the visible channels so one
  // dominant channel (a huge cache-read total) cannot flatten every other curve.
  const [hidden, setHidden] = useState<ReadonlySet<Channel>>(() => new Set())
  const visible = useMemo(() => channels.filter((channel) => !hidden.has(channel)), [hidden])
  const measured = useMemo(() => {
    const points: Point[] = []
    const totals: Record<Channel, number> = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    }
    const counts: Record<Channel, number> = {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    }
    let incomplete = 0,
      ambiguous = 0,
      invalidTiming = 0
    const chronological = index.byActor.get(actor) ?? []
    // A source's recorded order can differ from wall-clock order.
    const order = index.recordedOrder
    const events =
      axis === 'order'
        ? [...chronological].sort(
            (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
          )
        : chronological
    for (const event of events) {
      if (ms(event.at) > cutoff) continue
      if (metric === 'tool-time') {
        if (event.detail.toolCallId === undefined) continue
        const calls =
          index.calls.get(toolKey(event.node, event.detail.toolCallId)) ?? []
        if (calls.length !== 1 || index.results.get(toolKey(event.node, event.detail.toolCallId))?.length !== 1) {
          ambiguous++
          continue
        }
        const call = calls[0]!.event
        if (ms(call.at) > cutoff || ms(event.at) < ms(call.at)) {
          invalidTiming++
          continue
        }
        points.push({
          event,
          at: ms(event.at),
          values: {},
          elapsed: (ms(event.at) - ms(call.at)) / 1000,
        })
        continue
      }
      const usage = event.detail.usage
      if (!usage) continue
      // Scoped usage (metered windows, execution totals) is cumulative by
      // meaning: it charts only in the cumulative metric, never as a
      // per-response value, and keeps its own secondary series.
      const scoped = event.detail.usageScope !== undefined
      if (metric !== 'cumulative' && scoped) continue
      if (channels.some((channel) => usage[channel] === undefined)) incomplete++
      const values: Partial<Record<Channel, number>> = {}
      for (const channel of channels) {
        const value = usage[channel]
        if (value === undefined) continue
        if (!scoped) {
          totals[channel] += value
          counts[channel]++
        }
        values[channel] = metric === 'cumulative' ? (scoped ? value : totals[channel]) : value
      }
      if (Object.keys(values).length)
        points.push({ event, at: ms(event.at), values, scoped })
    }
    return { points, totals, counts, incomplete, ambiguous, invalidTiming }
  }, [index, cutoff, actor, metric, axis])
  const { points, totals, counts } = measured
  const plotted = useMemo(() => {
    const sourceEvents: RecordEvent[] = []
    const position = new Map(points.map((point, i) => [point, i + 1]))
    const series = (id: string, label: string, colorIndex: number, scoped: boolean, channel?: Channel): TimeSeriesRow => ({
      id, label, colorIndex, secondary: scoped,
      points: points.filter(point => !!point.scoped === scoped).map(point => {
        const y = metric === 'tool-time' ? point.elapsed! : point.values[channel!] ?? null
        if (y !== null) sourceEvents.push(point.event)
        return { x: axis === 'time' ? point.at : position.get(point)!, y,
          ...(point.event.detail.isError ? { marker: 'triangle' as const } : {}),
          annotation: [point.event.label, point.event.detail.isError ? 'The tool reported an error.' : '', scoped ? 'Metered window or execution-to-date; not a per-response measurement.' : ''].filter(Boolean).join(' ') || undefined }
      }),
    })
    const rows = metric === 'tool-time' ? [series('tool-return', 'Observed call → result interval', 0, false)]
      : visible.flatMap(channel => [series(channel, channelLabels[channel], channels.indexOf(channel), false, channel),
        ...(points.some(point => point.scoped) ? [series(`scoped:${channel}`, `${channelLabels[channel]} · metered windows`, channels.indexOf(channel), true, channel)] : [])])
    return { rows, sourceEvents }
  }, [points, visible, metric, axis])
  const figure = useMemo(() => (width: number) => timeSeries(plotted.rows, {
    id: 'record-usage', width, selectable: true,
    x: { label: axis === 'time' ? 'Recorded elapsed time' : 'Recorded event order', domain: axis === 'time' ? [index.start, Math.max(index.start + 1, cutoff)] : [1, Math.max(2, points.length)] },
    y: { label: metric === 'tool-time' ? 'Observed call → result interval' : metric === 'cumulative' ? 'Cumulative measured tokens' : 'Measured tokens per response', unit: metric === 'tool-time' ? 'seconds' : 'tokens', domain: [0, Math.max(1, ...plotted.rows.flatMap(row => row.points.map(point => point.y ?? 0)))] },
    formatX: axis === 'time' ? value => interval(value - index.start) : String,
    formatY: metric === 'tool-time' ? value => value.toFixed(3) : fmt,
  }), [plotted, axis, metric, index.start, cutoff, points.length])
  return (
    <>
      <div data-tokens onKeyDown={event => {
        if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && event.target instanceof Element && event.target.closest('svg')) { event.preventDefault(); navigate(event.key === 'ArrowLeft' ? -1 : 1) }
      }}>
        {points.length ? metric !== 'tool-time' && !visible.length ? <p className="chat-empty">All token channels are hidden. Select a channel to show its recorded values.</p> : <FigureView figure={figure} onPointSelect={point => { const event = plotted.sourceEvents[point]; if (event) inspect(event, true) }} /> : <p className="chat-empty">{metric === 'tool-time' ? 'No matched tool timing at this time' : 'No measured usage at this time'}</p>}
      </div>
      {metric !== 'tool-time' && (
        <div className="usage-legend">
          {channels.map((channel) => (
            <button
              key={channel}
              type="button"
              className="legend-toggle"
              aria-pressed={!hidden.has(channel)}
              title={hidden.has(channel) ? `Show ${channelLabels[channel]}` : `Hide ${channelLabels[channel]}`}
              onClick={() =>
                setHidden((current) => {
                  const next = new Set(current)
                  if (next.has(channel)) next.delete(channel)
                  else next.add(channel)
                  return next
                })
              }
            >
              {channelLabels[channel]}
            </button>
          ))}
          {points.some((point) => point.scoped) && (
            <span className="scoped-key">metered windows · execution-to-date</span>
          )}
        </div>
      )}
      <p className="small" data-token-caption>
        {metric === 'tool-time'
          ? `Observed tool return time, not model latency.${measured.ambiguous || measured.invalidTiming ? ' Unmatched, ambiguous and out-of-order results are omitted.' : ''}`
          : `${channels.map((channel) => `${channelLabels[channel]} ${counts[channel] ? fmt(totals[channel]) : 'unknown'}`).join(' · ')}.${measured.incomplete ? ' Some responses lack counters, so these totals are lower bounds.' : ''} Context repeated across responses is counted each time; tokens are not billed cost.`}
      </p>
    </>
  )
}
