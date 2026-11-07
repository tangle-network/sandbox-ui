/**
 * The TopSnapshot wire contract this viewer renders, as produced by Runtime's top-web SSE
 * (`/api/top/events` frames). Runtime owns the shape: this file names the display subset the viewer
 * reads, and `wire-contract.test.ts` checks it bidirectionally against the exported
 * `@tangle-network/agent-runtime/tui` type at dev time, so producer drift fails our tests instead of
 * production (sandbox-ui#523; agent-runtime stays a devDependency — consumers are unaffected).
 */
export type Snapshot = {
  pursuit?: { nodes: readonly { id: string; runId: string; parentId?: string; label?: string; runtime?: string; status?: string; settledAt?: number; timing?: { startedAt: number; settledAt?: number } }[] }
  root: string
  generatedAt: number
  completeness: string
  diagnostics: readonly { source: string; reason: string }[]
  supervisors: {
    id: string
    status: string
    outcome?: { kind: 'winner' } | { kind: 'no-winner' | 'failed'; reason: string }
    lastRoute?: { kind: 'stopped'; reason: string; code?: string } | { kind: 'unrouted'; detail: string }
    task?: string
    startedAt?: string
    completedAt?: string
    reason?: string
    lastActivityAt?: number
    medianEventGapMs?: number
    driverSpend?: { usd: number; usdKnown?: boolean }
    totals?: { tokensKnown?: boolean; tokensInput?: number; tokensOutput?: number }
    workers: {
      materialization?: { status: string; backend?: string; model?: { status: string; id?: string } }
      id: string
      parent?: string
      label: string
      status: string
      startedAt?: string
      endedAt?: string
      runtime?: string
      verdict?: string
      reason?: string
      liveTail?: string[]
      lastActivityAt?: number
      medianEventGapMs?: number
      spend?: { usd: number; usdKnown?: boolean }
      metered?: { usd: number; usdKnown?: boolean }
    }[]
  }[]
}
