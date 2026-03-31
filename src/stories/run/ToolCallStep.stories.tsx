import type { Meta, StoryObj } from '@storybook/react'
import { ToolCallStep, ToolCallGroup } from '../../run/tool-call-step'

const meta: Meta<typeof ToolCallStep> = {
  title: 'Run/ToolCallStep',
  component: ToolCallStep,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof ToolCallStep>

// -- Single step stories --

export const BashSuccess: Story = {
  args: {
    type: 'bash',
    label: 'pnpm test --run --reporter=verbose',
    status: 'success',
    duration: 1420,
    output: `Test Files  2 passed (2)\n     Tests  15 passed (15)\n  Duration  1.42s`,
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

export const BashRunning: Story = {
  args: {
    type: 'bash',
    label: 'pnpm build',
    status: 'running',
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

export const BashError: Story = {
  args: {
    type: 'bash',
    label: 'pnpm test --run',
    status: 'error',
    duration: 890,
    detail: 'src/components/RunGroup.test.tsx',
    output: `FAIL src/components/RunGroup.test.tsx\n  ● RunGroup › renders tool parts\n\n    TypeError: Cannot read properties of undefined (reading 'map')\n      at RunGroup (src/run/run-group.tsx:42:40)`,
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

export const ReadFile: Story = {
  args: {
    type: 'read',
    label: 'Read src/run/run-group.tsx',
    status: 'success',
    duration: 62,
    detail: '/home/user/project/src/run/run-group.tsx',
    output: `import { memo, useMemo } from 'react'\nexport const RunGroup = memo(({ run, partMap, ...`,
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

export const WriteFile: Story = {
  args: {
    type: 'write',
    label: 'Write src/utils/format.ts',
    status: 'success',
    duration: 45,
    detail: '/home/user/project/src/utils/format.ts',
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

export const EditFile: Story = {
  args: {
    type: 'edit',
    label: 'Edit src/run/run-group.tsx',
    status: 'success',
    duration: 38,
    detail: 'Replaced 3 lines at L42',
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

export const GlobFind: Story = {
  args: {
    type: 'glob',
    label: 'Find **/*.test.ts',
    status: 'success',
    duration: 28,
    output: `src/utils/format.test.ts\nsrc/utils/tool-display.test.ts\nsrc/run/run-group.test.ts`,
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

export const GrepSearch: Story = {
  args: {
    type: 'grep',
    label: 'Search for partMap\\[',
    status: 'success',
    duration: 44,
    output: `src/run/run-group.tsx:184:  const msgParts = partMap[msg.id] ?? []\nsrc/hooks/useRunGroup.ts:44:  setPartMap(prev => ({ ...prev, [msgId]: parts }))`,
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

export const NoExpandable: Story = {
  name: 'No detail/output (not expandable)',
  args: {
    type: 'bash',
    label: 'git add -p',
    status: 'success',
    duration: 120,
  },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <ToolCallStep {...args} />
    </div>
  ),
}

// -- Group stories --

export const GroupedToolCalls: Story = {
  name: 'ToolCallGroup — exploration phase',
  render: () => (
    <div className="p-6 max-w-2xl">
      <ToolCallGroup title="Exploration">
        <ToolCallStep type="glob" label="Find **/*.test.ts" status="success" duration={28} output="src/utils/format.test.ts\nsrc/utils/tool-display.test.ts\nsrc/run/run-group.test.ts" />
        <ToolCallStep type="read" label="Read src/run/run-group.tsx" status="success" duration={62} detail="Checking for partMap access patterns" output="export const RunGroup = memo(({ run, partMap, ..." />
        <ToolCallStep type="grep" label="Search for partMap\[" status="success" duration={44} output="src/run/run-group.tsx:184\nsrc/hooks/useRunGroup.ts:44" />
      </ToolCallGroup>
    </div>
  ),
}

export const MixedStatuses: Story = {
  name: 'Mixed statuses in a group',
  render: () => (
    <div className="p-6 max-w-2xl">
      <ToolCallGroup title="Test cycle">
        <ToolCallStep type="bash" label="pnpm test --run src/utils/" status="success" duration={890} />
        <ToolCallStep type="edit" label="Edit src/run/run-group.tsx" status="success" duration={38} />
        <ToolCallStep type="bash" label="pnpm test --run" status="error" duration={740} output="FAIL src/run/run-group.test.ts\n  ● 1 test failed" />
        <ToolCallStep type="bash" label="pnpm test --run" status="running" />
      </ToolCallGroup>
    </div>
  ),
}

export const AllTypes: Story = {
  render: () => (
    <div className="p-6 max-w-2xl space-y-2">
      <p className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] px-1 pb-1">All tool types</p>
      <ToolCallStep type="bash" label="npm run build" status="success" duration={4200} />
      <ToolCallStep type="read" label="Read package.json" status="success" duration={18} />
      <ToolCallStep type="write" label="Write dist/index.js" status="success" duration={55} />
      <ToolCallStep type="edit" label="Edit tsconfig.json" status="success" duration={30} />
      <ToolCallStep type="glob" label="Find src/**/*.tsx" status="success" duration={22} />
      <ToolCallStep type="grep" label="Search for export default" status="success" duration={66} />
      <ToolCallStep type="list" label="List node_modules/.cache" status="success" duration={14} />
      <ToolCallStep type="download" label="Download schema.json" status="success" duration={380} />
      <ToolCallStep type="inspect" label="Inspect bundle size" status="running" />
      <ToolCallStep type="audit" label="Audit dependencies" status="error" duration={1100} />
    </div>
  ),
}
