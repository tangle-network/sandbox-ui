import type { Meta, StoryObj } from '@storybook/react'
import { InlineToolItem } from '../../run/inline-tool-item'
import type { ToolPart } from '../../types/parts'

const NOW = Date.now()

// -- Fixtures --

const bashComplete: ToolPart = {
  type: 'tool',
  id: 'tool-bash-1',
  tool: 'bash',
  state: {
    status: 'completed',
    input: { command: 'pnpm test --run --reporter=verbose' },
    output: `> test\n\n ✓ src/utils/format.test.ts (4)\n ✓ src/utils/tool-display.test.ts (11)\n\nTest Files  2 passed (2)\n     Tests  15 passed (15)\n  Duration  1.42s`,
    time: { start: NOW - 3800, end: NOW - 2380 },
  },
}

const bashRunning: ToolPart = {
  type: 'tool',
  id: 'tool-bash-running',
  tool: 'bash',
  state: {
    status: 'running',
    input: { command: 'pnpm build' },
    time: { start: NOW - 4200 },
  },
}

const bashError: ToolPart = {
  type: 'tool',
  id: 'tool-bash-error',
  tool: 'bash',
  state: {
    status: 'error',
    input: { command: 'pnpm test --run' },
    error: 'Process exited with code 1\nTypeError: Cannot read properties of undefined (reading \'map\')\n  at render (src/components/List.tsx:42:18)',
    time: { start: NOW - 2100, end: NOW - 1600 },
  },
}

const readFile: ToolPart = {
  type: 'tool',
  id: 'tool-read-1',
  tool: 'read',
  state: {
    status: 'completed',
    input: { file_path: '/home/user/project/src/components/Button.tsx' },
    output: `import { cn } from '../lib/utils'\n\nexport function Button({ children, variant = 'default', ...props }) {\n  return (\n    <button className={cn('px-4 py-2 rounded', variant)} {...props}>\n      {children}\n    </button>\n  )\n}`,
    time: { start: NOW - 1200, end: NOW - 1140 },
  },
}

const writeFile: ToolPart = {
  type: 'tool',
  id: 'tool-write-1',
  tool: 'write',
  state: {
    status: 'completed',
    input: {
      file_path: '/home/user/project/src/utils/format.ts',
      content: 'export function formatDuration(ms: number): string {\n  if (ms < 1000) return `${ms}ms`\n  return `${(ms / 1000).toFixed(1)}s`\n}',
    },
    output: 'File written successfully.',
    time: { start: NOW - 900, end: NOW - 855 },
  },
}

const webSearch: ToolPart = {
  type: 'tool',
  id: 'tool-web-1',
  tool: 'web_search',
  state: {
    status: 'completed',
    input: { query: 'vitest mock module typescript best practices 2024' },
    output: JSON.stringify([
      { title: 'Vitest Mocking Guide', url: 'https://vitest.dev/guide/mocking', snippet: 'Learn how to mock modules in Vitest...' },
      { title: 'Testing Library Best Practices', url: 'https://testing-library.com/docs/', snippet: 'Avoid implementation details...' },
    ]),
    time: { start: NOW - 2800, end: NOW - 1900 },
  },
}

const grepSearch: ToolPart = {
  type: 'tool',
  id: 'tool-grep-1',
  tool: 'grep',
  state: {
    status: 'completed',
    input: { pattern: 'useCallback', path: 'src/' },
    output: 'src/hooks/useSession.ts:14:  const handleMessage = useCallback((msg) => {\nsrc/hooks/useStream.ts:22:  const send = useCallback(async (text) => {\nsrc/components/Chat.tsx:88:  const onSubmit = useCallback(() => {',
    time: { start: NOW - 600, end: NOW - 560 },
  },
}

const editFile: ToolPart = {
  type: 'tool',
  id: 'tool-edit-1',
  tool: 'edit',
  state: {
    status: 'completed',
    input: {
      file_path: '/home/user/project/src/utils/format.ts',
      old_string: 'return `${(ms / 1000).toFixed(1)}s`',
      new_string: 'if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`\n  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`',
    },
    output: 'Edit applied.',
    time: { start: NOW - 450, end: NOW - 420 },
  },
}

// --

const meta: Meta<typeof InlineToolItem> = {
  title: 'Run/InlineToolItem',
  component: InlineToolItem,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof InlineToolItem>

export const BashComplete: Story = {
  args: { part: bashComplete, groupPosition: 'single' },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineToolItem {...args} />
    </div>
  ),
}

export const BashRunning: Story = {
  args: { part: bashRunning, groupPosition: 'single' },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineToolItem {...args} />
    </div>
  ),
}

export const BashError: Story = {
  args: { part: bashError, groupPosition: 'single' },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineToolItem {...args} />
    </div>
  ),
}

export const ReadFile: Story = {
  args: { part: readFile, groupPosition: 'single' },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineToolItem {...args} />
    </div>
  ),
}

export const WriteFile: Story = {
  args: { part: writeFile, groupPosition: 'single' },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineToolItem {...args} />
    </div>
  ),
}

export const WebSearch: Story = {
  args: { part: webSearch, groupPosition: 'single' },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineToolItem {...args} />
    </div>
  ),
}

export const GrepSearch: Story = {
  args: { part: grepSearch, groupPosition: 'single' },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineToolItem {...args} />
    </div>
  ),
}

export const EditFile: Story = {
  args: { part: editFile, groupPosition: 'single' },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineToolItem {...args} />
    </div>
  ),
}

/** Three consecutive tool calls showing group position rounding. */
export const GroupedSequence: Story = {
  render: () => (
    <div className="p-6 max-w-2xl space-y-0.5">
      <InlineToolItem part={readFile} groupPosition="first" />
      <InlineToolItem part={grepSearch} groupPosition="middle" />
      <InlineToolItem part={editFile} groupPosition="last" />
    </div>
  ),
}

export const AllStates: Story = {
  render: () => (
    <div className="p-6 max-w-2xl space-y-3">
      <p className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] px-1">Completed</p>
      <InlineToolItem part={bashComplete} groupPosition="single" />
      <p className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] px-1 pt-2">Running</p>
      <InlineToolItem part={bashRunning} groupPosition="single" />
      <p className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] px-1 pt-2">Error</p>
      <InlineToolItem part={bashError} groupPosition="single" />
    </div>
  ),
}
