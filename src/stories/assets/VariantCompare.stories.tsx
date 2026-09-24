import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { VariantCompare } from '../../assets/variant-compare'
import { variants } from './fixtures'

function LiveCompare() {
  const [chosen, setChosen] = useState<string | null>(null)
  return (
    <div style={{ width: 'min(960px, calc(100vw - 32px))' }}>
      <VariantCompare variants={variants.map((variant) => chosen === variant.id ? { ...variant, approvedAt: '2026-09-23T16:30:00Z' } : variant)} onPromote={setChosen} />
    </div>
  )
}

const meta = {
  title: 'Assets/VariantCompare',
  component: VariantCompare,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof VariantCompare>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseVariant: Story = { args: { variants }, render: () => <LiveCompare /> }
export const Empty: Story = { args: { variants: [] }, render: (args) => <VariantCompare {...args} /> }
