import type { Meta, StoryObj } from '@storybook/react'
import { Box, Clock, Search, Terminal, Zap } from 'lucide-react'
import { EmptyState } from '../primitives/empty-state'

const meta: Meta<typeof EmptyState> = {
  title: 'Primitives/EmptyState',
  component: EmptyState,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const NoSessions: Story = {
  name: 'No Sessions',
  args: {
    icon: <Terminal className="h-6 w-6" />,
    title: 'No active sessions',
    description:
      'Provision a sandbox to run code in an isolated container. Sessions spin up in under a second.',
    action: (
      <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
        New session
      </button>
    ),
  },
}

export const NoResults: Story = {
  name: 'No Search Results',
  args: {
    icon: <Search className="h-6 w-6" />,
    title: 'No sessions found',
    description: 'No sessions match your current filters. Try adjusting the status or date range.',
    action: (
      <button className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
        Clear filters
      </button>
    ),
  },
}

export const NoLogs: Story = {
  name: 'No Logs',
  args: {
    icon: <Clock className="h-6 w-6" />,
    title: 'No logs yet',
    description: 'Logs will appear here once the session starts executing commands.',
  },
}

export const NoSnapshots: Story = {
  name: 'No Snapshots',
  args: {
    icon: <Box className="h-6 w-6" />,
    title: 'No snapshots',
    description:
      'Snapshots capture the full filesystem state of a session. Create one to resume from a known point.',
    action: (
      <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
        Create snapshot
      </button>
    ),
  },
}

export const BillingIdle: Story = {
  name: 'Idle — No Usage',
  args: {
    icon: <Zap className="h-6 w-6" />,
    title: 'No usage this period',
    description: 'You have not run any sandbox sessions in the current billing cycle.',
  },
}

export const TitleOnly: Story = {
  name: 'Title Only',
  args: {
    title: 'Nothing here yet',
  },
}
