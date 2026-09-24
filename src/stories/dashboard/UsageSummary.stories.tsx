import type { Meta, StoryObj } from '@storybook/react'
import { UsageSummary } from '../../dashboard/usage-summary'

const meta = {
  title: 'Dashboard/UsageSummary',
  component: UsageSummary,
  args: { data: { computeHours: 82.5, activeSessions: 3, messagesSent: 1249, estimatedCost: 37.62 }, className: 'w-full max-w-[1040px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof UsageSummary>

export default meta
type Story = StoryObj<typeof meta>

export const CurrentPeriod: Story = {}
export const Loading: Story = { args: { data: null, loading: true } }
