import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { SandboxTable } from '../../dashboard/sandbox-table'
import type { SandboxCardData } from '../../dashboard/sandbox-card'

const sandboxes: SandboxCardData[] = [
  { id: 'api', name: 'api-gateway', status: 'running', nodeId: 'iad1 · node-7f3a9c', vcpu: 4, cpuPercent: 34, ramUsed: 2.2, ramTotal: 8, diskUsed: 12, diskTotal: 40, uptime: '3d 4h' },
  { id: 'preview', name: 'pr-2184-preview', status: 'provisioning', nodeId: 'iad1 · node-pending', vcpu: 2, ramTotal: 4, diskTotal: 20, provisioningPercent: 64 },
  { id: 'staging', name: 'staging-shell', status: 'hibernating', nodeId: 'sfo1 · node-4c7b2e', vcpu: 2, ramTotal: 4, diskUsed: 3.1, diskTotal: 20 },
]

function LiveTable() {
  const [rows, setRows] = useState(sandboxes)
  return <div className="w-full max-w-[1100px] overflow-x-auto"><SandboxTable sandboxes={rows} onResume={(id) => setRows((current) => current.map((row) => row.id === id ? { ...row, status: 'running' } : row))} onStop={(id) => setRows((current) => current.map((row) => row.id === id ? { ...row, status: 'stopped' } : row))} onDelete={(id) => setRows((current) => current.filter((row) => row.id !== id))} onOpenIDE={() => {}} onOpenTerminal={() => {}} /></div>
}

const meta = {
  title: 'Dashboard/SandboxTable',
  component: SandboxTable,
  args: { sandboxes },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SandboxTable>

export default meta
type Story = StoryObj<typeof meta>

export const MixedStatuses: Story = { render: () => <LiveTable /> }
export const Empty: Story = { args: { sandboxes: [] } }
