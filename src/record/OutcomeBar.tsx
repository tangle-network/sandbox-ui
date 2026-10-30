import { OUTCOME_ORDER } from '@tangle-network/charts'
import type { ResearchRun } from '@drewstone/agent-record/report'
const WORD: Record<string, string> = { ok: 'ok', quota: 'quota', lost: 'lost', 'rate-limit': 'rate limit', oom: 'OOM', refused: 'refused', aborted: 'aborted', other: 'other' }
const STATE: Record<string, 'ok' | 'failed' | 'other'> = { ok: 'ok', quota: 'failed', lost: 'failed', 'rate-limit': 'failed', oom: 'failed', refused: 'failed', aborted: 'other', other: 'other' }
const COLOR = { ok: 'var(--ar-c-ok)', failed: 'var(--ar-c-fail)', other: 'var(--ar-c-neutral)' } as const
export function OutcomeLegend({ outcomes }: { outcomes: string[] }) {
  return <ul className="outcome-legend" aria-label="Attempt outcomes">{(['ok', 'failed', 'other'] as const).filter(state => outcomes.some(outcome => STATE[outcome] === state)).map(state => <li key={state}><i style={{ background: COLOR[state] }} />{state}</li>)}</ul>
}
/** Recorded agent-hours share the report's axis; absent hours remain unknown. */
export function OutcomeBar({ row, max }: { row: Pick<ResearchRun, 'hoursByOutcome' | 'triesByOutcome'>; max: number }) {
  const by = row.hoursByOutcome, total = Object.values(by ?? {}).reduce((sum, value) => sum + value, 0)
  if (!total) return <span className="faint" title="attempts not recorded">—</span>
  const parts = OUTCOME_ORDER.filter(outcome => (by?.[outcome] ?? 0) > 0)
  const label = (outcome: string) => `${WORD[outcome]} ${by![outcome]!.toFixed(2)} h${row.triesByOutcome?.[outcome] !== undefined ? ` · ${row.triesByOutcome[outcome]} tries` : ''}`
  return <span className="outcome-bar" title={parts.map(label).join('\n')}><span className="outcome-track" style={{ width: `${Math.max(2, total / max * 100)}%` }}>
    {parts.map(outcome => <i key={outcome} data-outcome={outcome} title={label(outcome)} style={{ flexGrow: by![outcome]!, background: COLOR[STATE[outcome] ?? 'other'] }} />)}
  </span><span className="outcome-total num">{total.toFixed(1)} h</span></span>
}
