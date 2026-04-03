import type { Meta, StoryObj } from '@storybook/react'
import { ToolCallFeed, type FeedSegment } from '../../run/tool-call-feed'

// -- Fixtures --

const debuggingSession: FeedSegment[] = [
  {
    kind: 'text',
    content: "I'll investigate the failing test and fix it. Let me start by finding the relevant files.",
  },
  {
    kind: 'tool_group',
    title: 'Exploration',
    calls: [
      {
        id: 'tc-glob-1',
        type: 'glob',
        label: 'Find **/*.test.{ts,tsx}',
        status: 'success',
        duration: 28,
        output: 'src/utils/format.test.ts\nsrc/utils/tool-display.test.ts\nsrc/run/run-group.test.ts',
      },
      {
        id: 'tc-read-1',
        type: 'read',
        label: 'Read src/run/run-group.test.ts',
        status: 'success',
        duration: 55,
        detail: 'src/run/run-group.test.ts',
        output: "import { render } from '@testing-library/react'\nimport { RunGroup } from '../run-group'\n\ndescribe('RunGroup', () => {\n  it('renders tool parts', () => { ... })\n})",
      },
      {
        id: 'tc-read-2',
        type: 'read',
        label: 'Read src/run/run-group.tsx',
        status: 'success',
        duration: 61,
        detail: 'src/run/run-group.tsx',
        output: 'const allParts = useMemo(() => {\n  const parts = []\n  for (const msg of run.messages) {\n    const msgParts = partMap[msg.id] ?? []\n    ...',
      },
    ],
  },
  {
    kind: 'text',
    content: "I see the issue. The test is passing `undefined` for `partMap` in one of the cases, but the component always expects a `Record<string, SessionPart[]>`. Let me check the test setup.",
  },
  {
    kind: 'tool_call',
    call: {
      id: 'tc-grep-1',
      type: 'grep',
      label: 'Search for partMap in run-group.test.ts',
      status: 'success',
      duration: 44,
      output: 'src/run/run-group.test.ts:18:  render(<RunGroup run={mockRun} partMap={undefined} collapsed={false} onToggle={jest.fn()} />)',
    },
  },
  {
    kind: 'text',
    content: "Found it — the test is passing `partMap={undefined}`. The prop type should default to `{}` rather than requiring the caller to pass a defined value. I'll add a default parameter.",
  },
  {
    kind: 'tool_call',
    call: {
      id: 'tc-edit-1',
      type: 'edit',
      label: 'Edit src/run/run-group.tsx',
      status: 'success',
      duration: 38,
      detail: 'Added partMap = {} default',
    },
  },
  {
    kind: 'tool_call',
    call: {
      id: 'tc-bash-1',
      type: 'bash',
      label: 'pnpm test --run src/run/run-group.test.ts',
      status: 'success',
      duration: 1240,
      output: ' ✓ src/run/run-group.test.ts (3)\n\nTest Files  1 passed (1)\n     Tests  3 passed (3)\n  Duration  1.24s',
    },
  },
  {
    kind: 'text',
    content: 'All tests pass. The fix was a one-line change: adding `partMap = {}` as a default parameter so callers that omit it (or pass `undefined`) get a safe empty map rather than a crash.',
  },
]

