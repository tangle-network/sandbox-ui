import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ApprovalQueue } from '../../assets/approval-queue'
import type { AssetSpec } from '../../assets/types'
import { captionSpec, emailSpec, imageSpec, videoSpec } from './fixtures'

function LiveQueue() {
  const [assets, setAssets] = useState<AssetSpec[]>([emailSpec, imageSpec, captionSpec, videoSpec])
  const changeStatus = (id: string, status: AssetSpec['status']) => setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, status } : asset))
  return (
    <div style={{ width: 'min(960px, calc(100vw - 32px))' }}>
      <ApprovalQueue
        assets={assets}
        variantCounts={{ 'launch-carousel': 2 }}
        onApprove={(id) => changeStatus(id, 'approved')}
        onReject={(id) => changeStatus(id, 'rejected')}
        onSave={(spec) => setAssets((current) => current.map((asset) => asset.id === spec.id ? spec : asset))}
      />
    </div>
  )
}

const meta = {
  title: 'Assets/ApprovalQueue',
  component: ApprovalQueue,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ApprovalQueue>

export default meta
type Story = StoryObj<typeof meta>

export const ReviewAndFilter: Story = { args: { assets: [emailSpec, imageSpec, captionSpec, videoSpec] }, render: () => <LiveQueue /> }
export const Empty: Story = { args: { assets: [] }, render: (args) => <div style={{ width: 'min(680px, calc(100vw - 32px))' }}><ApprovalQueue {...args} /></div> }
