import type { Meta, StoryObj } from '@storybook/react'
import { SecretsPage, type Secret, type SecretsApiClient } from '../../pages/secrets-page'

function makeApiClient(initial: Secret[] = [
  { name: 'OPENAI_API_KEY', createdAt: '2026-09-14T12:00:00Z' },
  { name: 'DATABASE_URL', createdAt: '2026-09-20T10:00:00Z' },
]): SecretsApiClient {
  let secrets = [...initial]
  return {
    async listSecrets() { return [...secrets] },
    async createSecret(name) { secrets = [...secrets, { name, createdAt: new Date().toISOString() }] },
    async deleteSecret(name) { secrets = secrets.filter((secret) => secret.name !== name) },
  }
}

const meta = {
  title: 'Pages/SecretsPage',
  component: SecretsPage,
  args: { apiClient: makeApiClient(), className: 'mx-auto max-w-5xl p-6' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SecretsPage>

export default meta
type Story = StoryObj<typeof meta>

export const ManageSecrets: Story = { render: () => <SecretsPage apiClient={makeApiClient()} className="mx-auto max-w-5xl p-6" teamSecretsHint={{ onNavigate: () => {} }} /> }
export const Empty: Story = { render: () => <SecretsPage apiClient={makeApiClient([])} className="mx-auto max-w-5xl p-6" /> }
