import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { MessageList } from '../../chat/message-list'
import type { GroupedMessage } from '../../types/run'
import type { SessionPart } from '../../types/parts'

const meta: Meta<typeof MessageList> = {
  title: 'Chat/MessageList',
  component: MessageList,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-[var(--bg-root)] p-8">
        <div className="mx-auto max-w-3xl">
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof MessageList>

// ---------------------------------------------------------------------------
// Mock data — a realistic agent coding session
// ---------------------------------------------------------------------------

const NOW = Date.now()
const t = (offsetSeconds: number) => NOW - offsetSeconds * 1000

// User messages
const userMsg1 = {
  id: 'user-1',
  role: 'user' as const,
  time: { created: t(120) },
}
const userMsg2 = {
  id: 'user-2',
  role: 'user' as const,
  time: { created: t(60) },
}

// Assistant messages (each run has one or more)
const assistantMsg1 = {
  id: 'asst-1',
  role: 'assistant' as const,
  time: { created: t(115), completed: t(100) },
}
const assistantMsg2 = {
  id: 'asst-2',
  role: 'assistant' as const,
  time: { created: t(55), completed: t(30) },
}

const groups: GroupedMessage[] = [
  { type: 'user', message: userMsg1 },
  {
    type: 'run',
    run: {
      id: 'run-1',
      messages: [assistantMsg1],
      isComplete: true,
      isStreaming: false,
      summaryText: 'Read 3 files, identified the staleTime misconfiguration',
      finalTextPart: {
        messageId: 'asst-1',
        partIndex: 3,
        text: 'The issue is your default `staleTime` is 0.',
      },
      stats: {
        toolCount: 3,
        messageCount: 1,
        thinkingDurationMs: 4200,
        textPartCount: 1,
        toolCategories: new Set(['read', 'search'] as const),
      },
    },
  },
  { type: 'user', message: userMsg2 },
  {
    type: 'run',
    run: {
      id: 'run-2',
      messages: [assistantMsg2],
      isComplete: true,
      isStreaming: false,
      summaryText: 'Patched QueryClient config and updated the staleTime',
      finalTextPart: {
        messageId: 'asst-2',
        partIndex: 5,
        text: 'Done — staleTime set to 60s, cache flicker resolved.',
      },
      stats: {
        toolCount: 2,
        messageCount: 1,
        thinkingDurationMs: 2100,
        textPartCount: 2,
        toolCategories: new Set(['read', 'edit'] as const),
      },
    },
  },
]

// Part map — parts keyed by message ID
const partMap: Record<string, SessionPart[]> = {
  'user-1': [
    {
      type: 'text',
      text: 'Can you help me debug why my React Query cache is not working? Every component mount triggers a refetch even for data that was just fetched.',
    },
  ],
  'user-2': [
    {
      type: 'text',
      text: 'Perfect, please fix it — set staleTime to 60 seconds globally.',
    },
  ],
  'asst-1': [
    {
      type: 'reasoning',
      text: 'The user is experiencing stale data refetches on mount. Default staleTime in TanStack Query v5 is 0, which causes this. I should read their QueryClient setup to confirm.',
      time: { start: t(115), end: t(112) },
    },
    {
      type: 'tool',
      id: 'tool-1',
      tool: 'read',
      callID: 'call-1',
      state: {
        status: 'completed',
        input: { path: 'src/lib/query-client.ts' },
        output: 'export const queryClient = new QueryClient()',
        time: { start: t(112), end: t(111) },
      },
    },
    {
      type: 'tool',
      id: 'tool-2',
      tool: 'grep',
      callID: 'call-2',
      state: {
        status: 'completed',
        input: { pattern: 'staleTime', path: 'src' },
        output: 'No matches found.',
        time: { start: t(111), end: t(110) },
      },
    },
    {
      type: 'tool',
      id: 'tool-3',
      tool: 'glob',
      callID: 'call-3',
      state: {
        status: 'completed',
        input: { pattern: 'src/**/*.ts' },
        output: 'src/lib/query-client.ts\nsrc/hooks/useData.ts\nsrc/app/layout.tsx',
        time: { start: t(110), end: t(109) },
      },
    },
    {
      type: 'text',
      text: `The issue is your default \`staleTime\` is \`0\`, which is the TanStack Query v5 default. This means React Query considers all cached data immediately stale, triggering a background refetch on every component mount.

Your current setup:

\`\`\`typescript
export const queryClient = new QueryClient()
// No defaultOptions — staleTime defaults to 0ms
\`\`\`

No \`staleTime\` configuration was found anywhere in the codebase. Set it globally to fix the flicker.`,
    },
  ],
  'asst-2': [
    {
      type: 'tool',
      id: 'tool-4',
      tool: 'read',
      callID: 'call-4',
      state: {
        status: 'completed',
        input: { path: 'src/lib/query-client.ts' },
        output: 'export const queryClient = new QueryClient()',
        time: { start: t(55), end: t(54) },
      },
    },
    {
      type: 'tool',
      id: 'tool-5',
      tool: 'edit',
      callID: 'call-5',
      state: {
        status: 'completed',
        input: {
          path: 'src/lib/query-client.ts',
          old_string: 'new QueryClient()',
          new_string: 'new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })',
        },
        output: 'File updated.',
        time: { start: t(54), end: t(53) },
      },
    },
    {
      type: 'text',
      text: `Done. Updated \`src/lib/query-client.ts\`:

\`\`\`typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 60 seconds
    },
  },
})
\`\`\`

Cached data is now considered fresh for 60 seconds. Components that mount within that window will read from cache without triggering a refetch.`,
    },
  ],
}

// ---------------------------------------------------------------------------
// Interactive wrapper — handles collapse state
// ---------------------------------------------------------------------------

function InteractiveMessageList({
  groups: g,
  partMap: pm,
}: {
  groups: GroupedMessage[]
  partMap: Record<string, SessionPart[]>
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  return (
    <MessageList
      groups={g}
      partMap={pm}
      isCollapsed={(runId) => collapsed[runId] ?? false}
      onToggleCollapse={(runId) =>
        setCollapsed((prev) => ({ ...prev, [runId]: !prev[runId] }))
      }
    />
  )
}

export const FullConversation: Story = {
  render: () => <InteractiveMessageList groups={groups} partMap={partMap} />,
}

export const WithCollapsedRuns: Story = {
  render: () => {
    // Render with runs collapsed by default
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
      'run-1': true,
      'run-2': true,
    })
    return (
      <MessageList
        groups={groups}
        partMap={partMap}
        isCollapsed={(runId) => collapsed[runId] ?? false}
        onToggleCollapse={(runId) =>
          setCollapsed((prev) => ({ ...prev, [runId]: !prev[runId] }))
        }
      />
    )
  },
}