const multiPhaseSession: FeedSegment[] = [
  {
    kind: 'text',
    content: "I'll refactor the `formatDuration` utility to support minutes, add tests, and verify the full suite still passes.",
  },
  {
    kind: 'tool_group',
    title: 'Read current implementation',
    calls: [
      {
        id: 'mp-read-1',
        type: 'read',
        label: 'Read src/utils/format.ts',
        status: 'success',
        duration: 42,
        output: "export function formatDuration(ms: number): string {\n  if (ms < 1000) return `${ms}ms`\n  return `${(ms / 1000).toFixed(1)}s`\n}",
      },
      {
        id: 'mp-read-2',
        type: 'read',
        label: 'Read src/utils/format.test.ts',
        status: 'success',
        duration: 38,
        output: "describe('formatDuration', () => {\n  it('returns ms for sub-second values', ...)\n  it('returns seconds for 1000-59999ms', ...)\n})",
      },
    ],
  },
  {
    kind: 'tool_group',
    title: 'Implement changes',
    calls: [
      {
        id: 'mp-write-1',
        type: 'write',
        label: 'Write src/utils/format.ts',
        status: 'success',
        duration: 51,
        detail: 'Added minutes branch and truncateText helper',
      },
      {
        id: 'mp-write-2',
        type: 'write',
        label: 'Write src/utils/format.test.ts',
        status: 'success',
        duration: 48,
        detail: 'Added 3 new test cases for minutes and truncation',
      },
    ],
  },
  {
    kind: 'tool_call',
    call: {
      id: 'mp-bash-1',
      type: 'bash',
      label: 'pnpm test --run',
      status: 'success',
      duration: 1870,
      output: 'Test Files  3 passed (3)\n     Tests  18 passed (18)\n  Duration  1.87s',
    },
  },
  {
    kind: 'text',
    content: 'Done. `formatDuration` now returns `"2m 14s"` for values over 60 seconds. All 18 tests pass including the 3 new cases.',
  },
]

const streamingSession: FeedSegment[] = [
  {
    kind: 'text',
    content: "Let me run the full test suite and check for any issues.",
  },
  {
    kind: 'tool_call',
    call: {
      id: 'stream-bash-1',
      type: 'bash',
      label: 'pnpm test --run',
      status: 'running',
    },
  },
]

const errorSession: FeedSegment[] = [
  {
    kind: 'text',
    content: "Attempting to build the project.",
  },
  {
    kind: 'tool_call',
    call: {
      id: 'err-bash-1',
      type: 'bash',
      label: 'pnpm build',
      status: 'error',
      duration: 3200,
      detail: 'Build failed with TypeScript errors',
      output: `error TS2322: Type 'string | undefined' is not assignable to type 'string'.\n  src/utils/format.ts:8:5\n\nerror TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.\n  src/run/run-item-primitives.tsx:6:48\n\nFound 2 errors.`,
    },
  },
  {
    kind: 'text',
    content: "Two TypeScript errors. The first is in `format.ts` — I need to add a null guard before calling `.toFixed()`. The second is in `run-item-primitives.tsx` — `startTime` can be undefined per the `ToolTime` type.",
  },
  {
    kind: 'tool_group',
    title: 'Apply fixes',
    calls: [
      {
        id: 'err-edit-1',
        type: 'edit',
        label: 'Edit src/utils/format.ts',
        status: 'success',
        duration: 35,
        detail: 'Added undefined guard on ms parameter',
      },
      {
        id: 'err-edit-2',
        type: 'edit',
        label: 'Edit src/run/run-item-primitives.tsx',
        status: 'success',
        duration: 29,
        detail: 'Changed startTime prop type to number (non-optional at callsite)',
      },
    ],
  },
  {
    kind: 'tool_call',
    call: {
      id: 'err-bash-2',
      type: 'bash',
      label: 'pnpm build',
      status: 'success',
      duration: 4100,
      output: 'dist/index.js  42.3 kB\ndist/index.js.map  88.1 kB\n✓ built in 4.10s',
    },
  },
  {
    kind: 'text',
    content: 'Build succeeds. Both TypeScript errors resolved.',
  },
]

// --

const meta: Meta<typeof ToolCallFeed> = {
  title: 'Run/ToolCallFeed',
  component: ToolCallFeed,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof ToolCallFeed>

export const DebuggingSession: Story = {
  name: 'Debugging a failing test',
  args: { segments: debuggingSession },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallFeed {...args} />
    </div>
  ),
}

export const MultiPhaseRefactor: Story = {
  name: 'Multi-phase refactor',
  args: { segments: multiPhaseSession },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallFeed {...args} />
    </div>
  ),
}

export const Streaming: Story = {
  name: 'In-progress (running)',
  args: { segments: streamingSession },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallFeed {...args} />
    </div>
  ),
}

export const BuildErrorAndFix: Story = {
  name: 'Build error → fix → success',
  args: { segments: errorSession },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallFeed {...args} />
    </div>
  ),
}

export const Empty: Story = {
  args: { segments: [] },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallFeed {...args} />
      <p className="text-sm text-muted-foreground italic">(empty feed — renders nothing)</p>
    </div>
  ),
}
