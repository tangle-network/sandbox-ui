import type { Meta, StoryObj } from '@storybook/react'
import { DiffView } from '../../workbench/diff-view'

const baseline = 'export function retryDelay(attempt: number) {\n  return 1000 * attempt\n}\n'
const current = 'export function retryDelay(attempt: number) {\n  return Math.min(1000 * 2 ** attempt, 30_000)\n}\n'

const meta = {
  title: 'Workbench/DiffView',
  component: DiffView,
  args: { filename: 'src/runtime/retry.ts', baseline, current, className: 'h-[420px] w-full max-w-[840px] rounded-lg border border-border' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DiffView>

export default meta
type Story = StoryObj<typeof meta>

export const ChangedLine: Story = {}
export const NoChanges: Story = { args: { current: baseline } }
