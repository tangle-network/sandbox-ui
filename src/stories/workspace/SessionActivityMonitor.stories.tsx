import type { Meta, StoryObj } from '@storybook/react'
import { useEffect } from 'react'
import { SessionActivityMonitor } from '../../workspace/session-activity-monitor'
import {
  activeSessionsAtom,
  type ActiveSessionRecord,
} from '../../stores/active-sessions-store'

const meta: Meta<typeof SessionActivityMonitor> = {
  title: 'Workspace/SessionActivityMonitor',
  component: SessionActivityMonitor,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-72 p-4">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionActivityMonitor>

const NOW = Date.now()

function makeRecord(overrides: Partial<ActiveSessionRecord> & { sessionId: string }): ActiveSessionRecord {
  return {
    projectId: 'proj-1',
    projectLabel: 'Blueprint Agent',
    title: 'Untitled Session',
    href: '/sessions/' + overrides.sessionId,
    registeredAt: NOW - 60_000,
    lastActivityAt: NOW - 5_000,
    lastEventAt: NOW - 5_000,
    status: 'idle',
    isRunning: false,
    isForeground: false,
    needsAttention: false,
    connectionState: 'connected',
    reconnectState: 'idle',
    transportMode: 'websocket',
    lastError: null,
    ...overrides,
  }
}

const RUNNING_SESSIONS: Record<string, ActiveSessionRecord> = {
  's-001': makeRecord({
    sessionId: 's-001',
    title: 'File ingestion pipeline',
    status: 'running',
    isRunning: true,
    isForeground: true,
  }),
  's-002': makeRecord({
    sessionId: 's-002',
    title: 'Schema validation sweep',
    status: 'running',
    isRunning: true,
    isForeground: false,
  }),
  's-003': makeRecord({
    sessionId: 's-003',
    title: 'Background indexer',
    projectId: 'proj-2',
    projectLabel: 'GTM Agent',
    status: 'running',
    isRunning: true,
    isForeground: false,
  }),
}

function WithSessions({ sessions, children }: { sessions: Record<string, ActiveSessionRecord>; children: React.ReactNode }) {
  useEffect(() => {
    activeSessionsAtom.set({ sessions, lastUpdatedAt: Date.now() })
    return () => activeSessionsAtom.set({ sessions: {}, lastUpdatedAt: Date.now() })
  }, [sessions])
  return <>{children}</>
}

export const Default: Story = {
  render: () => (
    <WithSessions sessions={RUNNING_SESSIONS}>
      <SessionActivityMonitor sessionsById={RUNNING_SESSIONS} />
    </WithSessions>
  ),
}

export const Empty: Story = {
  render: () => (
    <WithSessions sessions={{}}>
      <SessionActivityMonitor />
    </WithSessions>
  ),
}

export const Compact: Story = {
  render: () => (
    <WithSessions sessions={RUNNING_SESSIONS}>
      <SessionActivityMonitor compact sessionsById={RUNNING_SESSIONS} />
    </WithSessions>
  ),
}
