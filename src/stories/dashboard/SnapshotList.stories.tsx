import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { SnapshotList, type SnapshotInfo } from '../../dashboard/snapshot-list'

function LiveSnapshots() {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([
    { id: 'snap-8c29f0', createdAt: '2026-09-20T15:10:00Z', sizeBytes: 2_880_000_000, tags: ['pre-migration', 'stable'] },
    { id: 'snap-4a11b7', createdAt: '2026-09-15T09:45:00Z', sizeBytes: 1_760_000_000, tags: ['release'] },
  ])
  return <SnapshotList snapshots={snapshots} onCreate={(tags) => setSnapshots((current) => [{ id: `snap-${current.length + 1}`, createdAt: new Date().toISOString(), sizeBytes: 2_000_000_000, tags }, ...current])} onRestore={() => {}} onSaveAsTemplate={() => {}} className="w-full max-w-[700px]" />
}

const meta = {
  title: 'Dashboard/SnapshotList',
  component: SnapshotList,
  args: { snapshots: [], onCreate: () => {}, onRestore: () => {} },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SnapshotList>

export default meta
type Story = StoryObj<typeof meta>

export const RestorePointHistory: Story = { render: () => <LiveSnapshots /> }
export const Empty: Story = { args: { className: 'w-full max-w-[700px]' } }
