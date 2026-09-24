import type { Meta, StoryObj } from '@storybook/react'
import { RuntimePane } from '../../workspace/runtime-pane'

const terminal = { lines: [
  { id: '1', text: 'pnpm dev --host 0.0.0.0', type: 'command' as const },
  { id: '2', text: 'Ready on port 3000', type: 'stdout' as const },
] }

const meta = {
  title: 'Workspace/RuntimePane',
  component: RuntimePane,
  args: { title: 'api-gateway', subtitle: 'Node 22 · 4 vCPU', terminal, className: 'h-[550px] w-full max-w-[1050px] rounded-lg border border-border' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RuntimePane>

export default meta
type Story = StoryObj<typeof meta>

export const RunningSession: Story = {}
export const WaitingForOutput: Story = { args: { terminal: undefined } }
