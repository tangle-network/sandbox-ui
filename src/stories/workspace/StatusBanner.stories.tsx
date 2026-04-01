import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { StatusBanner } from '../../workspace/status-banner'

const meta: Meta<typeof StatusBanner> = {
  title: 'Workspace/StatusBanner',
  component: StatusBanner,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  args: {
    message: 'Session is initializing',
  },
}

export default meta
type Story = StoryObj<typeof StatusBanner>

export const Provisioning: Story = {
  args: {
    type: 'provisioning',
    message: 'Provisioning sandbox environment…',
    detail: 'This usually takes 10–30 seconds',
  },
}

export const Connecting: Story = {
  args: {
    type: 'connecting',
    message: 'Connecting to agent runtime',
    detail: 'WebSocket handshake in progress',
  },
}

export const Error: Story = {
  args: {
    type: 'error',
    message: 'Connection failed',
    detail: 'ECONNREFUSED — agent container unreachable',
  },
}

export const ErrorDismissible: Story = {
  name: 'Error — Dismissible',
  render: (args) => {
    const [visible, setVisible] = useState(true)
    if (!visible) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Banner dismissed.{' '}
          <button
            onClick={() => setVisible(true)}
            className="underline hover:text-foreground"
          >
            Show again
          </button>
        </div>
      )
    }
    return <StatusBanner {...args} onDismiss={() => setVisible(false)} />
  },
  args: {
    type: 'error',
    message: 'Connection lost — retrying in 5s',
    detail: 'Last connected 2 minutes ago',
  },
}

export const Success: Story = {
  args: {
    type: 'success',
    message: 'Sandbox environment ready',
    detail: 'Connected via WebSocket',
  },
}

export const Info: Story = {
  args: {
    type: 'info',
    message: 'Your session will pause after 30 minutes of inactivity',
  },
}

export const InfoDismissible: Story = {
  name: 'Info — Dismissible',
  render: (args) => {
    const [visible, setVisible] = useState(true)
    if (!visible) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Banner dismissed.{' '}
          <button
            onClick={() => setVisible(true)}
            className="underline hover:text-foreground"
          >
            Show again
          </button>
        </div>
      )
    }
    return <StatusBanner {...args} onDismiss={() => setVisible(false)} />
  },
  args: {
    type: 'info',
    message: 'Your session will pause after 30 minutes of inactivity',
  },
}

export const AllTypes: Story = {
  name: 'All Types',
  render: () => (
    <div className="flex flex-col gap-px">
      <StatusBanner type="provisioning" message="Provisioning sandbox environment…" detail="This usually takes 10–30 seconds" />
      <StatusBanner type="connecting" message="Connecting to agent runtime" detail="WebSocket handshake in progress" />
      <StatusBanner type="error" message="Connection failed" detail="ECONNREFUSED — agent container unreachable" />
      <StatusBanner type="success" message="Sandbox environment ready" detail="Connected via WebSocket" />
      <StatusBanner type="info" message="Your session will pause after 30 minutes of inactivity" />
    </div>
  ),
}
