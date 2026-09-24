import type { Meta, StoryObj } from '@storybook/react'
import { PromoBanner } from '../../dashboard/promo-banner'

const meta = {
  title: 'Dashboard/PromoBanner',
  component: PromoBanner,
  args: { title: 'Share a sandbox with your team', description: 'Invite collaborators to the same development environment.', buttonLabel: 'Invite teammates', className: 'w-full max-w-[760px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PromoBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Invitation: Story = { args: { onClick: () => {} } }
export const Unavailable: Story = { args: { disabled: true } }
