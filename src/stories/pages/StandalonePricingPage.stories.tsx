import type { Meta, StoryObj } from '@storybook/react'
import { StandalonePricingPage } from '../../pages/standalone-pricing-page'
import { tiers } from './fixtures'

const meta = {
  title: 'Pages/StandalonePricingPage',
  component: StandalonePricingPage,
  args: { initialTiers: tiers, onSelectTier: () => {}, eyebrow: 'Sandbox plans' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof StandalonePricingPage>

export default meta
type Story = StoryObj<typeof meta>

export const PlansAndQuestions: Story = {}
