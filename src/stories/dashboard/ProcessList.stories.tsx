import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ProcessList, type ProcessInfo } from '../../dashboard/process-list'

function LiveProcesses() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([
    { pid: 221, command: 'pnpm dev --host 0.0.0.0', running: true, startedAt: new Date(Date.now() - 18 * 60_000).toISOString() },
    { pid: 198, command: 'pnpm test:unit', running: false, exitCode: 0, startedAt: new Date(Date.now() - 25 * 60_000).toISOString() },
  ])
  return <ProcessList processes={processes} onSpawn={(command) => setProcesses((current) => [...current, { pid: 300 + current.length, command, running: true, startedAt: new Date().toISOString() }])} onKill={(pid) => setProcesses((current) => current.map((process) => process.pid === pid ? { ...process, running: false, exitCode: 143 } : process))} className="w-full max-w-[700px]" />
}

const meta = {
  title: 'Dashboard/ProcessList',
  component: ProcessList,
  args: { processes: [], onSpawn: () => {}, onKill: () => {} },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ProcessList>

export const RunningAndExited: StoryObj<typeof meta> = { render: () => <LiveProcesses /> }
export const Loading: StoryObj<typeof meta> = { args: { loading: true, className: 'w-full max-w-[700px]' } }
export default meta
