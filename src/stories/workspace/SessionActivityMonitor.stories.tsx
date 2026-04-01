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
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="w-80 p-4 bg-[var(--bg-card)] min-h-screen" data-sandbox-ui="true" >
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
    title: 'Schema validation run',
    status: 'running',
    isRunning: true,
  }),
}

const MIXED_SESSIONS: Record<string, ActiveSessionRecord> = {
  's-001': makeRecord({
    sessionId: 's-001',
    title: 'File ingestion pipeline',
    projectId: 'proj-1',
    projectLabel: 'Blueprint Agent',
    status: 'running',
    isRunning: true,
    isForeground: true,
  }),
  's-003': makeRecord({
    sessionId: 's-003',
    title: 'Report generation',
    projectId: 'proj-2',
    projectLabel: 'Data Extractor',
    status: 'running',
    isRunning: true,
  }),
  's-004': makeRecord({
    sessionId: 's-004',
    title: 'Auth token refresh',
    projectId: 'proj-2',
    projectLabel: 'Data Extractor',
    status: 'error',
    isRunning: false,
    lastError: 'Token exchange failed',
    reconnectState: 'failed',
    connectionState: 'error',
  }),
}

// Decorator that seeds the nanostores atom before rendering
function withSessions(sessions: Record<string, ActiveSessionRecord>) {
  return function Seeder({ children }: { children: React.ReactNode }) {
    useEffect(() => {
      activeSessionsAtom.set({ sessions, lastUpdatedAt: Date.now() })
      return () => activeSessionsAtom.set({ sessions: {}, lastUpdatedAt: Date.now() })
    }, [])
    return <>{children}</>
  }
}

export const Empty: Story = {
  args: {
    emptyMessage: 'No active sessions',
  },
  decorators: [
    (Story) => {
      useEffect(() => {
        activeSessionsAtom.set({ sessions: {}, lastUpdatedAt: Date.now() })
      }, [])
      return <Story />
    },
  ],
}

export const SingleProjectRunning: Story = {
  name: 'Single Project — Running',
  args: {
    sessionsById: RUNNING_SESSIONS,
  },
  decorators: [
    (Story) => {
      const Seeder = withSessions(RUNNING_SESSIONS)
      return (
        <Seeder>
          <Story />
        </Seeder>
      )
    },
  ],
}

export const MultiProject: Story = {
  name: 'Multi-Project',
  args: {
    sessionsById: MIXED_SESSIONS,
  },
  decorators: [
    (Story) => {
      const Seeder = withSessions(MIXED_SESSIONS)
      return (
        <Seeder>
          <Story />
        </Seeder>
      )
    },
  ],
}

export const Compact: Story = {
  args: {
    compact: true,
    sessionsById: RUNNING_SESSIONS,
  },
  decorators: [
    (Story) => {
      const Seeder = withSessions(RUNNING_SESSIONS)
      return (
        <Seeder>
          <Story />
        </Seeder>
      )
    },
  ],
}
