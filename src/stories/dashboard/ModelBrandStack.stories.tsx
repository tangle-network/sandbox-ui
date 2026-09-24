import type { Meta, StoryObj } from '@storybook/react'
import { ModelBrandStack, modelBrandFor } from '../../lib/model-brand'

const identity = modelBrandFor('anthropic/claude-sonnet-4-5')!

const meta = {
  title: 'Dashboard/ModelBrandStack',
  component: ModelBrandStack,
  args: { identity, size: 'md' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ModelBrandStack>

export default meta
type Story = StoryObj<typeof meta>

export const LabAndHost: Story = {
  render: () => <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"><ModelBrandStack identity={identity} size="md" /><span>Claude Sonnet on Anthropic</span></div>,
}
export const InCompactRows: Story = {
  render: () => <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"><ModelBrandStack identity={modelBrandFor('openrouter/openai/gpt-5')!} size="sm" /><span>GPT via OpenRouter</span></div>,
}
