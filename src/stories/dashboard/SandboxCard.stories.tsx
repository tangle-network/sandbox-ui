import type { Meta, StoryObj } from '@storybook/react'
import { SandboxCard, NewSandboxCard } from '../../dashboard/sandbox-card'

const meta: Meta<typeof SandboxCard> = {
  title: 'Dashboard/SandboxCard',
  component: SandboxCard,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  args: {
    onOpenIDE: (id) => console.log('open IDE', id),
    onOpenTerminal: (id) => console.log('open terminal', id),
    onResume: (id) => console.log('resume', id),
    onWake: (id) => console.log('wake', id),
    onRestore: (id) => console.log('restore', id),
    onStop: (id) => console.log('stop', id),
    onFork: (id) => console.log('fork', id),
    onUsage: (id) => console.log('usage', id),
    onHealth: (id) => console.log('health', id),
    onDelete: (id) => console.log('delete', id),
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
      name: 'api-gateway',
      nodeId: 'iad1 · node-7f3a9c',
      status: 'running',
      vcpu: 2,
      cpuPercent: 34,
      ramUsed: 1.8,
      ramTotal: 8,
      diskUsed: 6.4,
      diskTotal: 40,
      uptime: '3d 4h',
    },
  },
}

export const RunningHighCPU: Story = {
  name: 'Running — saturated',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-2',
      name: 'etl-worker',
      nodeId: 'iad1 · node-2b8e14',
      status: 'running',
      vcpu: 4,
      cpuPercent: 93,
      ramUsed: 14.6,
      ramTotal: 16,
      diskUsed: 71,
      diskTotal: 80,
      uptime: '11h 26m',
    },
  },
}

export const CustomImage: Story = {
  name: 'Running — custom image',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-8',
      name: 'inference-svc',
      nodeId: 'sfo1 · node-91dd02',
      status: 'running',
      customImage: 'ghcr.io/acme/inference:sha-1a2b3c',
      vcpu: 8,
      cpuPercent: 58,
      ramUsed: 22.1,
      ramTotal: 32,
      diskUsed: 38,
      diskTotal: 100,
      uptime: '6d 13h',
    },
  },
}

export const Hibernating: Story = {
  name: 'Hibernating',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-3',
      name: 'staging-shell',
      nodeId: 'sfo1 · node-4c7b2e',
      status: 'hibernating',
      vcpu: 1,
      ramTotal: 4,
      diskUsed: 2.1,
      diskTotal: 20,
    },
  },
}

export const Provisioning: Story = {
  name: 'Provisioning',
  render: (args) => <div className="w-80"><SandboxCard {...args} /></div>,
  args: {
    sandbox: {
      id: 'sb-4',
      name: 'pr-2184-preview',
      nodeId: 'iad1 · node-pending',
      status: 'provisioning',
      vcpu: 2,
      ramTotal: 8,
      diskTotal: 40,
      provisioningMessage: 'Allocating volume…',
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
      nodeId: 'fra1 · node-8a1f60',
      status: 'stopped',
      vcpu: 4,
      ramTotal: 16,
      diskUsed: 12,
      diskTotal: 64,
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
      nodeId: 'fra1 · node-d04e7a',
      status: 'failed',
      vcpu: 8,
      ramTotal: 64,
      diskTotal: 200,
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
      nodeId: 'fra1 · node-archived',
      status: 'archived',
      vcpu: 2,
      ramTotal: 8,
      diskTotal: 40,
      archivedAt: 'Archived Jan 15, 2026 · 14:32 UTC',
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
        sandbox={{ id: 'a', name: 'api-gateway', nodeId: 'iad1 · node-7f3a9c', status: 'running', vcpu: 2, cpuPercent: 34, ramUsed: 1.8, ramTotal: 8, diskUsed: 6.4, diskTotal: 40, uptime: '3d 4h' }}
        onOpenIDE={() => {}} onOpenTerminal={() => {}} onStop={() => {}} onFork={() => {}} onUsage={() => {}} onHealth={() => {}}
      />
      <SandboxCard
        sandbox={{ id: 'b', name: 'pr-2184-preview', nodeId: 'iad1 · node-pending', status: 'provisioning', vcpu: 2, ramTotal: 8, diskTotal: 40, provisioningMessage: 'Allocating volume…', provisioningPercent: 40 }}
      />
      <SandboxCard
        sandbox={{ id: 'c', name: 'staging-shell', nodeId: 'sfo1 · node-4c7b2e', status: 'hibernating', vcpu: 1, ramTotal: 4, diskUsed: 2.1, diskTotal: 20 }}
        onWake={() => {}} onFork={() => {}}
      />
      <SandboxCard
        sandbox={{ id: 'd', name: 'batch-processor', nodeId: 'fra1 · node-8a1f60', status: 'stopped', vcpu: 4, ramTotal: 16, diskUsed: 12, diskTotal: 64 }}
        onResume={() => {}} onFork={() => {}}
      />
      <SandboxCard
        sandbox={{ id: 'e', name: 'gpu-runner', nodeId: 'fra1 · node-d04e7a', status: 'failed', vcpu: 8, ramTotal: 64, diskTotal: 200 }}
        onResume={() => {}}
      />
      <NewSandboxCard onClick={() => {}} />
    </div>
  ),
}
