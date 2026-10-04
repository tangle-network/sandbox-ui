import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { FolderOpen, LayoutDashboard, Plug, Terminal } from 'lucide-react'
import { DashboardLayout } from '../../dashboard/dashboard-layout'
import { DashboardPageHeader, SandboxPageShell } from '../../dashboard/page-layout'

const navItems = [
  { id: 'overview', label: 'Overview', href: '#overview', icon: LayoutDashboard },
  { id: 'workspaces', label: 'Workspaces', href: '#workspaces', icon: FolderOpen },
  { id: 'integrations', label: 'Integrations', href: '#integrations', icon: Plug },
  { id: 'terminal', label: 'Terminal', href: '#terminal', icon: Terminal },
]

const meta = {
  title: 'Dashboard/DashboardLayout',
  component: DashboardLayout,
  args: { navItems, activeNavId: 'overview', user: { name: 'Ava Chen', email: 'ava@example.com', tier: 'Pro' }, onNewSandbox: () => {}, children: <div className="p-8"><h1 className="text-2xl font-semibold">Overview</h1><p className="mt-2 text-muted-foreground">Three sandboxes are available.</p></div> },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DashboardLayout>

export default meta
type Story = StoryObj<typeof meta>

export const WorkspaceNavigation: Story = {}
export const LabeledRail: Story = { args: { labeledRail: true } }

export const CompactPage: Story = {
  args: {
    onNewSandbox: undefined,
    notificationsEnabled: false,
    collapseEmptyTopBar: true,
    defaultPanelOpen: false,
    contentClassName: "px-0 pb-0 lg:px-0",
  },
}

const alerts = [
  { id: 'snapshot', title: 'Snapshot ready', message: 'The sandbox snapshot is ready to restore.', read: false, createdAt: '2026-10-04T06:00:00Z' },
  { id: 'stopped', title: 'Sandbox stopped', message: 'The previous sandbox has stopped.', read: true, createdAt: '2026-10-04T05:00:00Z' },
]

export const SidebarControls: Story = {
  render: (args) => {
    const [items, setItems] = React.useState(alerts)
    const [view, setView] = React.useState('Sandboxes')
    return <DashboardLayout {...args} labeledRail onNewSandbox={() => setView('New sandbox')} onSettingsClick={() => setView('Settings')}
      contentClassName="px-0 lg:px-0"
      notifications={{items, unreadCount: items.filter((item) => !item.read).length,
        onMarkRead: (id) => setItems((items) => items.map((item) => item.id === id ? {...item, read:true} : item)),
        onMarkAllRead: () => setItems((items) => items.map((item) => ({...item, read:true})))}}
      sidebarLeading={({ collapsed }) => <button type="button" aria-label="Workspace" className="min-h-11 rounded-md border border-border bg-surface-container px-2 text-sm text-foreground">{collapsed ? 'P' : 'Personal workspace'}</button>}>
      <SandboxPageShell><DashboardPageHeader title={view} description="Manage your sandboxes." /></SandboxPageShell>
    </DashboardLayout>
  },
}
