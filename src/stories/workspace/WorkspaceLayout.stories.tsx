import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { WorkspaceLayout } from '../../workspace/workspace-layout'
import { SessionSidebar, type SessionSidebarItem } from '../../workspace/session-sidebar'
import { StatusBar } from '../../workspace/status-bar'
import { StatusBanner } from '../../workspace/status-banner'

const meta: Meta<typeof WorkspaceLayout> = {
  title: 'Workspace/WorkspaceLayout',
  component: WorkspaceLayout,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="h-screen" data-sandbox-ui="true" >
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof WorkspaceLayout>

// --- Shared placeholder helpers ---

function Pane({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6 text-center">
      <span className={muted ? 'text-xs text-[var(--text-dim)]' : 'text-sm text-[var(--text-muted)]'}>
        {label}
      </span>
    </div>
  )
}

function ChatArea() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {[
          { role: 'user', text: 'Analyze the ingestion pipeline and summarize bottlenecks.' },
          { role: 'agent', text: 'Running analysis across 142 files in /data/uploads… Found 3 bottlenecks: (1) schema coercion on nullables, (2) sequential retry logic in batch writer, (3) unbounded in-memory queue before flush.' },
          { role: 'user', text: 'Can you generate a fix for the retry logic?' },
          { role: 'agent', text: 'Drafting a bounded exponential backoff with jitter. Opening artifact panel on the right…' },
        ].map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--brand-cool)]/20 text-[var(--text-primary)] border border-[var(--brand-cool)]/30'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--border-subtle)] p-3">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 text-sm text-[var(--text-dim)]">
          Send a message…
        </div>
      </div>
    </div>
  )
}

function ArtifactContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Artifact</div>
        <div className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">batch-writer.ts</div>
        <div className="mt-0.5 text-xs text-[var(--text-muted)]">Suggested fix — retry logic</div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-xs text-[var(--text-secondary)] leading-relaxed font-mono whitespace-pre-wrap">
{`async function writeWithRetry(
  batch: Record[],
  opts: RetryOptions = {},
) {
  const {
    maxAttempts = 5,
    baseDelayMs = 200,
    maxDelayMs = 10_000,
  } = opts

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await flushBatch(batch)
      return
    } catch (err) {
      if (attempt === maxAttempts) throw err
      const jitter = Math.random() * baseDelayMs
      const delay = Math.min(
        baseDelayMs * 2 ** (attempt - 1) + jitter,
        maxDelayMs,
      )
      await sleep(delay)
    }
  }
}`}
        </pre>
      </div>
    </div>
  )
}

function TerminalContent() {
  return (
    <div className="h-full overflow-auto bg-[var(--bg-dark)] p-4 font-mono text-xs leading-relaxed">
      <div className="text-[var(--text-muted)]">$ node ingest.js --path /data/uploads</div>
      <div className="text-[var(--code-success)] mt-1">✓ Connected to pipeline runtime</div>
      <div className="text-[var(--text-secondary)]">→ Scanning 142 files…</div>
      <div className="text-[var(--text-secondary)]">→ Schema coercion: 12 warnings</div>
      <div className="text-[var(--code-error)]">✗ Batch flush failed (attempt 1/5): ETIMEDOUT</div>
      <div className="text-[var(--code-number)]">  Retrying in 412ms…</div>
      <div className="text-[var(--code-success)]">✓ Batch flush succeeded on attempt 2</div>
      <div className="text-[var(--text-secondary)]">→ Processed 142/142 files</div>
      <div className="text-[var(--code-success)] mt-1">✓ Pipeline complete in 8.4s</div>
    </div>
  )
}

const SIDEBAR_SESSIONS: SessionSidebarItem[] = [
  {
    id: 'sess-001',
    title: 'File ingestion pipeline',
    subtitle: 'Processing /data/uploads',
    status: 'running',
    isPinned: true,
    updatedAt: new Date(Date.now() - 12_000),
  },
  {
    id: 'sess-002',
    title: 'Schema validation sweep',
    subtitle: 'Validating JSON schemas',
    status: 'idle',
    updatedAt: new Date(Date.now() - 5 * 60_000),
  },
  {
    id: 'sess-003',
    title: 'Auth token refresh',
    subtitle: 'OAuth2 exchange failed',
    status: 'error',
    updatedAt: new Date(Date.now() - 8 * 60_000),
  },
]

// --- Stories ---

