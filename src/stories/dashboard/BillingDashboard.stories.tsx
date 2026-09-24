import type { Meta, StoryObj } from '@storybook/react'
import { BillingDashboard } from '../../dashboard/billing-dashboard'
import { billingData } from '../pages/fixtures'

const meta = {
  title: 'Dashboard/BillingDashboard',
  component: BillingDashboard,
  args: { ...billingData, onManageSubscription: () => {}, onAddCredits: () => {}, className: 'w-full max-w-[1050px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BillingDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const ActivePlan: Story = {}
export const LowBalance: Story = { args: { balance: { available: 0.72, used: 49.28 } } }
