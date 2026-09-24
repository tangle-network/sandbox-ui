import type { Meta, StoryObj } from '@storybook/react'
import { ProfilesPage, type Profile, type ProfileFormData } from '../../pages/profiles-page'

const builtin: Profile[] = [{ id: 'assistant', name: 'Assistant', description: 'General purpose assistance.', is_builtin: true }]
const initial: Profile[] = [{ id: 'reviewer', name: 'Release reviewer', description: 'Checks evidence before release.', model: 'anthropic/claude-sonnet-4-5', tags: ['review'], metrics: { total_runs: 42, success_rate: 95, avg_duration_ms: 18200 } }]

function makeApiClient() {
  let custom = [...initial]
  return {
    async listProfiles() { return { builtin, custom: [...custom] } },
    async createProfile(data: ProfileFormData) { const profile = { ...data, id: `profile-${custom.length + 1}` }; custom = [...custom, profile]; return profile },
    async updateProfile(id: string, data: Partial<ProfileFormData>) { const profile = { ...custom.find((item) => item.id === id)!, ...data, id }; custom = custom.map((item) => item.id === id ? profile : item); return profile },
    async deleteProfile(id: string) { custom = custom.filter((item) => item.id !== id) },
  }
}

const meta = {
  title: 'Pages/ProfilesPage',
  component: ProfilesPage,
  args: { apiClient: makeApiClient(), tier: 'pro', title: 'Agent profiles' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProfilesPage>

export default meta
type Story = StoryObj<typeof meta>

export const ManageProfiles: Story = { render: () => <ProfilesPage apiClient={makeApiClient()} tier="pro" title="Agent profiles" /> }
export const AtPlanLimit: Story = { args: { tier: 'free', maxProfiles: 1 } }
