import type { Meta, StoryObj } from '@storybook/react'
import { ActivityFeed } from '../../dashboard/activity-feed'

const now = Date.now()
const items = [
  { id: 'snapshot', title: 'Snapshot created', detail: 'pre-migration-checkpoint', timestamp: now - 12 * 60_000 },
  { id: 'commit', title: 'Changes committed', detail: 'fix: retry the worker after timeout', timestamp: now - 2 * 60 * 60_000 },
  { id: 'start', title: 'Sandbox started', detail: 'Node 22 · 4 vCPU', timestamp: now - 26 * 60 * 60_000 },
]

const meta = {
  title: 'Dashboard/ActivityFeed',
  component: ActivityFeed,
  args: { items, className: 'w-full max-w-[440px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ActivityFeed>

export default meta
type Story = StoryObj<typeof meta>

export const RecentEvents: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { items: [], emptyLabel: 'No activity in this sandbox yet' } }
