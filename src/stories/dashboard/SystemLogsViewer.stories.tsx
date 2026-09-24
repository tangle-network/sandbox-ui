import { useLayoutEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { SystemLogsViewer } from '../../dashboard/system-logs'

const logs = [
  { timestamp: '2026-09-23T12:00:02Z', level: 'INFO', scope: 'runtime', message: 'Sandbox started on port 3000' },
  { timestamp: '2026-09-23T12:00:04Z', level: 'WARN', scope: 'worker', message: 'Retrying after upstream timeout' },
  { timestamp: '2026-09-23T12:00:05Z', level: 'INFO', scope: 'worker', message: 'Request completed on retry' },
]

function MockLogs({ unavailable = false }: { unavailable?: boolean }) {
  useLayoutEffect(() => {
    const original = window.fetch
    window.fetch = (input, init) => {
      if (String(input).endsWith('/__storybook_logs__/logs')) {
        return Promise.resolve(unavailable
          ? new Response('Unavailable', { status: 503 })
          : new Response(JSON.stringify({ count: logs.length, logs }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      return original(input, init)
    }
    return () => { window.fetch = original }
  }, [unavailable])
  return <SystemLogsViewer apiUrl="/__storybook_logs__" token="storybook-demo" className="h-[450px] w-full max-w-[850px] rounded-lg border border-border" />
}

const meta = {
  title: 'Dashboard/SystemLogsViewer',
  component: SystemLogsViewer,
  args: { apiUrl: '/__storybook_logs__', token: 'storybook-demo' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SystemLogsViewer>

export default meta
type Story = StoryObj<typeof meta>

export const LiveLogBuffer: Story = { render: () => <MockLogs /> }
export const SidecarUnavailable: Story = { render: () => <MockLogs unavailable /> }
