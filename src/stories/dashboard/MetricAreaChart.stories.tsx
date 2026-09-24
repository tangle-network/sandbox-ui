import type { Meta, StoryObj } from '@storybook/react'
import { MetricAreaChart } from '../../dashboard/metric-area-chart'

const now = Date.now()
const values = [23, 26, 32, 29, 36, 48, 42, null, 51, 46, 54, 62, 59]
const points = values.map((value, index) => ({ at: now - (values.length - index) * 60_000, value }))

const meta = {
  title: 'Dashboard/MetricAreaChart',
  component: MetricAreaChart,
  args: { points, label: 'CPU', formatValue: (value: number) => `${Math.round(value)}%`, maxValue: 100, detail: 'of 4 vCPU', className: 'w-full max-w-[430px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MetricAreaChart>

export default meta
type Story = StoryObj<typeof meta>

export const RecentSamples: Story = {}
export const GapInTelemetry: Story = { args: { tone: 'warning', label: 'Memory pressure' } }
export const WaitingForSamples: Story = { args: { points: [], emptyState: 'Metrics will appear when the sandbox starts.' } }
