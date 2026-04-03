import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { RunGroup } from '../../run/run-group'
import type { Run } from '../../types/run'
import type { SessionPart, ToolPart, ReasoningPart, TextPart } from '../../types/parts'
import type { AgentBranding } from '../../types/branding'

const NOW = Date.now()

// -- Helpers --

function msg(id: string) {
  return { id, role: 'assistant' as const }
}

function toolPart(
  id: string,
  tool: string,
  status: ToolPart['state']['status'],
  input: unknown,
  output?: unknown,
  error?: string,
  durationMs?: number,
): ToolPart {
  const start = NOW - (durationMs ?? 0) - 1000
  return {
    type: 'tool',
    id,
    tool,
    state: {
      status,
      input,
      output,
      error,
      time: {
        start,
        end: status === 'completed' || status === 'error' ? start + (durationMs ?? 500) : undefined,
      },
    },
  }
}

function reasoningPart(text: string, durationMs: number): ReasoningPart {
  return {
    type: 'reasoning',
    text,
    time: { start: NOW - durationMs - 2000, end: NOW - 2000 },
  }
}

function textPart(text: string): TextPart {
  return { type: 'text', text }
}

// -- Scenario: complete debugging run --

const debugMsg1 = msg('msg-1')
const debugMsg2 = msg('msg-2')
const debugMsg3 = msg('msg-3')

const debugPartMap: Record<string, SessionPart[]> = {
  'msg-1': [
    reasoningPart(
      `The user wants me to fix the failing test. Let me read the failing test first, then look at the implementation to understand the root cause.

I should avoid guessing — grep for the actual error message pattern to find where it originates, then trace backwards to the source.`,
      8400,
    ),
    toolPart('t1', 'bash', 'completed', { command: 'pnpm test --run 2>&1 | head -40' },
      `FAIL src/run/run-group.test.ts\n  ● RunGroup › renders tool parts\n\n    TypeError: Cannot read properties of undefined (reading 'map')\n      at RunGroup (src/run/run-group.tsx:42:40)\n      at render (/node_modules/@testing-library/react/pure.js:55:22)`,
      undefined, 1240),
    toolPart('t2', 'read', 'completed', { file_path: '/home/user/project/src/run/run-group.test.ts' },
      `import { render } from '@testing-library/react'\nimport { RunGroup } from '../run-group'\n\nconst mockRun = { id: 'run-1', messages: [{ id: 'msg-a', role: 'assistant' }], ... }\n\nit('renders tool parts', () => {\n  render(<RunGroup run={mockRun} partMap={undefined} collapsed={false} onToggle={() => {}} />)\n})`,
      undefined, 58),
  ],
  'msg-2': [
    toolPart('t3', 'grep', 'completed', { pattern: 'partMap', path: 'src/run/run-group.tsx' },
      `src/run/run-group.tsx:184:    const msgParts = partMap[msg.id] ?? []\nsrc/run/run-group.tsx:287:  }, [run.messages, partMap])`,
      undefined, 44),
    toolPart('t4', 'edit', 'completed',
      { file_path: '/home/user/project/src/run/run-group.tsx', old_string: '{ run, partMap, collapsed', new_string: '{ run, partMap = {}, collapsed' },
      'Edit applied.',
      undefined, 30),
    toolPart('t5', 'bash', 'completed', { command: 'pnpm test --run src/run/run-group.test.ts' },
      ` ✓ src/run/run-group.test.ts (3)\n\nTest Files  1 passed (1)\n     Tests  3 passed (3)\n  Duration  1.21s`,
      undefined, 1210),
  ],
  'msg-3': [
    textPart(
      'Fixed. The test was passing `partMap={undefined}` but the component destructured it without a default. Adding `partMap = {}` as a default parameter makes the component safe when callers omit the prop. All 3 tests pass.',
    ),
  ],
}

const debugRun: Run = {
  id: 'run-debug',
  messages: [debugMsg1, debugMsg2, debugMsg3],
  isComplete: true,
  isStreaming: false,
  summaryText: 'Fixed failing RunGroup test by adding default parameter for partMap.',
  finalTextPart: { messageId: 'msg-3', partIndex: 0, text: 'Fixed. The test was passing...' },
  stats: {
    toolCount: 5,
    messageCount: 3,
    thinkingDurationMs: 8400,
    textPartCount: 1,
    toolCategories: new Set(['command', 'read', 'search', 'edit']),
  },
}

// -- Scenario: streaming run --

const streamMsg1 = msg('stream-msg-1')

const streamPartMap: Record<string, SessionPart[]> = {
  'stream-msg-1': [
    reasoningPart(
      `The user wants me to add minute-level formatting to formatDuration. I need to:\n1. Update the implementation\n2. Update the tests\n3. Run tests to verify`,
      0, // still active — would normally have no endTime but for story we set a duration
    ),
    toolPart('st1', 'read', 'completed', { file_path: '/home/user/project/src/utils/format.ts' },
      `export function formatDuration(ms: number): string {\n  if (ms < 1000) return \`\${ms}ms\`\n  return \`\${(ms / 1000).toFixed(1)}s\`\n}`,
      undefined, 42),
    toolPart('st2', 'write', 'running', { file_path: '/home/user/project/src/utils/format.ts' },
      undefined, undefined, undefined),
  ],
}

