import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { PlanCards, type PlanCardData } from '../../dashboard/plan-cards'

const plans: PlanCardData[] = [
  { id: 'starter', name: 'Starter', price: 0, current: true, features: [{ text: 'One active sandbox' }, { text: 'Community support' }] },
  { id: 'pro', name: 'Pro', price: 49, popular: true, features: [{ text: 'Five active sandboxes' }, { text: 'Team sharing' }, { text: 'Usage analytics' }] },
  { id: 'team', name: 'Team', price: 149, features: [{ text: 'Unlimited sandboxes' }, { text: 'SAML SSO' }, { text: 'Priority support' }] },
]

function LivePlans() {
  const [selected, setSelected] = useState('starter')
  return <div className="w-full max-w-[1000px]"><PlanCards plans={plans.map((plan) => ({ ...plan, current: plan.id === selected, onSelect: setSelected }))} /></div>
}

const meta = {
  title: 'Dashboard/PlanCards',
  component: PlanCards,
  args: { plans },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PlanCards>

export default meta
type Story = StoryObj<typeof meta>

export const ComparePlans: Story = { render: () => <LivePlans /> }
