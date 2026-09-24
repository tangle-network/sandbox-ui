import type { Meta, StoryObj } from '@storybook/react'
import { InfoPanel } from '../../dashboard/info-panel'

const meta = {
  title: 'Dashboard/InfoPanel',
  component: InfoPanel,
  args: { label: 'Sandbox insight', title: 'Your workspace is ready', description: 'The development environment has all dependencies installed.', className: 'w-full max-w-[420px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof InfoPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {}
