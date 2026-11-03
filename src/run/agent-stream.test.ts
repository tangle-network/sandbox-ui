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
