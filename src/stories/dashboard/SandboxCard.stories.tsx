import type { Meta, StoryObj } from '@storybook/react'
import { SandboxCard, NewSandboxCard } from '../../dashboard/sandbox-card'

const meta: Meta<typeof SandboxCard> = {
  title: 'Dashboard/SandboxCard',
  component: SandboxCard,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  args: {
    onOpenIDE: (id) => console.log('open IDE', id),
    onOpenTerminal: (id) => console.log('open terminal', id),
    onWake: (id) => console.log('wake', id),
    onRestore: (id) => console.log('restore', id),
  },
}

export default meta
type Story = StoryObj<typeof SandboxCard>

export const Running: Story = {
  name: 'Running',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-1',
      name: 'node-worker-01',
      nodeId: 'node://us-east-1/sb-1a2b3c',
      status: 'running',
      image: 'node:20-alpine',
      cpuPercent: 34,
      ramUsed: 1.8,
      ramTotal: 8,
    },
  },
}

export const RunningHighCPU: Story = {
  name: 'Running — high CPU',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-2',
      name: 'python-compute',
      nodeId: 'node://us-east-1/sb-4d5e6f',
      status: 'running',
      image: 'python:3.12-slim',
      cpuPercent: 91,
      ramUsed: 6.2,
      ramTotal: 8,
    },
  },
}

export const Hibernating: Story = {
  name: 'Hibernating',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-3',
      name: 'ubuntu-dev',
      nodeId: 'node://us-west-2/sb-7g8h9i',
      status: 'hibernating',
      image: 'ubuntu:22.04',
      cpuPercent: 0,
      ramUsed: 0,
      ramTotal: 4,
    },
  },
}

export const Provisioning: Story = {
  name: 'Provisioning',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-4',
      name: 'new-sandbox',
      status: 'provisioning',
      provisioningMessage: 'Pulling image layers...',
      provisioningPercent: 62,
    },
  },
}

export const Stopped: Story = {
  name: 'Stopped',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-5',
      name: 'batch-processor',
      nodeId: 'node://eu-west-1/sb-j1k2l3',
      status: 'stopped',
      image: 'python:3.11',
      cpuPercent: 0,
      ramUsed: 0,
      ramTotal: 16,
    },
  },
}

export const Failed: Story = {
  name: 'Failed',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-6',
      name: 'gpu-runner',
      status: 'failed',
      image: 'nvidia/cuda:12.0',
      cpuPercent: 0,
      ramUsed: 0,
      ramTotal: 64,
    },
  },
}

export const Archived: Story = {
  name: 'Archived',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-7',
      name: 'legacy-worker',
      status: 'archived',
      archivedAt: 'Archived on Jan 15, 2025 at 14:32 UTC',
    },
  },
}

export const NewCard: Story = {
  name: 'New Sandbox Card',
  render: () => (
    <div className="w-80">
      <NewSandboxCard onClick={() => console.log('new sandbox')} />
    </div>
  ),
}

export const Grid: Story = {
  name: 'Card grid (all states)',
  parameters: { layout: 'padded', backgrounds: { default: 'dark' } },
  render: () => (
    <div className="grid grid-cols-3 gap-4" style={{ width: 960 }}>
      <SandboxCard
        sandbox={{ id: 'a', name: 'node-worker-01', status: 'running', image: 'node:20', cpuPercent: 34, ramUsed: 2, ramTotal: 8 }}
        onOpenIDE={() => {}} onOpenTerminal={() => {}}
      />
      <SandboxCard
        sandbox={{ id: 'b', name: 'python-task', status: 'provisioning', provisioningMessage: 'Pulling image…', provisioningPercent: 40 }}
      />
      <SandboxCard
        sandbox={{ id: 'c', name: 'ubuntu-dev', status: 'hibernating', image: 'ubuntu:22', cpuPercent: 0, ramUsed: 0, ramTotal: 4 }}
        onWake={() => {}}
      />
      <SandboxCard
        sandbox={{ id: 'd', name: 'batch-processor', status: 'stopped', cpuPercent: 0, ramUsed: 0, ramTotal: 16 }}
      />
      <SandboxCard
        sandbox={{ id: 'e', name: 'gpu-runner', status: 'failed', cpuPercent: 0, ramUsed: 0, ramTotal: 64 }}
      />
      <NewSandboxCard onClick={() => {}} />
    </div>
  ),
}
