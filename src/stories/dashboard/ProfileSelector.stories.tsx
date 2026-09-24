import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ProfileComparison, ProfileSelector, type Profile } from '../../dashboard/profile-selector'

const profiles: Profile[] = [
  { id: 'assistant', name: 'Assistant', description: 'General help across the workspace', is_builtin: true },
  { id: 'reviewer', name: 'Release reviewer', description: 'Checks test evidence before release', model: 'anthropic/claude-sonnet-4-5', metrics: { total_runs: 42, success_rate: 95, avg_duration_ms: 18200 } },
  { id: 'triage', name: 'Incident triage', description: 'Investigates failed jobs', model: 'openai/gpt-5', metrics: { total_runs: 28, success_rate: 89, avg_duration_ms: 12100 } },
]

function LiveSelector() {
  const [selectedId, setSelectedId] = useState<string | null>('reviewer')
  return <div className="w-full max-w-[400px]"><ProfileSelector profiles={profiles} selectedId={selectedId} onSelect={(profile) => setSelectedId(profile?.id ?? null)} /></div>
}

const meta = {
  title: 'Dashboard/ProfileSelector',
  component: ProfileSelector,
  args: { profiles, onSelect: () => {} },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ProfileSelector>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseProfile: Story = { render: () => <LiveSelector /> }
export const ComparePerformance: Story = { render: () => <ProfileComparison profiles={profiles} className="w-full max-w-[440px]" /> }