export const Default: Story = {
  args: {
    defaultLeftOpen: true,
    defaultRightOpen: false,
    defaultBottomOpen: false,
    center: <ChatArea />,
    centerHeader: (
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        File ingestion pipeline
      </span>
    ),
    left: <Pane label="Left panel — session list or file tree" />,
    leftHeader: (
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Sessions
      </span>
    ),
  },
}

export const FullDemo: Story = {
  name: 'Full Demo — All Panels',
  render: () => {
    const [currentId, setCurrentId] = useState('sess-001')

    return (
      <WorkspaceLayout
        defaultLeftOpen={true}
        defaultRightOpen={true}
        defaultBottomOpen={true}
        defaultLeftWidth={288}
        defaultRightWidth={440}
        defaultBottomHeight={220}
        left={
          <SessionSidebar
            title="Blueprint Agent"
            subtitle="tangle.network"
            items={SIDEBAR_SESSIONS}
            currentItemId={currentId}
            onSelectItem={(item) => setCurrentId(item.id)}
            enableSearch={false}
            className="border-r-0 w-full"
          />
        }
        leftHeader={
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Sessions
          </span>
        }
        center={<ChatArea />}
        centerHeader={
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            File ingestion pipeline
          </span>
        }
        right={<ArtifactContent />}
        rightHeader={
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Artifact
          </span>
        }
        bottom={<TerminalContent />}
        bottomHeader={
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Terminal
          </span>
        }
      />
    )
  },
}

export const CenterOnly: Story = {
  name: 'Center Only',
  args: {
    center: <ChatArea />,
    defaultLeftOpen: false,
    defaultRightOpen: false,
    defaultBottomOpen: false,
  },
}

export const WithStatusBanner: Story = {
  name: 'With Status Banner',
  render: () => (
    <WorkspaceLayout
      defaultLeftOpen={true}
      defaultRightOpen={false}
      defaultBottomOpen={false}
      left={<Pane label="Session list" />}
      leftHeader={
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Sessions
        </span>
      }
      center={
        <div className="flex h-full flex-col">
          <StatusBanner
            type="provisioning"
            message="Provisioning sandbox environment…"
            detail="This usually takes 10–30 seconds"
          />
          <div className="flex-1">
            <Pane label="Chat area — waiting for runtime" />
          </div>
          <StatusBar
            status="provisioning"
            modelLabel="claude-sonnet-4-5"
            credits={48320}
          />
        </div>
      }
      centerHeader={
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          New Session
        </span>
      }
    />
  ),
}

export const WithBottomPanel: Story = {
  name: 'With Bottom Panel Open',
  args: {
    defaultLeftOpen: true,
    defaultRightOpen: false,
    defaultBottomOpen: true,
    defaultBottomHeight: 240,
    center: <ChatArea />,
    centerHeader: (
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        File ingestion pipeline
      </span>
    ),
    left: <Pane label="Session list" />,
    leftHeader: (
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Sessions
      </span>
    ),
    bottom: <TerminalContent />,
    bottomHeader: (
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Terminal
      </span>
    ),
  },
}

export const BuilderTheme: Story = {
  name: 'Builder Theme',
  decorators: [
    (Story) => (
      <div className="h-screen" data-sandbox-ui="true">
        <Story />
      </div>
    ),
  ],
  args: {
    theme: 'builder',
    defaultLeftOpen: true,
    defaultRightOpen: true,
    defaultBottomOpen: false,
    center: <ChatArea />,
    centerHeader: (
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        File ingestion pipeline
      </span>
    ),
    left: <Pane label="Session list" />,
    right: <ArtifactContent />,
  },
}

export const CompactDensity: Story = {
  name: 'Compact Density',
  args: {
    density: 'compact',
    defaultLeftOpen: true,
    defaultRightOpen: false,
    defaultBottomOpen: false,
    center: <ChatArea />,
    centerHeader: (
      <span className="text-sm font-semibold text-[var(--text-primary)]">
        File ingestion pipeline
      </span>
    ),
    left: <Pane label="Session list" />,
  },
}

export const NotResizable: Story = {
  name: 'Fixed (Not Resizable)',
  args: {
    resizable: false,
    defaultLeftOpen: true,
    defaultRightOpen: true,
    defaultBottomOpen: false,
    center: <ChatArea />,
    left: <Pane label="Session list" />,
    right: <ArtifactContent />,
  },
}
