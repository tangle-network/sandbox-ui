import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { PricingPage } from '../../dashboard/pricing-page'
import { tiers } from '../pages/fixtures'

function LivePricing() {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [tier, setTier] = useState('starter')
  return <div className="w-full max-w-[1100px]"><PricingPage tiers={tiers} currentTierId={tier} billingPeriod={period} onBillingPeriodChange={setPeriod} onSelectTier={setTier} /></div>
}

const meta = {
  title: 'Dashboard/PricingPage',
  component: PricingPage,
  args: { tiers, billingPeriod: 'monthly', onBillingPeriodChange: () => {}, onSelectTier: () => {} },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PricingPage>

export default meta
type Story = StoryObj<typeof meta>

export const CompareAndChoose: Story = { render: () => <LivePricing /> }
export const Loading: Story = { args: { loading: true }, render: (args) => <div className="w-full max-w-[1100px]"><PricingPage {...args} /></div> }
