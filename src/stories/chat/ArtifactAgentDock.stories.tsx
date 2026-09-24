import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ArtifactAgentDock, type ArtifactAgentDockTransport } from '../../chat/artifact-agent-dock'

const transport: ArtifactAgentDockTransport = {
  async ensureThread(scope) { return { id: `thread-${scope.key}` } },
  async loadMessages() {
    return [
      { id: 'question', role: 'user', content: 'What changed in this file?' },
      { id: 'answer', role: 'assistant', content: 'The retry policy now backs off after repeated failures.' },
    ]
  },
  async *sendStream({ content, signal }) {
    const response = `For this artifact, I would review: ${content.toLowerCase()}`
    for (const word of response.split(' ')) {
      if (signal.aborted) return
      yield { type: 'delta', text: `${word} ` }
      await new Promise((resolve) => setTimeout(resolve, 35))
    }
  },
}

function Dock({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div className="relative flex h-[680px] w-full max-w-[900px] overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">retry-policy.ts</h2>
        <p className="text-sm text-muted-foreground">A file-scoped conversation follows the artifact.</p>
        <button className="w-fit rounded border border-border px-3 py-2 text-sm" onClick={() => setOpen(true)}>Ask about this file</button>
      </div>
      <ArtifactAgentDock scope={{ kind: 'vault-file', key: 'src/runtime/retry-policy.ts' }} open={open} onOpenChange={setOpen} transport={transport} defaultPrompt="Explain the backoff behavior" />
    </div>
  )
}

const meta = {
  title: 'Chat/ArtifactAgentDock',
  component: ArtifactAgentDock,
  args: { scope: { kind: 'vault-file', key: 'src/runtime/retry-policy.ts' }, open: true, onOpenChange: () => {}, transport },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ArtifactAgentDock>

export default meta
type Story = StoryObj<typeof meta>

export const ExistingThread: Story = { render: () => <Dock /> }
export const OpenFromArtifact: Story = { render: () => <Dock initiallyOpen={false} /> }
