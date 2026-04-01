import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Code, FileText } from 'lucide-react'
import { AgentTimeline } from '../../chat/agent-timeline'
import type { AgentTimelineItem } from '../../chat/agent-timeline'

const meta: Meta<typeof AgentTimeline> = {
  title: 'Chat/AgentTimeline',
  component: AgentTimeline,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-[var(--bg-root)]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof AgentTimeline>

const NOW = Date.now()
const t = (offsetSeconds: number) => new Date(NOW - offsetSeconds * 1000)

// ---------------------------------------------------------------------------
// Full coding session — agent answers a TypeScript question with tool use
// ---------------------------------------------------------------------------

const codingSession: AgentTimelineItem[] = [
  {
    id: 'user-1',
    kind: 'message',
    role: 'user',
    content:
      'I need a generic `Result<T, E>` type with helper functions for TypeScript. No external deps.',
    timestamp: t(180),
  },
  {
    id: 'status-start',
    kind: 'status',
    label: 'Planning implementation',
    detail: 'Analyzing requirements — generic Result type with Ok/Err constructors and combinators.',
    tone: 'info',
  },
  {
    id: 'tool-glob',
    kind: 'tool',
    call: {
      id: 'tc-1',
      type: 'glob',
      label: 'Find **/*.ts in src/',
      status: 'success',
      output:
        'src/index.ts\nsrc/types.ts\nsrc/utils/format.ts\nsrc/utils/parse.ts',
      duration: 18,
    },
  },
  {
    id: 'tool-read',
    kind: 'tool',
    call: {
      id: 'tc-2',
      type: 'read',
      label: 'Read src/types.ts',
      status: 'success',
      output:
        '// Existing types\nexport type Maybe<T> = T | null | undefined\nexport type Nullable<T> = T | null',
      duration: 31,
    },
  },
  {
    id: 'asst-1',
    kind: 'message',
    role: 'assistant',
    content:
      "Your existing `types.ts` has `Maybe` and `Nullable` — I'll add `Result<T, E>` alongside them and write it to the same file.",
    timestamp: t(150),
  },
  {
    id: 'tool-write',
    kind: 'tool',
    call: {
      id: 'tc-3',
      type: 'write',
      label: 'Write src/types.ts',
      status: 'success',
      output: 'File written — 47 lines added.',
      duration: 22,
    },
  },
  {
    id: 'tool-bash-test',
    kind: 'tool',
    call: {
      id: 'tc-4',
      type: 'bash',
      label: 'npx tsc --noEmit',
      status: 'success',
      detail: 'npx tsc --noEmit --strict',
      output: '✓ No type errors',
      duration: 1840,
    },
  },
  {
    id: 'status-done',
    kind: 'status',
    label: 'Type-checks clean',
    tone: 'success',
  },
  {
    id: 'asst-final',
    kind: 'message',
    role: 'assistant',
    content: `Here's the \`Result<T, E>\` implementation added to \`src/types.ts\`:

\`\`\`typescript
export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err<E> = { readonly ok: false; readonly error: E }
export type Result<T, E = Error> = Ok<T> | Err<E>

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })
export const err = <E>(error: E): Err<E> => ({ ok: false, error })

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback
}
\`\`\`

All helpers are zero-dependency and fully typed. \`tsc --strict\` passes clean.`,
    timestamp: t(120),
  },
  {
    id: 'artifact-types',
    kind: 'artifact',
    title: 'src/types.ts',
    description: 'Result<T, E> type + ok / err / map / flatMap / unwrapOr helpers',
    tone: 'success',
    icon: <FileText className="h-4 w-4" />,
    meta: <>47 lines added &middot; TypeScript &middot; Zero deps</>,
  },
]

export const CodingSession: Story = {
  args: {
    items: codingSession,
  },
}

// ---------------------------------------------------------------------------
// Session with thinking indicator active
// ---------------------------------------------------------------------------

export const WhileThinking: Story = {
  args: {
    items: [
      {
        id: 'user-1',
        kind: 'message',
        role: 'user',
        content: 'Implement a distributed rate limiter using Redis sorted sets.',
        timestamp: new Date(),
      },
      {
        id: 'status-planning',
        kind: 'status',
        label: 'Reading codebase',
        tone: 'info',
      },
      {
        id: 'tool-glob',
        kind: 'tool',
        call: {
          id: 'tc-1',
          type: 'glob',
          label: 'Find **/*.ts in src/',
          status: 'success',
          duration: 14,
        },
      },
    ],
    isThinking: true,
  },
}

// ---------------------------------------------------------------------------
// Tool group — parallel reads shown together
// ---------------------------------------------------------------------------

export const WithToolGroup: Story = {
  args: {
    items: [
      {
        id: 'user-1',
        kind: 'message',
        role: 'user',
        content:
          'Audit all the route handlers in src/routes/ and tell me which ones are missing auth middleware.',
        timestamp: t(90),
      },
      {
        id: 'tool-group-reads',
        kind: 'tool_group',
        title: 'Reading route files',
        calls: [
          {
            id: 'tc-1',
            type: 'read',
            label: 'Read src/routes/users.ts',
            status: 'success',
            output: "router.get('/', authMiddleware, listUsers)\nrouter.post('/', authMiddleware, createUser)",
            duration: 24,
          },
          {
            id: 'tc-2',
            type: 'read',
            label: 'Read src/routes/sessions.ts',
            status: 'success',
            output: "router.get('/', listSessions) // missing auth!\nrouter.delete('/:id', authMiddleware, deleteSession)",
            duration: 19,
          },
          {
            id: 'tc-3',
            type: 'read',
            label: 'Read src/routes/health.ts',
            status: 'success',
            output: "router.get('/', healthCheck) // intentionally public",
            duration: 11,
          },
        ],
      },
      {
        id: 'status-warn',
        kind: 'status',
        label: 'Auth gap found in sessions route',
        detail: 'GET /sessions is publicly accessible — no authMiddleware applied.',
        tone: 'warning',
      },
      {
        id: 'asst-1',
        kind: 'message',
        role: 'assistant',
        content: `Found one unprotected route:

| Route | File | Auth |
|-------|------|------|
| \`GET /users\` | users.ts | ✅ |
| \`POST /users\` | users.ts | ✅ |
| \`GET /sessions\` | sessions.ts | ❌ Missing |
| \`DELETE /sessions/:id\` | sessions.ts | ✅ |
| \`GET /health\` | health.ts | ✅ (intentional) |

**Fix:** add \`authMiddleware\` to \`router.get('/', ...)\` in \`sessions.ts\`.`,
        timestamp: t(60),
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

export const WithError: Story = {
  args: {
    items: [
      {
        id: 'user-1',
        kind: 'message',
        role: 'user',
        content: 'Run the test suite.',
        timestamp: t(30),
      },
      {
        id: 'tool-bash',
        kind: 'tool',
        call: {
          id: 'tc-1',
          type: 'bash',
          label: 'pnpm test',
          status: 'error',
          detail: 'pnpm test --run',
          output:
            'FAIL src/utils/parse.test.ts\n  ✕ parseDate handles invalid input (12ms)\n    Expected: { ok: false }\n    Received: { ok: true, value: Invalid Date }\n\nTest Suites: 1 failed, 4 passed\nTests:       1 failed, 31 passed',
          duration: 3400,
        },
      },
      {
        id: 'status-error',
        kind: 'status',
        label: '1 test failed — parseDate accepts Invalid Date',
        detail: 'src/utils/parse.test.ts:14 — parseDate should return Err for non-date strings.',
        tone: 'error',
      },
      {
        id: 'asst-1',
        kind: 'message',
        role: 'assistant',
        content: '`parseDate` returns `ok(new Date(str))` without validating `isNaN`. Fix: check `isNaN(result.getTime())` and return `err(...)` instead.',
        timestamp: t(10),
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Artifact handoff
// ---------------------------------------------------------------------------

export const WithArtifact: Story = {
  args: {
    items: [
      {
        id: 'user-1',
        kind: 'message',
        role: 'user',
        content: 'Generate an OpenAPI spec for the users API.',
        timestamp: t(60),
      },
      {
        id: 'tool-write',
        kind: 'tool',
        call: {
          id: 'tc-1',
          type: 'write',
          label: 'Write openapi.yaml',
          status: 'success',
          output: '187 lines written.',
          duration: 44,
        },
      },
      {
        id: 'asst-1',
        kind: 'message',
        role: 'assistant',
        content: 'OpenAPI 3.1 spec generated with all CRUD endpoints, request/response schemas, and error codes.',
        timestamp: t(30),
      },
      {
        id: 'artifact-spec',
        kind: 'artifact',
        title: 'openapi.yaml',
        description: 'OpenAPI 3.1 specification — Users API with auth, CRUD, and error schemas',
        tone: 'success',
        icon: <Code className="h-4 w-4" />,
        meta: <>187 lines &middot; OpenAPI 3.1 &middot; YAML</>,
        onClick: () => alert('Open openapi.yaml'),
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const Empty: Story = {
  args: {
    items: [],
    emptyState: (
      <div className="text-center text-sm text-muted-foreground">
        No messages yet — start a conversation.
      </div>
    ),
  },
}

// ---------------------------------------------------------------------------
// All status tones
// ---------------------------------------------------------------------------

export const StatusTones: Story = {
  args: {
    items: [
      {
        id: 's-default',
        kind: 'status',
        label: 'Default status',
        detail: 'Neutral informational message.',
        tone: 'default',
      },
      {
        id: 's-info',
        kind: 'status',
        label: 'Info status',
        detail: 'Agent is reading files.',
        tone: 'info',
      },
      {
        id: 's-success',
        kind: 'status',
        label: 'Success status',
        detail: 'All tests passed.',
        tone: 'success',
      },
      {
        id: 's-warning',
        kind: 'status',
        label: 'Warning status',
        detail: 'Unprotected route detected.',
        tone: 'warning',
      },
      {
        id: 's-error',
        kind: 'status',
        label: 'Error status',
        detail: '3 tests failed.',
        tone: 'error',
      },
    ],
  },
}
