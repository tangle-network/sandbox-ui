import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ArrowUp, GitCompare, Paperclip, PanelLeftOpen } from 'lucide-react'
import type { SessionMessage, SessionPart } from '@tangle-network/ui/types'
import { HarnessLogo } from '../../dashboard/harness-logo'
import { SandboxWorkbench, type SandboxWorkbenchArtifact } from '../../workspace/sandbox-workbench'
import { SessionSidebar, type SessionSidebarItem } from '../../workspace/session-sidebar'

const meta: Meta<typeof SandboxWorkbench> = {
  title: 'Workspace/SandboxWorkbench',
  component: SandboxWorkbench,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="h-screen" data-sandbox-ui="true">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SandboxWorkbench>

// --- Transcript fixture: one turn of a coding session ---

const NOW = Date.now()
const t = (offsetSeconds: number) => NOW - offsetSeconds * 1000

const MESSAGES: SessionMessage[] = [
  { id: 'user-1', role: 'user', time: { created: t(140) } },
  { id: 'asst-1', role: 'assistant', time: { created: t(135), completed: t(80) } },
  { id: 'user-2', role: 'user', time: { created: t(60) } },
  { id: 'asst-2', role: 'assistant', time: { created: t(55), completed: t(20) } },
]

const PART_MAP: Record<string, SessionPart[]> = {
  'user-1': [{ type: 'text', text: 'The staging deploy skips the smoke job. Find out why and fix it.' }],
  'asst-1': [
    {
      type: 'tool',
      id: 'tool-1',
      tool: 'grep',
      state: {
        status: 'completed',
        input: { pattern: 'smoke', path: '.github/workflows' },
        output: '.github/workflows/deploy.yml:88:  smoke:\n.github/workflows/deploy.yml:91:    if: github.event_name == "push"',
        time: { start: t(134), end: t(132) },
      },
    },
    {
      type: 'tool',
      id: 'tool-2',
      tool: 'read',
      state: {
        status: 'completed',
        input: { path: '.github/workflows/deploy.yml' },
        output: 'jobs:\n  deploy: …\n  smoke:\n    needs: deploy\n    if: github.event_name == "push"',
        time: { start: t(131), end: t(128) },
      },
    },
    {
      type: 'text',
      text: 'The `smoke` job is gated on `github.event_name == "push"`, and the staging deploy runs from `workflow_dispatch`, so the gate is never true there. Changing the condition to allow both event names keeps the job off pull requests and turns it on for dispatched deploys.',
    },
  ],
  'user-2': [{ type: 'text', text: 'Do it, and add a step that fails the job when the smoke URL 404s.' }],
  'asst-2': [
    {
      type: 'tool',
      id: 'tool-3',
      tool: 'edit',
      state: {
        status: 'completed',
        input: { path: '.github/workflows/deploy.yml' },
        output: '-    if: github.event_name == "push"\n+    if: contains(fromJSON(\'["push","workflow_dispatch"]\'), github.event_name)',
        time: { start: t(54), end: t(52) },
      },
    },
    {
      type: 'tool',
      id: 'tool-4',
      tool: 'bash',
      state: {
        status: 'completed',
        input: { command: 'actionlint .github/workflows/deploy.yml' },
        output: '',
        time: { start: t(50), end: t(47) },
      },
    },
    {
      type: 'text',
      text: 'Done. The condition now accepts `push` and `workflow_dispatch`, and a `curl --fail` step after the deploy makes a 404 on the smoke URL fail the job. `actionlint` is clean.',
    },
  ],
}

// --- Rail fixture ---

const THREADS: SessionSidebarItem[] = [
  {
    id: 'thread-1',
    title: 'Staging deploy skips the smoke job',
    status: 'running',
    updatedAt: new Date(NOW - 20_000),
    icon: <HarnessLogo type="claude-code" size={16} />,
    meta: 'Claude Code · now',
  },
  {
    id: 'thread-2',
    title: 'Migrate billing webhooks to idempotent handlers',
    status: 'attention-needed',
    updatedAt: new Date(NOW - 6 * 60_000),
    icon: <HarnessLogo type="codex" size={16} />,
    meta: 'Codex · 6m',
  },
  {
    id: 'thread-3',
    title: 'Flaky terminal resize test',
    status: 'error',
    updatedAt: new Date(NOW - 42 * 60_000),
    icon: <HarnessLogo type="opencode" size={16} />,
    meta: 'OpenCode · 42m',
  },
  {
    id: 'thread-4',
    title: 'Add relative ages to the session rail',
    status: 'idle',
    updatedAt: new Date(NOW - 2 * 60 * 60_000),
    icon: <HarnessLogo type="claude-code" size={16} />,
    meta: 'Claude Code · 2h',
  },
  {
    id: 'thread-5',
    title: 'Draft the Q3 provisioning retro',
    status: 'idle',
    updatedAt: new Date(NOW - 26 * 60 * 60_000),
    icon: <HarnessLogo type="amp" size={16} />,
    meta: 'AMP · 1d',
  },
]

// --- Artifact fixtures ---

const CHANGED_FILES = [
  { path: '.github/workflows/deploy.yml', added: 3, removed: 1 },
  { path: 'scripts/smoke.sh', added: 12, removed: 0 },
  { path: 'docs/deploy.md', added: 4, removed: 2 },
]

function ChangesPanel() {
  return (
    <ul className="divide-y divide-[var(--md3-outline-variant)]">
      {CHANGED_FILES.map((file) => (
        <li key={file.path} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="truncate font-mono text-[13px] text-foreground">{file.path}</span>
          <span className="shrink-0 font-mono text-xs">
            <span className="text-[var(--code-success)]">+{file.added}</span>{' '}
            <span className="text-[var(--code-error)]">−{file.removed}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

const DEPLOY_YML = `jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm deploy --env staging
  smoke:
    needs: deploy
    if: contains(fromJSON('["push","workflow_dispatch"]'), github.event_name)
    runs-on: ubuntu-latest
    steps:
      - run: curl --fail --silent "$SMOKE_URL/healthz"
`

const ARTIFACTS: SandboxWorkbenchArtifact[] = [
  {
    id: 'deploy-yml',
    kind: 'file',
    title: 'deploy.yml',
    path: '.github/workflows/deploy.yml',
    filename: 'deploy.yml',
    content: DEPLOY_YML,
    mimeType: 'text/yaml',
  },
  {
    id: 'changes',
    kind: 'custom',
    title: 'Changes',
    icon: GitCompare,
    pinned: true,
    eyebrow: 'Working tree',
    subtitle: '3 files · +19 −3',
    content: <ChangesPanel />,
  },
]

// A stand-in for the composer slot. The canonical composer is `ChatComposer`
// from `@tangle-network/agent-app/web-react`; this package ships none.
function ComposerPlaceholder() {
  return (
    <div className="flex items-end gap-2 rounded-2xl border border-[var(--md3-outline-variant)] bg-surface-container px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
      <button
        type="button"
        aria-label="Attach"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <div className="min-h-8 flex-1 py-1.5 text-sm text-muted-foreground">Message Claude Code…</div>
      <button
        type="button"
        aria-label="Send"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  )
}

// --- Stories ---

export const Default: Story = {
  name: 'Default',
  args: {
    title: 'Staging deploy skips the smoke job',
    subtitle: 'sandbox-3f9a · node 20 · /workspace',
    session: {
      messages: MESSAGES,
      partMap: PART_MAP,
      isStreaming: false,
      presentation: 'timeline',
    },
    artifacts: ARTIFACTS.filter((artifact) => !artifact.pinned),
    directory: {
      root: {
        name: 'workspace',
        path: '/workspace',
        type: 'directory',
        children: [
          {
            name: '.github',
            path: '/workspace/.github',
            type: 'directory',
            children: [
              {
                name: 'workflows',
                path: '/workspace/.github/workflows',
                type: 'directory',
                children: [
                  { name: 'ci.yml', path: '/workspace/.github/workflows/ci.yml', type: 'file' },
                  { name: 'deploy.yml', path: '/workspace/.github/workflows/deploy.yml', type: 'file' },
                ],
              },
            ],
          },
          {
            name: 'scripts',
            path: '/workspace/scripts',
            type: 'directory',
            children: [{ name: 'smoke.sh', path: '/workspace/scripts/smoke.sh', type: 'file' }],
          },
          { name: 'package.json', path: '/workspace/package.json', type: 'file' },
        ],
      },
    },
  },
}

export const ThreePaneQuiet: Story = {
  name: 'Three-pane quiet',
  render: () => {
    const [threadId, setThreadId] = useState('thread-1')
    const [chatsOpen, setChatsOpen] = useState(true)

    return (
      <SandboxWorkbench
        centerHeader={null}
        rail={
          <SessionSidebar
            variant="quiet"
            groupBy="status"
            fill
            className="border-r-0"
            title="Chats"
            createLabel="New chat"
            searchPlaceholder="Search chats"
            items={THREADS}
            currentItemId={threadId}
            onSelectItem={(item) => setThreadId(item.id)}
            onCreate={() => setThreadId('thread-1')}
            onCollapse={() => setChatsOpen(false)}
          />
        }
        session={{
          messages: MESSAGES,
          partMap: PART_MAP,
          isStreaming: false,
          presentation: 'timeline',
        }}
        composer={<ComposerPlaceholder />}
        artifacts={ARTIFACTS}
        onArtifactClose={() => {}}
        layout={{
          leftOpen: chatsOpen,
          onLeftOpenChange: setChatsOpen,
          keyboardShortcuts: true,
          defaultLeftWidth: 288,
          defaultRightWidth: 420,
          leftCollapsedControl: (
            <button
              type="button"
              aria-label="Show chats"
              onClick={() => setChatsOpen(true)}
              className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ),
        }}
        className="p-0 lg:p-0"
      />
    )
  },
}
