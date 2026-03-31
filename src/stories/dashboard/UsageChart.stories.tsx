import type { Meta, StoryObj } from '@storybook/react'
import { UsageChart } from '../../dashboard/usage-chart'

function makeDays(count: number, seed: number): { date: string; value: number }[] {
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push({
      date: d.toISOString().slice(0, 10),
      value: Math.floor(Math.abs(Math.sin(i * seed + seed) * 10000) + seed * 50),
    })
  }
  return out
}

const meta: Meta<typeof UsageChart> = {
  title: 'Dashboard/UsageChart',
  component: UsageChart,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-[560px] p-4 rounded-xl bg-[var(--bg-section)]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof UsageChart>

export const AgentRuns: Story = {
  name: 'Agent Runs',
  args: { data: makeDays(14, 3), title: 'Agent Runs', unit: 'runs' },
}

export const SandboxHours: Story = {
  name: 'Sandbox Hours',
  args: { data: makeDays(14, 7), title: 'Sandbox Hours', unit: 'hrs' },
}

export const ShortSeries: Story = {
  name: '7-day series',
  args: { data: makeDays(7, 2), title: 'API Calls', unit: 'calls' },
}

export const Flat: Story = {
  name: 'Flat / no activity',
  args: {
    data: makeDays(14, 0).map((d) => ({ ...d, value: 0 })),
    title: 'Agent Runs',
    unit: 'runs',
  },
}

export const Spike: Story = {
  name: 'Single spike',
  args: {
    data: makeDays(14, 1).map((d, i) => ({ ...d, value: i === 10 ? 95000 : 200 })),
    title: 'Requests',
    unit: 'req',
  },
}