const streamRun: Run = {
  id: 'run-stream',
  messages: [streamMsg1],
  isComplete: false,
  isStreaming: true,
  summaryText: null,
  finalTextPart: null,
  stats: {
    toolCount: 2,
    messageCount: 1,
    thinkingDurationMs: 6200,
    textPartCount: 0,
    toolCategories: new Set(['read', 'write']),
  },
}

// -- Scenario: error run --

const errMsg1 = msg('err-msg-1')

const errPartMap: Record<string, SessionPart[]> = {
  'err-msg-1': [
    toolPart('e1', 'bash', 'completed', { command: 'pnpm build' },
      undefined,
      `error TS2322: Type 'string | undefined' is not assignable to type 'string'.\n  src/utils/format.ts:8:5\n\nerror TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.\n  src/run/run-item-primitives.tsx:6:48\n\nFound 2 errors.`,
      3200),
    toolPart('e2', 'edit', 'completed',
      { file_path: '/home/user/project/src/utils/format.ts', old_string: 'ms: number', new_string: 'ms: number | undefined' },
      'Edit applied.', undefined, 31),
    toolPart('e3', 'edit', 'error',
      { file_path: '/home/user/project/src/run/run-item-primitives.tsx' },
      undefined,
      'Edit failed: old_string not found in file. The text may have been modified by a previous edit.',
      22),
    textPart('The second edit failed because the file was already modified. Let me re-read it and apply the correct patch.'),
  ],
}

const errRun: Run = {
  id: 'run-error',
  messages: [errMsg1],
  isComplete: true,
  isStreaming: false,
  summaryText: 'Attempted to fix TypeScript build errors; one edit failed.',
  finalTextPart: null,
  stats: {
    toolCount: 3,
    messageCount: 1,
    thinkingDurationMs: 0,
    textPartCount: 1,
    toolCategories: new Set(['command', 'edit']),
  },
}

// -- Scenario: single tool call (minimal) --

const minimalMsg = msg('min-msg-1')
const minimalPartMap: Record<string, SessionPart[]> = {
  'min-msg-1': [
    toolPart('m1', 'bash', 'completed', { command: 'ls -la' },
      'total 48\ndrwxr-xr-x  8 user user 4096 Mar 30 12:00 .\ndrwxr-xr-x 22 user user 4096 Mar 30 11:58 ..',
      undefined, 88),
    textPart('The directory is empty except for the standard dot entries.'),
  ],
}

const minimalRun: Run = {
  id: 'run-minimal',
  messages: [minimalMsg],
  isComplete: true,
  isStreaming: false,
  summaryText: 'Listed directory contents.',
  finalTextPart: { messageId: 'min-msg-1', partIndex: 1, text: 'The directory is empty...' },
  stats: {
    toolCount: 1,
    messageCount: 1,
    thinkingDurationMs: 0,
    textPartCount: 1,
    toolCategories: new Set(['command']),
  },
}

// -- Custom branding --

const customBranding: AgentBranding = {
  label: 'Sandbox Agent',
  accentClass: 'text-violet-400',
  bgClass: 'bg-violet-500/8',
  containerBgClass: 'bg-muted/60',
  borderClass: 'border-violet-500/30',
  iconClass: '',
  textClass: 'text-violet-300',
}

// -- Controlled wrapper --

function ControlledRunGroup(props: Omit<React.ComponentProps<typeof RunGroup>, 'collapsed' | 'onToggle'>) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <RunGroup
      {...props}
      collapsed={collapsed}
      onToggle={() => setCollapsed((c) => !c)}
    />
  )
}

// --

const meta: Meta<typeof RunGroup> = {
  title: 'Run/RunGroup',
  component: RunGroup,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof RunGroup>

export const CompleteDebuggingRun: Story = {
  name: 'Complete — debugging run',
  render: () => (
    <div className="p-6 max-w-3xl">
      <ControlledRunGroup run={debugRun} partMap={debugPartMap} />
    </div>
  ),
}

export const Streaming: Story = {
  name: 'Streaming — in progress',
  render: () => (
    <div className="p-6 max-w-3xl">
      <ControlledRunGroup run={streamRun} partMap={streamPartMap} />
    </div>
  ),
}

export const WithErrors: Story = {
  name: 'Complete — with tool errors',
  render: () => (
    <div className="p-6 max-w-3xl">
      <ControlledRunGroup run={errRun} partMap={errPartMap} />
    </div>
  ),
}

export const Minimal: Story = {
  name: 'Minimal — single tool + text',
  render: () => (
    <div className="p-6 max-w-3xl">
      <ControlledRunGroup run={minimalRun} partMap={minimalPartMap} />
    </div>
  ),
}

export const Collapsed: Story = {
  name: 'Collapsed state',
  render: () => (
    <div className="p-6 max-w-3xl">
      <RunGroup
        run={debugRun}
        partMap={debugPartMap}
        collapsed={true}
        onToggle={() => {}}
      />
    </div>
  ),
}

export const CustomBranding: Story = {
  name: 'Custom branding',
  render: () => (
    <div className="p-6 max-w-3xl">
      <ControlledRunGroup
        run={debugRun}
        partMap={debugPartMap}
        branding={customBranding}
      />
    </div>
  ),
}

export const MultipleRuns: Story = {
  name: 'Multiple consecutive runs',
  render: () => (
    <div className="p-6 max-w-3xl space-y-4">
      <ControlledRunGroup run={minimalRun} partMap={minimalPartMap} />
      <ControlledRunGroup run={debugRun} partMap={debugPartMap} />
      <ControlledRunGroup run={errRun} partMap={errPartMap} />
    </div>
  ),
}
