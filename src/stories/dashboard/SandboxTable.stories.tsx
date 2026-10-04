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
  return <div className="w-full max-w-[1100px]"><SandboxTable sandboxes={rows} onResume={(id) => setRows((current) => current.map((row) => row.id === id ? { ...row, status: 'running' } : row))} onStop={(id) => setRows((current) => current.map((row) => row.id === id ? { ...row, status: 'stopped' } : row))} onDelete={(id) => setRows((current) => current.filter((row) => row.id !== id))} onOpenIDE={() => {}} onOpenTerminal={() => {}} /></div>
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

const longName = 'recoveredworkspace20261001' + 'longsessionname'.repeat(18)
const longRows: SandboxCardData[] = Array.from({ length: 50 }, (_, index) => ({
  id: `sandbox-${index}`,
  name: index === 0 ? longName : `workspace-${index}`,
  nodeId: index === 0 ? `iad1 · recoverednode${'0123456789abcdef'.repeat(3)}` : `iad1 · node-${index}`,
  status: index === 1 ? 'stopped' : index === 2 ? 'provisioning' : 'running',
  provisioningMessage: index === 2 ? 'Allocatingnodes'.repeat(10) : undefined,
  image: 'NixOS 25.05',
  cpuPercent: 34,
  ramUsed: 2.2,
  ramTotal: 8,
}))

function LongNameTable({ withScope = false }: { withScope?: boolean }) {
  const rows = withScope
    ? longRows.map((row, index) => index === 0 ? {
        ...row,
        image: 'nixosimage'.repeat(12),
        team: { id: 'platform', name: 'platformengineering'.repeat(8), role: 'admin' as const },
      } : row)
    : longRows
  return (
    <div className="w-full max-w-[1086px]">
      <SandboxTable
        sandboxes={rows}
        pageSize={50}
        onOpenIDE={() => {}}
        onOpenTerminal={() => {}}
        onSSH={() => {}}
        onResume={() => {}}
        onMore={() => {}}
        onDelete={() => {}}
      />
    </div>
  )
}

export const LongNames: Story = { render: () => <LongNameTable /> }
export const LongNamesWithScope: Story = { render: () => <LongNameTable withScope /> }

const statusRows: SandboxCardData[] = (['running', 'failed', 'provisioning', 'creating', 'stopped', 'hibernating', 'archived', 'expired'] as const).map((status, index) => ({
  id: status,
  name: `${status}-workspace`,
  status,
  nodeId: `iad1 · node-${index + 1}`,
  image: 'NixOS 25.05',
  cpuPercent: 34,
  ramUsed: 2.2,
  ramTotal: 8,
}))

export const StatusContrast: Story = {
  render: () => (
    <div className="w-full max-w-[1086px]">
      <SandboxTable sandboxes={statusRows} onOpenIDE={() => {}} onResume={() => {}} />
    </div>
  ),
}
