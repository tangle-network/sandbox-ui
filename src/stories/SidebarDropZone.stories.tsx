import type { Meta, StoryObj } from '@storybook/react'
import { SidebarDropZone } from '../primitives/sidebar-drop-zone'
import { FolderOpen } from 'lucide-react'

const meta: Meta<typeof SidebarDropZone> = {
  title: 'Primitives/SidebarDropZone',
  component: SidebarDropZone,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  args: {
    onDrop: (files) => console.log('dropped', files),
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--depth-1)] space-y-3">
        <div className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest">Workspace Files</div>
        <div className="space-y-1 text-sm text-[var(--text-secondary)]">
          <div className="px-2 py-1 rounded hover:bg-zinc-800">index.ts</div>
          <div className="px-2 py-1 rounded hover:bg-zinc-800">utils.ts</div>
          <div className="px-2 py-1 rounded hover:bg-zinc-800">config.json</div>
        </div>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SidebarDropZone>

export const Persistent: Story = {
  name: 'Persistent (always visible)',
  args: {
    persistent: true,
    title: 'Drop files here',
    description: 'Uploads to workspace',
  },
}

export const PersistentNoDescription: Story = {
  name: 'Persistent — title only',
  args: {
    persistent: true,
    title: 'Upload to workspace',
  },
}

/** Static drag-over appearance — mirrors what the component renders when dragOver=true */
export const DragOverPreview: Story = {
  name: 'Drag-over state (static preview)',
  render: () => (
    <div
      className="rounded-lg border-2 border-dashed p-4 transition-all duration-150"
      style={{
        borderColor: 'hsl(var(--ring, 217 91% 60%))',
        backgroundColor: 'hsl(var(--primary, 217 91% 60%) / 0.08)',
      }}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="text-xs font-medium text-white">Drop files here</p>
        <p className="text-[10px] text-zinc-400">Uploads to workspace</p>
      </div>
    </div>
  ),
}

export const CustomIcon: Story = {
  name: 'Custom Icon',
  args: {
    persistent: true,
    title: 'Add folder',
    description: 'Drop a folder to sync',
    icon: <FolderOpen className="h-4 w-4" />,
  },
}

export const WithAcceptFilter: Story = {
  name: 'Accept filter (.pdf, .csv)',
  args: {
    persistent: true,
    accept: '.pdf,.csv',
    title: 'Drop CSV or PDF',
    description: 'Only structured data files',
  },
}

export const Disabled: Story = {
  name: 'Disabled',
  args: {
    persistent: true,
    disabled: true,
    title: 'Uploads disabled',
  },
}
