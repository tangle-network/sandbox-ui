import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { BackendSelector } from '../../dashboard/backend-selector'

const meta: Meta<typeof BackendSelector> = {
  title: 'Dashboard/BackendSelector',
  component: BackendSelector,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-[360px] p-6 rounded-xl bg-[var(--bg-section)]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof BackendSelector>

const llmBackends = [
  { type: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Fast & capable' },
  { type: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Most capable' },
  { type: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Fastest' },
  { type: 'gpt-4o', label: 'GPT-4o', description: 'OpenAI flagship' },
  { type: 'gemini-2-flash', label: 'Gemini 2.0 Flash', description: 'Google' },
]

export const Default: Story = {
  name: 'Default',
  render: () => {
    const [selected, setSelected] = useState('claude-sonnet-4-6')
    return (
      <BackendSelector
        backends={llmBackends}
        selected={selected}
        onChange={setSelected}
        label="Model"
      />
    )
  },
}

export const NoSelection: Story = {
  name: 'No selection',
  render: () => {
    const [selected, setSelected] = useState('')
    return (
      <BackendSelector
        backends={llmBackends}
        selected={selected}
        onChange={setSelected}
        label="Model"
        placeholder="Choose a model"
      />
    )
  },
}

export const CustomLabel: Story = {
  name: 'Custom label',
  render: () => {
    const [selected, setSelected] = useState('claude-opus-4-6')
    return (
      <BackendSelector
        backends={llmBackends}
        selected={selected}
        onChange={setSelected}
        label="Active backend"
      />
    )
  },
}
