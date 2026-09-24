import type { BillingPageData } from '../../pages/billing-page'
import type { PricingTier } from '../../dashboard/pricing-page'

export const tiers: PricingTier[] = [
  { id: 'starter', name: 'Starter', description: 'For one active project.', monthlyPriceCents: 0, yearlyPriceCents: 0, features: ['One sandbox', 'Shared templates'], creditsPerMonth: 5 },
  { id: 'pro', name: 'Pro', description: 'For teams building every day.', monthlyPriceCents: 4900, yearlyPriceCents: 46800, features: ['Five sandboxes', 'Team access', 'Priority support'], creditsPerMonth: 50, recommended: true },
  { id: 'team', name: 'Team', description: 'For larger development teams.', monthlyPriceCents: 14900, yearlyPriceCents: 142800, features: ['Unlimited sandboxes', 'SSO', 'Usage reports'], creditsPerMonth: 200 },
]

export const billingData: BillingPageData = {
  subscription: { status: 'active', tierName: 'Pro', renewsAt: '2026-10-01T00:00:00Z' },
  balance: { available: 34.25, used: 15.75 },
  usage: { period: 'September 2026', total: 15.75, byModel: { 'Claude Sonnet': 9.2, 'GPT-5': 4.1, 'Compute': 2.45 } },
  usageHistory: [],
  tiers,
}
