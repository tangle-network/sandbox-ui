import type { Meta, StoryObj } from '@storybook/react'
import { SeatMark } from '../../dashboard/seat-mark'

const meta = {
  title: 'Dashboard/SeatMark',
  component: SeatMark,
  args: { harness: 'opencode', model: 'zai/glm-5.3', effort: 'xhigh' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SeatMark>

export default meta
type Story = StoryObj<typeof meta>

export const StandaloneAndInPill: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4">
      <SeatMark {...args} />
      <SeatMark harness="claude-code" model="anthropic/claude-sonnet-4-5" size="md" />
      <span className="inline-flex rounded-full border border-border bg-background py-1"><SeatMark {...args} /></span>
    </div>
  ),
}
