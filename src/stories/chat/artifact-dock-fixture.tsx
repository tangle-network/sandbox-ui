import React, { useMemo, useState } from 'react'
import { ArtifactAgentDock, type ArtifactAgentDockTransport } from '../../chat/artifact-agent-dock'

type StreamEvent = 'sent' | 'delta' | 'cancelled' | 'completed'

export function createArtifactDockTransport(observe?: (event: StreamEvent) => void): ArtifactAgentDockTransport {
  return {
    async ensureThread(scope) { return { id: `thread-${scope.key}` } },
    async loadMessages() {
      return [
        { id: 'question', role: 'user', content: 'What changed in this file?' },
        { id: 'answer', role: 'assistant', content: 'The retry policy now backs off after repeated failures.' },
      ]
    },
    async *sendStream({ content, signal }) {
      observe?.('sent')
      try {
        const response = `For this artifact, I would review: ${content.toLowerCase()}`
        for (const word of response.split(' ')) {
          if (signal.aborted) return
          observe?.('delta')
          yield { type: 'delta', text: `${word} ` }
          await new Promise((resolve) => setTimeout(resolve, 35))
        }
      } finally {
        observe?.(signal.aborted ? 'cancelled' : 'completed')
      }
    },
  }
}

export function ArtifactDockFixture({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const [streams, setStreams] = useState({ sent: 0, delta: 0, cancelled: 0, completed: 0 })
  const transport = useMemo(() => createArtifactDockTransport((event) => {
    setStreams((current) => ({ ...current, [event]: current[event] + 1 }))
  }), [])
  return (
    <div className="rounded-lg border border-border bg-background"
      style={{ position: 'relative', display: 'flex', height: 680, width: '100%', maxWidth: 900, overflow: 'hidden' }}
      data-artifact-dock-fixture data-stream-sent={streams.sent} data-stream-delta={streams.delta}
      data-stream-cancelled={streams.cancelled} data-stream-completed={streams.completed}>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">retry-policy.ts</h2>
        <p className="text-sm text-muted-foreground">A file-scoped conversation follows the artifact.</p>
        <button className="w-fit rounded border border-border px-3 py-2 text-sm" onClick={() => setOpen(true)}>Ask about this file</button>
      </div>
      <ArtifactAgentDock scope={{ kind: 'vault-file', key: 'src/runtime/retry-policy.ts' }} open={open} onOpenChange={setOpen} transport={transport} defaultPrompt="Explain the backoff behavior" />
    </div>
  )
}
