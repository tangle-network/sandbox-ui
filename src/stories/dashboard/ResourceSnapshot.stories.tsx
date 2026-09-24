import type { Meta, StoryObj } from '@storybook/react'
import { ResourceSnapshot } from '../../dashboard/resource-snapshot'

const items = [
  { id: 'cpu', label: 'CPU', value: 58, max: 100, unit: '%' },
  { id: 'memory', label: 'Memory', value: 2.8, max: 8, unit: ' GB' },
  { id: 'disk', label: 'Disk', value: 12, max: 40, unit: ' GB' },
]

const meta = {
  title: 'Dashboard/ResourceSnapshot',
  component: ResourceSnapshot,
  args: { items, className: 'w-full max-w-[430px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ResourceSnapshot>

export default meta
type Story = StoryObj<typeof meta>

export const RunningSandbox: Story = {}
export const Loading: Story = { args: { loading: true } }
export const MetricsUnavailable: Story = { args: { error: 'Metrics are unavailable while the sandbox reconnects.' } }
