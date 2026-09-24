import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { AssetCard, type AssetCardProps } from '../../assets/asset-card'
import { AssetEditor } from '../../assets/asset-editor'
import { emailSpec, imageSpec, videoSpec } from './fixtures'

function ReviewableCard(args: AssetCardProps) {
  const [spec, setSpec] = useState(args.spec)
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <div className="space-y-3" style={{ width: 'min(640px, calc(100vw - 32px))' }}>
        <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:text-foreground">← Back to card</button>
        <AssetEditor spec={spec} onSave={(next) => { setSpec(next); setEditing(false) }} />
      </div>
    )
  }
  return (
    <div className="w-72">
      <AssetCard {...args} spec={spec} onApprove={() => setSpec((current) => ({ ...current, status: 'approved' }))} onReject={() => setSpec((current) => ({ ...current, status: 'rejected' }))} onEdit={() => setEditing(true)} />
    </div>
  )
}

const meta = {
  title: 'Assets/AssetCard',
  component: AssetCard,
  args: { spec: emailSpec },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AssetCard>

export default meta
type Story = StoryObj<typeof meta>

export const PendingReview: Story = { render: (args) => <ReviewableCard {...args} /> }
export const Carousel: Story = { args: { spec: imageSpec, variantCount: 3 }, render: (args) => <ReviewableCard {...args} /> }
export const DraftVideo: Story = { args: { spec: videoSpec }, render: (args) => <ReviewableCard {...args} /> }
