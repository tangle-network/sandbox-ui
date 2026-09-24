import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import {
  AgentProfilePicker,
  type AgentProfileDraft,
  type AgentProfileOption,
} from '../../chat/agent-profile-picker'

const initialProfiles: AgentProfileOption[] = [
  { id: 'assistant', name: 'Assistant', description: 'Answers and organizes everyday work.', builtin: true },
  { id: 'builder', name: 'Builder', description: 'Plans and implements changes.', builtin: true },
  { id: 'reviewer', name: 'Release reviewer', capabilities: ['repo', 'checks'], instructions: 'Check the evidence before approving.' },
]

const capabilities = [
  { id: 'repo', label: 'Repository', description: 'Read code and proposed changes.' },
  { id: 'checks', label: 'Checks', description: 'Inspect test and build results.' },
  { id: 'browser', label: 'Browser', description: 'Inspect the rendered product.' },
]

function LivePicker({ locked = false, authoring = false }: { locked?: boolean; authoring?: boolean }) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [value, setValue] = useState('assistant')
  const save = (draft: AgentProfileDraft) => {
    const id = draft.id ?? `custom-${profiles.length}`
    setProfiles((current) => draft.id
      ? current.map((profile) => profile.id === id ? { ...profile, ...draft, id } : profile)
      : [...current, { ...draft, id }])
    setValue(id)
  }
  return (
    <div className="flex min-h-56 items-end justify-start p-4" style={{ width: 'min(560px, calc(100vw - 32px))' }}>
      <AgentProfilePicker
        value={value}
        onChange={setValue}
        profiles={profiles}
        side="top"
        locked={locked}
        onNewChat={locked ? () => setValue('builder') : undefined}
        capabilities={authoring ? capabilities : undefined}
        onCreate={authoring ? save : undefined}
        onUpdate={authoring ? (_, draft) => save(draft) : undefined}
        onDelete={authoring ? (id) => setProfiles((current) => current.filter((profile) => profile.id !== id)) : undefined}
      />
    </div>
  )
}

const meta = {
  title: 'Chat/AgentProfilePicker',
  component: AgentProfilePicker,
  args: { value: 'assistant', onChange: () => {}, profiles: initialProfiles },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AgentProfilePicker>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseProfile: Story = { render: () => <LivePicker /> }
export const ManageCustomAgents: Story = { render: () => <LivePicker authoring /> }
export const LockedConversation: Story = { render: () => <LivePicker locked /> }
