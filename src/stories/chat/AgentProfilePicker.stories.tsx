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

function LivePicker({ locked = false, authoring = false, customOnly = false, hostEditor = false }: { locked?: boolean; authoring?: boolean; customOnly?: boolean; hostEditor?: boolean }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [profiles, setProfiles] = useState(customOnly ? initialProfiles.filter((profile) => !profile.builtin) : initialProfiles)
  const [value, setValue] = useState(customOnly ? 'reviewer' : 'assistant')
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
        onEdit={hostEditor ? setEditing : undefined}
        onNew={hostEditor ? () => setEditing("new") : undefined}
        profiles={profiles}
        side="top"
        locked={locked}
        onNewChat={locked ? () => setValue('builder') : undefined}
        capabilities={authoring ? capabilities : undefined}
        onCreate={authoring ? save : undefined}
        onUpdate={authoring ? (_, draft) => save(draft) : undefined}
        onDelete={authoring ? (id) => setProfiles((current) => current.filter((profile) => profile.id !== id)) : undefined}
      />
      {editing && <div role="dialog" aria-label="Host profile editor" className="rounded-lg border p-4"><p>{editing}</p><button onClick={() => setEditing(null)}>Close editor</button></div>}
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
export const HostEditor: Story = { render: () => <LivePicker hostEditor /> }
export const LockedConversation: Story = { render: () => <LivePicker locked /> }

export const CustomProfilesOnly: Story = { render: () => <LivePicker customOnly /> }

function SaveRecoveryPicker() {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [value, setValue] = useState('assistant')
  const [attempts, setAttempts] = useState(0)
  const [pending, setPending] = useState<{ succeed: () => void; fail: () => void } | null>(null)
  const save = (draft: AgentProfileDraft) => new Promise<void>((resolve, reject) => {
    setAttempts((count) => count + 1)
    setPending({
      succeed: () => {
        const id = draft.id ?? `custom-${profiles.length}`
        setProfiles((current) => draft.id
          ? current.map((profile) => profile.id === id ? { ...profile, ...draft, id } : profile)
          : [...current, { ...draft, id }])
        setValue(id)
        setPending(null)
        resolve()
      },
      fail: () => { setPending(null); reject(new Error('Save unavailable. Your draft is still here; try again.')) },
    })
  })
  return (
    <div className="flex flex-col justify-between gap-4 p-4" style={{ width: 'min(560px, calc(100vw - 32px))', minHeight: 'min(640px, calc(100vh - 64px))' }}>
      <div className="space-y-2">
        <p role="status" className="text-sm text-muted-foreground">Save attempts: {attempts}</p>
        <div className="flex gap-3 text-sm">
          <button type="button" disabled={!pending} onClick={() => pending?.fail()}>Reject pending save</button>
          <button type="button" disabled={!pending} onClick={() => pending?.succeed()}>Confirm pending save</button>
        </div>
      </div>
      <AgentProfilePicker
        value={value} onChange={setValue} profiles={profiles} capabilities={capabilities}
        onCreate={save} onUpdate={(_, draft) => save(draft)} side="top"
      />
    </div>
  )
}

/** Explicit completion controls make pending, rejection and retry inspectable. */
export const SaveRecovery: Story = { render: () => <SaveRecoveryPicker /> }
