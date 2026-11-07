import { describe, expect, it } from 'vitest'
import { foldAgentRows, type AgentStreamRow } from './agent-stream'

/** The incremental-fold invariant (F8): appending a page onto folded entries must equal folding the whole window.
 *  useAgentStream folds each `after` page onto the entries already folded, so a long streaming turn costs its
 *  deltas; this property is what makes that indistinguishable from the old re-fold-everything behavior. */
const at = (seconds: number) => new Date(Date.UTC(2026, 10, 2, 12, 0, seconds)).toISOString()
const row = (seq: number, event: AgentStreamRow['event']): AgentStreamRow => ({ seq, at: at(seq), attempt: 1, event })

describe('foldAgentRows incremental folding', () => {
  it('appending a page equals folding the merged window', () => {
    const first = [row(0, { kind: 'user', text: 'Retain the witness.' }), row(1, { kind: 'text_delta', text: 'Working ' })]
    const second = [row(2, { kind: 'text_delta', text: 'on it.' }), row(3, { kind: 'tool_call', toolCallId: 't1', toolName: 'bash', args: { command: 'make' } })]
    const third = [row(4, { kind: 'tool_result', toolCallId: 't1', result: 'ok' }), row(5, { kind: 'text_delta', text: ' Done.' })]
    const incremental = third.reduce((entries, page) => foldAgentRows(entries, [page]), second.reduce((entries, page) => foldAgentRows(entries, [page]), foldAgentRows([], first)))
    const whole = foldAgentRows([], [...first, ...second, ...third])
    expect(incremental).toEqual(whole)
  })

  it('pairs a tool result from a later page with its call from an earlier one', () => {
    const entries = foldAgentRows(foldAgentRows([], [row(0, { kind: 'tool_call', toolCallId: 't9', toolName: 'read', args: {} })]), [row(1, { kind: 'tool_result', toolCallId: 't9', result: 'contents' })])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.kind).toBe('tool')
    if (entries[0]?.kind === 'tool') {
      expect(entries[0].call.status).toBe('success')
      expect(entries[0].call.output).toBe('contents')
    }
  })

  it('merges text deltas across a page boundary within one scope', () => {
    const entries = foldAgentRows(foldAgentRows([], [row(0, { kind: 'text_delta', text: 'first ' })]), [row(1, { kind: 'text_delta', text: 'second' })])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.kind).toBe('message')
    if (entries[0]?.kind === 'message') expect(entries[0].content).toBe('first second')
  })
})

/** Real native rows, captured from a live child agent's transcript on the wall (canary-fork-20261103a:s0): before the
 *  adapter these were dropped by the fold and the agent rendered nothing. */
describe('foldAgentRows native rows', () => {
  const raw = (id: string, data: unknown, at: string) => ({ seq: Number(id), at, attempt: 1, id, type: 'raw', data })

  it('folds an opencode raw text part as an assistant delta', () => {
    const rows = [raw('376', { type: 'raw', backend: 'opencode', event: { type: 'text', timestamp: 1793687372972, sessionID: 'ses_1', part: { id: 'prt_1', type: 'text', text: '1. **Method**: Sieve of Eratosthenes.' } } }, at(1))]
    const entries = foldAgentRows([], rows as never)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.kind).toBe('message')
    if (entries[0]?.kind === 'message') expect(entries[0].content).toBe('1. **Method**: Sieve of Eratosthenes.')
  })

  it('folds the SDK message.part.updated text and reasoning parts', () => {
    const rows = [
      raw('10', { type: 'message.part.updated', part: { id: 'p1', type: 'reasoning', text: 'Consider the bound.' } }, at(1)),
      raw('11', { type: 'message.part.updated', part: { id: 'p2', type: 'text', text: 'The answer is 1229.' } }, at(2)),
    ]
    const entries = foldAgentRows([], rows as never)
    expect(entries.map(entry => entry.kind)).toEqual(['reasoning', 'message'])
    if (entries[1]?.kind === 'message') expect(entries[1].content).toBe('The answer is 1229.')
  })

  it('folds a native user message as the commission bubble', () => {
    const rows = [raw('5', { type: 'message.updated', properties: { info: { id: 'm1', role: 'user', content: 'Count the primes below 10000 and prove the count.' } } }, at(0))]
    const entries = foldAgentRows([], rows as never)
    expect(entries).toHaveLength(1)
    if (entries[0]?.kind === 'message') {
      expect(entries[0].role).toBe('user')
      expect(entries[0].content).toContain('primes below 10000')
    }
  })

  it('merges consecutive native text parts of one message and ignores harness framing rows', () => {
    const rows = [
      raw('376', { type: 'raw', backend: 'opencode', event: { type: 'text', timestamp: 1, part: { id: 'p1', type: 'text', text: 'The sieve ' } } }, at(1)),
      raw('377', { type: 'status', data: { status: 'running' } }, at(2)),
      raw('378', { type: 'raw', backend: 'opencode', event: { type: 'text', timestamp: 2, part: { id: 'p1', type: 'text', text: 'terminates.' } } }, at(3)),
    ]
    const entries = foldAgentRows([], rows as never)
    expect(entries).toHaveLength(1)
    if (entries[0]?.kind === 'message') expect(entries[0].content).toBe('The sieve terminates.')
  })
})
