import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import {
  HARNESS_REASONING_OPTIONS,
  ReasoningLevelPicker,
  type ReasoningLevel,
  type ReasoningLevelPickerProps,
} from '../../chat/reasoning-level-picker'

function LivePicker(args: ReasoningLevelPickerProps) {
  const [value, setValue] = useState<ReasoningLevel>(args.value)
  return <div className="p-6"><ReasoningLevelPicker {...args} value={value} onChange={setValue} /></div>
}

const meta = {
  title: 'Chat/ReasoningLevelPicker',
  component: ReasoningLevelPicker,
  args: { value: 'auto', onChange: () => {} },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ReasoningLevelPicker>

export default meta
type Story = StoryObj<typeof meta>

export const FullLadder: Story = { render: (args) => <LivePicker {...args} /> }
export const ModelLimited: Story = { args: { available: ['none', 'low', 'medium', 'high'] }, render: (args) => <LivePicker {...args} /> }
export const BinaryThinking: Story = { args: { options: HARNESS_REASONING_OPTIONS['kimi-code'], available: ['none', 'high'] }, render: (args) => <LivePicker {...args} /> }
export const Disabled: Story = { args: { disabled: true, value: 'medium' }, render: (args) => <LivePicker {...args} /> }
