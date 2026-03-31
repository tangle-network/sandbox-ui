import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { SessionSidebar, type SessionSidebarItem, type SessionSidebarFilter } from '../../workspace/session-sidebar'

const meta: Meta<typeof SessionSidebar> = {
  title: 'Workspace/SessionSidebar',
  component: SessionSidebar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="flex h-screen" data-sandbox-ui="true" data-sandbox-theme="operator">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionSidebar>

const NOW = Date.now()

const SESSIONS: SessionSidebarItem[] = [
  {
    id: 'sess-001',
    title: 'File ingestion pipeline',
    subtitle: 'Processing 142 files from /data/uploads',
    status: 'running',
    updatedAt: new Date(NOW - 12_000),
    isPinned: true,
    badges: [{ id: 'b1', label: 'Running', tone: 'accent' }],
  },
  {
    id: 'sess-002',
    title: 'Schema validation sweep',
    subtitle: 'Validating JSON schemas against registry',
    status: 'running',
    updatedAt: new Date(NOW - 45_000),
  },
  {
    id: 'sess-003',
    title: 'Report generation',
    subtitle: 'Generating Q1 performance summary',
    status: 'idle',
    updatedAt: new Date(NOW - 5 * 60_000),
    badges: [{ id: 'b2', label: 'Done', tone: 'success' }],
  },
  {
    id: 'sess-004',
    title: 'Auth token refresh',
    subtitle: 'OAuth2 token exchange with identity provider',
    status: 'error',
    updatedAt: new Date(NOW - 8 * 60_000),
    badges: [{ id: 'b3', label: 'Error', tone: 'danger' }],
  },
  {
    id: 'sess-005',
    title: 'Dependency graph analysis',
    subtitle: 'Mapping transitive dependencies across 3 workspaces',
    status: 'idle',
    updatedAt: new Date(NOW - 20 * 60_000),
  },
  {
    id: 'sess-006',
    title: 'API smoke test suite',
    subtitle: '24 of 30 endpoints passing',
    status: 'attention-needed',
    updatedAt: new Date(NOW - 35 * 60_000),
    badges: [{ id: 'b4', label: 'Needs attention', tone: 'warning' }],
  },
  {
    id: 'sess-007',
    title: 'Code review assistant',
    subtitle: 'Reviewing PR #419 — feat/composable-layout',
    status: 'idle',
    updatedAt: new Date(NOW - 2 * 60 * 60_000),
  },
]

const FILTERS: SessionSidebarFilter[] = [
  {
    id: 'all',
    label: 'All',
    matches: () => true,
  },
  {
    id: 'active',
    label: 'Active',
    matches: (item) => item.status === 'running' || item.status === 'attention-needed',
  },
  {
    id: 'error',
    label: 'Errors',
    matches: (item) => item.status === 'error',
  },
]

export const Default: Story = {
  args: {
    title: 'Blueprint Agent',
    subtitle: 'tangle.network',
    items: SESSIONS,
    currentItemId: 'sess-001',
    createLabel: 'New Session',
    onCreate: () => alert('Create session'),
  },
}

export const WithFilters: Story = {
  name: 'With Filters',
  args: {
    title: 'Blueprint Agent',
    subtitle: 'tangle.network',
    items: SESSIONS,
    currentItemId: 'sess-001',
    filters: FILTERS,
    defaultFilterId: 'all',
  },
}

export const WithLinks: Story = {
  name: 'With Bottom Links',
  args: {
    title: 'Blueprint Agent',
    subtitle: 'tangle.network',
    items: SESSIONS,
    currentItemId: 'sess-001',
    links: [
      { id: 'vault', label: 'File Vault', icon: 'vault' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
      { id: 'back', label: 'All Projects', icon: 'back' },
    ],
  },
}

export const Interactive: Story = {
  render: (args) => {
    const [currentId, setCurrentId] = useState<string>('sess-001')
    return (
      <SessionSidebar
        {...args}
        currentItemId={currentId}
        onSelectItem={(item) => setCurrentId(item.id)}
      />
    )
  },
  args: {
    title: 'Blueprint Agent',
    subtitle: 'tangle.network',
    items: SESSIONS,
    filters: FILTERS,
    links: [
      { id: 'vault', label: 'File Vault', icon: 'vault' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ],
    createLabel: 'New Session',
  },
}

export const Empty: Story = {
  args: {
    title: 'Blueprint Agent',
    subtitle: 'tangle.network',
    items: [],
    emptyMessage: 'No sessions yet. Start a conversation to begin.',
    createLabel: 'New Session',
  },
}

export const NoSearch: Story = {
  name: 'Search Disabled',
  args: {
    title: 'Blueprint Agent',
    items: SESSIONS.slice(0, 3),
    currentItemId: 'sess-002',
    enableSearch: false,
  },
}
