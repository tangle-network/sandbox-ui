import type { Meta, StoryObj } from '@storybook/react'
import { BillingPage } from '../../pages/billing-page'
import { billingData } from './fixtures'

const meta = {
  title: 'Pages/BillingPage',
  component: BillingPage,
  args: { initialData: billingData, onManageSubscription: () => {}, onAddCredits: () => {}, onSelectTier: () => {} },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BillingPage>

export default meta
type Story = StoryObj<typeof meta>

export const AccountBilling: Story = {}
