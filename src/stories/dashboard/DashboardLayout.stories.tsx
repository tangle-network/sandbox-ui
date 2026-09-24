import type { Meta, StoryObj } from '@storybook/react'
import { FolderOpen, LayoutDashboard, Plug, Terminal } from 'lucide-react'
import { DashboardLayout } from '../../dashboard/dashboard-layout'

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
