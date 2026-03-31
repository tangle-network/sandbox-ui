import type { Meta, StoryObj } from '@storybook/react'
import { ExpandedToolDetail } from '../../run/expanded-tool-detail'
import type { ToolPart } from '../../types/parts'

const NOW = Date.now()

// -- Fixtures --

const bashPart: ToolPart = {
  type: 'tool',
  id: 'etd-bash-1',
  tool: 'bash',
  state: {
    status: 'completed',
    input: { command: 'pnpm test --run --reporter=verbose 2>&1 | tail -30' },
    output: `> sandbox-ui@0.4.0 test\n> vitest run --reporter=verbose\n\n stdout | src/utils/format.test.ts\n\n ✓ src/utils/format.test.ts (4)\n   ✓ formatDuration returns ms for values under 1000\n   ✓ formatDuration returns seconds for values 1000-59999\n   ✓ formatDuration returns minutes for large values\n   ✓ truncateText trims at word boundary\n\n ✓ src/utils/tool-display.test.ts (11)\n   ✓ getToolCategory maps bash correctly\n   ✓ getToolCategory maps read correctly\n   ✓ getToolDisplayMetadata builds bash title\n   ✓ getToolDisplayMetadata builds file path\n   ... (8 more)\n\nTest Files  2 passed (2)\n     Tests  15 passed (15)\n  Duration  1.42s`,
    time: { start: NOW - 3800, end: NOW - 2380 },
  },
}

const bashError: ToolPart = {
  type: 'tool',
  id: 'etd-bash-error',
  tool: 'bash',
  state: {
    status: 'error',
    input: { command: 'pnpm test --run' },
    error: `FAIL src/components/RunGroup.test.tsx\n  ● RunGroup › renders tool parts\n\n    TypeError: Cannot read properties of undefined (reading 'map')\n\n      40 |   const allParts = useMemo(() => {\n      41 |     const parts = []\n    > 42 |     for (const msg of run.messages.map(m => m.id)) {\n         |                                        ^\n      43 |       const msgParts = partMap[msg] ?? []\n\n      at RunGroup (src/run/run-group.tsx:42:40)`,
    time: { start: NOW - 2100, end: NOW - 1600 },
  },
}

const readFilePart: ToolPart = {
  type: 'tool',
  id: 'etd-read-1',
  tool: 'read',
  state: {
    status: 'completed',
    input: { file_path: '/home/user/project/src/run/run-group.tsx' },
    output: `import { memo, useMemo, type ReactNode } from 'react'\nimport type { Run } from '../types/run'\nimport type { SessionPart } from '../types/parts'\n\nexport interface RunGroupProps {\n  run: Run\n  partMap: Record<string, SessionPart[]>\n  collapsed: boolean\n  onToggle: () => void\n}\n\nexport const RunGroup = memo(({ run, partMap, collapsed, onToggle }: RunGroupProps) => {\n  const allParts = useMemo(() => {\n    const parts: Array<{ part: SessionPart; msgId: string; index: number }> = []\n    for (const msg of run.messages) {\n      const msgParts = partMap[msg.id] ?? []\n      msgParts.forEach((part, index) => parts.push({ part, msgId: msg.id, index }))\n    }\n    return parts\n  }, [run.messages, partMap])\n  // ...\n})`,
    time: { start: NOW - 1200, end: NOW - 1140 },
  },
}

const writeFilePart: ToolPart = {
  type: 'tool',
  id: 'etd-write-1',
  tool: 'write',
  state: {
    status: 'completed',
    input: {
      file_path: '/home/user/project/src/utils/format.ts',
      content: `export function formatDuration(ms: number): string {\n  if (ms < 1000) return \`\${ms}ms\`\n  if (ms < 60_000) return \`\${(ms / 1000).toFixed(1)}s\`\n  const m = Math.floor(ms / 60_000)\n  const s = Math.floor((ms % 60_000) / 1000)\n  return \`\${m}m \${s}s\`\n}\n\nexport function truncateText(text: string, maxLength: number): string {\n  if (text.length <= maxLength) return text\n  const truncated = text.slice(0, maxLength)\n  const lastSpace = truncated.lastIndexOf(' ')\n  return (lastSpace > maxLength * 0.8 ? truncated.slice(0, lastSpace) : truncated) + '…'\n}`,
    },
    output: 'File written successfully.',
    time: { start: NOW - 900, end: NOW - 855 },
  },
}

