import type { Meta, StoryObj } from '@storybook/react'
import { ProviderIcon } from '../../integrations/provider-logo'

const inlineMark = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="14" fill="%23303f88"/%3E%3Cpath d="M16 44L32 14l16 30H16z" fill="%23f9c85d"/%3E%3C/svg%3E'

const meta = {
  title: 'Integrations/ProviderIcon',
  component: ProviderIcon,
  args: { id: 'northstar', iconUrl: inlineMark, displayName: 'Northstar Studio', size: 64, className: 'rounded-xl' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ProviderIcon>

export default meta
type Story = StoryObj<typeof meta>

export const SuppliedMark: Story = {}
export const MonogramFallback: Story = { args: { id: '', iconUrl: null, displayName: 'Northstar Studio' } }
