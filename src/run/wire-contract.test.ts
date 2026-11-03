import { expect, test } from 'vitest'
import type { TopSnapshot } from '@tangle-network/agent-runtime/tui'
import type { Snapshot } from './wire'

/**
 * The wire drift guard (#523): the producer's exported TopSnapshot must stay assignable to this viewer's display
 * subset, so an agent-runtime contract change — a field the viewer reads removed, renamed or retyped — fails this
 * check instead of surfacing as undefined fields in a production viewer. (It already caught two: pursuit nodes
 * never carried model/backend, and diagnostics is readonly.) Producer additions the viewer ignores stay legal.
 * agent-runtime is a devDependency precisely for this check; consumers of sandbox-ui never see it.
 */
test('the viewer wire contract stays assignable from agent-runtime\'s exported TopSnapshot', () => {
  const asViewer: Snapshot = null as unknown as TopSnapshot
  expect(asViewer).toBeNull()
})
