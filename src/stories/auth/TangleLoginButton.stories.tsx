import type { Meta, StoryObj } from '@storybook/react'
import { TangleLoginButton } from '../../auth/tangle-login-button'

const meta = {
  title: 'Auth/TangleLoginButton',
  component: TangleLoginButton,
  args: { authUrl: '#sso-start' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof TangleLoginButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Outline: Story = { args: { variant: 'outline' } }
export const Disabled: Story = { args: { disabled: true, children: 'Sign in is unavailable' } }