const webSearchPart: ToolPart = {
  type: 'tool',
  id: 'etd-web-1',
  tool: 'web_search',
  state: {
    status: 'completed',
    input: { query: 'vitest mock module hoisting typescript esm' },
    output: JSON.stringify({
      results: [
        {
          title: 'Mocking | Vitest',
          url: 'https://vitest.dev/guide/mocking',
          snippet: 'Vitest supports mocking modules and auto-mocking via vi.mock(). Module mocks are hoisted to the top of the file.',
        },
        {
          title: 'vi.mock() | Vitest API',
          url: 'https://vitest.dev/api/vi#vi-mock',
          snippet: 'Mocks a module. Calls to vi.mock are hoisted before any import statements.',
        },
        {
          title: 'ESM module mocking with Vitest',
          url: 'https://github.com/vitest-dev/vitest/discussions/1204',
          snippet: 'When using ESM, vi.mock must be called in the same file as the import you want to mock.',
        },
      ],
    }, null, 2),
    time: { start: NOW - 2800, end: NOW - 1900 },
  },
}

const grepPart: ToolPart = {
  type: 'tool',
  id: 'etd-grep-1',
  tool: 'grep',
  state: {
    status: 'completed',
    input: { pattern: 'partMap\\[', path: 'src/' },
    output: `src/run/run-group.tsx:184:      const msgParts = partMap[msg.id] ?? []\nsrc/run/run-group.tsx:291:        key={key}\nsrc/hooks/useRunGroup.ts:44:    setPartMap(prev => ({ ...prev, [msgId]: parts }))`,
    time: { start: NOW - 600, end: NOW - 560 },
  },
}

const runningPart: ToolPart = {
  type: 'tool',
  id: 'etd-running',
  tool: 'bash',
  state: {
    status: 'running',
    input: { command: 'pnpm build --no-cache' },
    time: { start: NOW - 8000 },
  },
}

const genericPart: ToolPart = {
  type: 'tool',
  id: 'etd-generic',
  tool: 'custom_tool',
  state: {
    status: 'completed',
    input: { sessionId: 'sess_abc123', action: 'snapshot', format: 'json' },
    output: { snapshotId: 'snap_xyz789', size: 1048576, timestamp: NOW - 500 },
    time: { start: NOW - 1500, end: NOW - 1200 },
  },
}

// --

const meta: Meta<typeof ExpandedToolDetail> = {
  title: 'Run/ExpandedToolDetail',
  component: ExpandedToolDetail,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof ExpandedToolDetail>

const wrap = (children: React.ReactNode) => (
  <div className="p-6 max-w-2xl">{children}</div>
)

export const BashCommand: Story = {
  args: { part: bashPart },
  render: (args) => wrap(<ExpandedToolDetail {...args} />),
}

export const BashError: Story = {
  args: { part: bashError },
  render: (args) => wrap(<ExpandedToolDetail {...args} />),
}

export const ReadFile: Story = {
  args: { part: readFilePart },
  render: (args) => wrap(<ExpandedToolDetail {...args} />),
}

export const WriteFile: Story = {
  args: { part: writeFilePart },
  render: (args) => wrap(<ExpandedToolDetail {...args} />),
}

export const WebSearch: Story = {
  args: { part: webSearchPart },
  render: (args) => wrap(<ExpandedToolDetail {...args} />),
}

export const GrepResults: Story = {
  args: { part: grepPart },
  render: (args) => wrap(<ExpandedToolDetail {...args} />),
}

export const Running: Story = {
  args: { part: runningPart },
  render: (args) => wrap(<ExpandedToolDetail {...args} />),
}

export const GenericFallback: Story = {
  name: 'Generic (fallback view)',
  args: { part: genericPart },
  render: (args) => wrap(<ExpandedToolDetail {...args} />),
}
