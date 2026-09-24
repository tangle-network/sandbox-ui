import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ApprovalQueue, type ApprovalItem } from '../../workspace/approval-queue'

const initial: ApprovalItem[] = [
  { id: 'deploy', title: 'Deploy the API gateway', description: 'Publish the new retry policy to staging.', type: 'Deploy', status: 'pending', createdAt: '2026-09-23T12:00:00Z' },
  { id: 'email', title: 'Send the release note', description: 'Email the migration summary to the team.', type: 'Email', status: 'pending', createdAt: '2026-09-23T11:00:00Z' },
  { id: 'snapshot', title: 'Create a restore point', type: 'Snapshot', status: 'approved', createdAt: '2026-09-22T15:00:00Z' },
]

function LiveQueue() {
  const [items, setItems] = useState(initial)
  const resolve = (id: string, status: ApprovalItem['status'], reason?: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, status, meta: reason ? { rejectionReason: reason } : item.meta } : item))
  return <ApprovalQueue items={items} onApprove={(item) => resolve(item.id, 'approved')} onReject={(item, reason) => resolve(item.id, 'rejected', reason)} className="h-[650px] w-full max-w-[800px] rounded-lg border border-border bg-background" />
}

const meta = {
  title: 'Workspace/ApprovalQueue',
  component: ApprovalQueue,
  args: { items: initial },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ApprovalQueue>

export default meta
type Story = StoryObj<typeof meta>

export const ReviewProposals: Story = { render: () => <LiveQueue /> }
export const Empty: Story = { args: { items: [], className: 'h-72 w-full max-w-[600px] rounded-lg border border-border' } }
