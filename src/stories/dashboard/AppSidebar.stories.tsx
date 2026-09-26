import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { FolderOpen, Plus, Settings } from 'lucide-react'
import { RailButton, RailHeader, Sidebar, SidebarRail, SidebarRailNav } from '../../dashboard/app-sidebar'
import { SidebarProvider, useSidebar } from '../../dashboard/sidebar-context'
import { RailTooltip } from '../../dashboard/rail-tooltip'

function Rail() {
  const { railCollapsed, toggleRail } = useSidebar()
  const [active, setActive] = useState('Workspaces')
  return <><Sidebar><SidebarRail><RailHeader brand={<span className="font-semibold">T</span>} collapsed={railCollapsed} onToggle={toggleRail} /><SidebarRailNav><RailButton icon={Plus} label="New sandbox" showLabel={!railCollapsed} variant="primary" onClick={() => setActive('New sandbox')} /><RailButton icon={FolderOpen} label="Workspaces" showLabel={!railCollapsed} isActive={active === 'Workspaces'} onClick={() => setActive('Workspaces')} /><RailButton icon={Settings} label="Settings" showLabel={!railCollapsed} isActive={active === 'Settings'} onClick={() => setActive('Settings')} /></SidebarRailNav></SidebarRail></Sidebar><main className="min-h-screen p-4 sm:p-8" style={{ marginLeft: railCollapsed ? 56 : 248 }}><h1 className="text-xl font-semibold">{active}</h1><p className="mt-2 text-sm text-muted-foreground">Use the header control to change the rail width.</p></main></>
}

function LiveSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  return <SidebarProvider labeledRail hasPanels={false} railCollapsed={collapsed} onRailCollapsedChange={setCollapsed}><Rail /></SidebarProvider>
}

const meta = {
  title: 'Dashboard/AppSidebar',
  component: Sidebar,
  args: { children: null },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const LabeledAndCollapsed: Story = { render: () => <LiveSidebar /> }
export const IconTooltip: Story = { render: () => <div className="p-8"><RailTooltip label="Workspaces"><button className="rounded border border-border p-3" aria-label="Workspaces"><FolderOpen size={18} /></button></RailTooltip></div> }
