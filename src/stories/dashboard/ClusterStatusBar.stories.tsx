import type { Meta, StoryObj } from '@storybook/react'
import { ClusterStatusBar } from '../../dashboard/cluster-status-bar'

const meta: Meta<typeof ClusterStatusBar> = {
  title: 'Dashboard/ClusterStatusBar',
  component: ClusterStatusBar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  args: {
    items: [
      { icon: 'memory', label: 'Nodes', value: '12 / 16' },
      { icon: 'bolt', label: 'Active Jobs', value: '3', valueClass: 'text-green-400' },
      { icon: 'database', label: 'Storage', value: '1.2 TB / 4 TB' },
    ],
    latency: '18ms',
  },
  decorators: [
    (Story) => (
      <div className="relative h-48 bg-[var(--depth-1)]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ClusterStatusBar>

export const Default: Story = {
  name: 'Default',
}

export const WithWarning: Story = {
  name: 'With warning value',
  args: {
    items: [
      { icon: 'memory', label: 'Nodes', value: '16 / 16', valueClass: 'text-yellow-400' },
      { icon: 'bolt', label: 'Active Jobs', value: '12', valueClass: 'text-red-400' },
      { icon: 'database', label: 'Storage', value: '3.9 TB / 4 TB', valueClass: 'text-red-400' },
    ],
    latency: '142ms',
  },
}

export const HighLatency: Story = {
  name: 'High latency indicator',
  args: {
    latency: '380ms',
    items: [
      { icon: 'memory', label: 'Nodes', value: '8 / 16', valueClass: 'text-yellow-400' },
      { icon: 'bolt', label: 'Active Jobs', value: '1' },
    ],
  },
}

export const NoLatency: Story = {
  name: 'No latency indicator',
  args: {
    latency: undefined,
    items: [
      { icon: 'memory', label: 'Nodes', value: '6 / 16' },
      { icon: 'bolt', label: 'Jobs', value: '0' },
    ],
  },
}

export const ManyItems: Story = {
  name: 'Many status items',
  args: {
    items: [
      { icon: 'memory', label: 'Nodes', value: '10 / 16' },
      { icon: 'bolt', label: 'Jobs', value: '5' },
      { icon: 'database', label: 'Storage', value: '2.1 TB' },
      { icon: 'network_check', label: 'Bandwidth', value: '420 Mbps' },
      { icon: 'thermostat', label: 'Temp', value: '62°C', valueClass: 'text-yellow-400' },
      { icon: 'schedule', label: 'Uptime', value: '14d 6h' },
    ],
    latency: '22ms',
  },
}
