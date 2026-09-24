import type { Meta, StoryObj } from '@storybook/react'
import { AuthPage } from '../../pages/auth-page'

const meta = {
  title: 'Pages/AuthPage',
  component: AuthPage,
  args: { product: 'Sandbox', tagline: 'Sign in to continue building.', tangleAuthUrl: '#tangle-sso', providers: ['github', 'google'] },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AuthPage>

export default meta
type Story = StoryObj<typeof meta>

export const SignIn: Story = { args: { onEmailSubmit: async () => 'Use your workspace password to continue.' } }
export const CreateAccount: Story = { args: { mode: 'signup', tagline: 'Create your Sandbox workspace.', onEmailSubmit: async () => 'This email already has an account.' } }
export const SingleSignOnOnly: Story = { args: { providers: [] } }
