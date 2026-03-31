import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { StatusBar } from '../../workspace/status-bar'

const meta: Meta<typeof StatusBar> = {
  title: 'Workspace/StatusBar',
  component: StatusBar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  args: {
    modelLabel: 'claude-sonnet-4-5',
    credits: 48320,
  },
}

export default meta
type Story = StoryObj<typeof StatusBar>

export const Connected: Story = {
  args: {
    status: 'connected',
    modelLabel: 'claude-sonnet-4-5',
    credits: 48320,
  },
}

export const Connecting: Story = {
  args: {
    status: 'connecting',
    modelLabel: 'claude-sonnet-4-5',
    credits: 48320,
  },
}

export const Disconnected: Story = {
  args: {
    status: 'disconnected',
    modelLabel: 'claude-sonnet-4-5',
    credits: 0,
  },
}

export const Provisioning: Story = {
  args: {
    status: 'provisioning',
    modelLabel: 'claude-opus-4',
    credits: 12000,
  },
}

export const WithContextBadges: Story = {
  args: {
    status: 'connected',
    modelLabel: 'claude-sonnet-4-5',
    credits: 31000,
    contextBadges: [
      { id: 'repo', label: 'sandbox-ui', count: 142 },
      { id: 'docs', label: 'README.md' },
      { id: 'schema', label: 'schema.ts', count: 8 },
    ],
  },
}

export const WithRemovableBadges: Story = {
  render: (args) => {
    const [badges, setBadges] = useState(args.contextBadges ?? [])
    return (
      <StatusBar
        {...args}
        contextBadges={badges}
        onRemoveBadge={(id) => setBadges((prev) => prev.filter((b) => b.id !== id))}
      />
    )
  },
  args: {
    status: 'connected',
    modelLabel: 'claude-sonnet-4-5',
    credits: 31000,
    contextBadges: [
      { id: 'repo', label: 'sandbox-ui', count: 142 },
      { id: 'docs', label: 'README.md' },
      { id: 'schema', label: 'schema.ts', count: 8 },
    ],
  },
}

export const AllStates: Story = {
  name: 'All States',
  render: () => (
    <div className="flex flex-col">
      <StatusBar status="connected" modelLabel="claude-sonnet-4-5" credits={48320} />
      <StatusBar status="connecting" modelLabel="claude-sonnet-4-5" credits={48320} />
      <StatusBar status="provisioning" modelLabel="claude-opus-4" credits={12000} />
      <StatusBar status="disconnected" modelLabel="claude-sonnet-4-5" credits={0} />
      <StatusBar
        status="connected"
        modelLabel="claude-sonnet-4-5"
        credits={31000}
        contextBadges={[
          { id: 'repo', label: 'sandbox-ui', count: 142 },
          { id: 'docs', label: 'README.md' },
        ]}
      />
    </div>
  ),
}