export const StreamingRun: Story = {
  render: () => {
    const streamingGroups: GroupedMessage[] = [
      { type: 'user', message: userMsg1 },
      {
        type: 'run',
        run: {
          id: 'run-streaming',
          messages: [assistantMsg1],
          isComplete: false,
          isStreaming: true,
          summaryText: null,
          finalTextPart: null,
          stats: {
            toolCount: 1,
            messageCount: 1,
            thinkingDurationMs: 0,
            textPartCount: 0,
            toolCategories: new Set(['read'] as const),
          },
        },
      },
    ]
    const streamingPartMap: Record<string, SessionPart[]> = {
      'user-1': partMap['user-1'],
      'asst-1': [
        {
          type: 'tool',
          id: 'tool-1',
          tool: 'read',
          callID: 'call-1',
          state: {
            status: 'running',
            input: { path: 'src/lib/query-client.ts' },
            time: { start: t(2) },
          },
        },
      ],
    }
    return (
      <MessageList
        groups={streamingGroups}
        partMap={streamingPartMap}
        isCollapsed={() => false}
        onToggleCollapse={() => {}}
      />
    )
  },
}

export const OnlyUserMessages: Story = {
  render: () => (
    <MessageList
      groups={[
        { type: 'user', message: userMsg1 },
        { type: 'user', message: userMsg2 },
      ]}
      partMap={partMap}
      isCollapsed={() => false}
      onToggleCollapse={() => {}}
    />
  ),
}
