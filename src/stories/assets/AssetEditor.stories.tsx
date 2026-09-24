import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { AssetEditor } from '../../assets/asset-editor'
import type { AssetSpec } from '../../assets/types'
import { emailSpec, imageSpec } from './fixtures'

function EditableAsset({ initial }: { initial: AssetSpec }) {
  const [asset, setAsset] = useState(initial)
  const [saved, setSaved] = useState(false)
  return (
    <div className="space-y-2" style={{ width: 'min(900px, calc(100vw - 32px))' }}>
      <AssetEditor spec={asset} onSave={(next) => { setAsset(next); setSaved(true) }} onRevisionRequest={() => setSaved(false)} />
      {saved && <p role="status" className="text-sm text-muted-foreground">Changes saved in this story.</p>}
    </div>
  )
}

const meta = {
  title: 'Assets/AssetEditor',
  component: AssetEditor,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AssetEditor>

export default meta
type Story = StoryObj<typeof meta>

export const EmailDraft: Story = { args: { spec: emailSpec }, render: () => <EditableAsset initial={emailSpec} /> }
export const CarouselDraft: Story = { args: { spec: imageSpec }, render: () => <EditableAsset initial={imageSpec} /> }
