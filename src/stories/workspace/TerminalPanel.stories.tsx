import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { TerminalPanel } from '../../workspace/terminal-panel'

const lines = [
  { id: 'command', type: 'command' as const, text: 'pnpm test:unit' },
  { id: 'output', type: 'stdout' as const, text: '48 tests passed' },
  { id: 'warning', type: 'stderr' as const, text: 'One snapshot needs review.' },
  { id: 'done', type: 'system' as const, text: 'Process exited with code 0' },
]

function LiveTerminal() {
  const [collapsed, setCollapsed] = useState(false)
  const [visible, setVisible] = useState(true)
  return visible
    ? <TerminalPanel lines={lines} isCollapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onClose={() => setVisible(false)} maxHeight={260} className="w-full max-w-[700px] rounded-lg border border-border" />
    : <button className="rounded border border-border px-3 py-2 text-sm" onClick={() => setVisible(true)}>Open terminal output</button>
}

const meta = {
  title: 'Workspace/TerminalPanel',
  component: TerminalPanel,
  args: { lines },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TerminalPanel>

export default meta
type Story = StoryObj<typeof meta>

export const CommandOutput: Story = { render: () => <LiveTerminal /> }
export const Empty: Story = { args: { lines: [], className: 'w-full max-w-[700px]' } }
