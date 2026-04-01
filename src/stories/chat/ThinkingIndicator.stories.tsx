import type { Meta, StoryObj } from '@storybook/react'
import { ThinkingIndicator } from '../../chat/thinking-indicator'

const meta: Meta<typeof ThinkingIndicator> = {
  title: 'Chat/ThinkingIndicator',
  component: ThinkingIndicator,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-[var(--bg-root)] p-8">
        <div className="mx-auto max-w-2xl">
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ThinkingIndicator>

/**
 * Animated state — the component starts at elapsed=0 and ticks up.
 * In Storybook you'll see the bouncing dots and text update live.
 */
export const Default: Story = {}

/**
 * Show it inline below a chat message to simulate the agent responding.
 */
export const InContext: Story = {
  render: () => (
    <div className="space-y-1">
      <div className="rounded-[calc(var(--radius-xl)+2px)] border border-border bg-card px-4 py-4 text-sm text-foreground">
        Let me analyze the rate limiter implementation and check the Redis pipeline for atomicity issues.
      </div>
      <ThinkingIndicator />
    </div>
  ),
}

/**
 * Multiple indicators to show staggered animation timing.
 */
export const Stacked: Story = {
  render: () => (
    <div className="space-y-2">
      <ThinkingIndicator />
      <ThinkingIndicator className="opacity-60" />
      <ThinkingIndicator className="opacity-30" />
    </div>
  ),
}
