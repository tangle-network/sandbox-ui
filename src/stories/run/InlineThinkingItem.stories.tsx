import type { Meta, StoryObj } from '@storybook/react'
import { InlineThinkingItem } from '../../run/inline-thinking-item'
import type { ReasoningPart } from '../../types/parts'

const NOW = Date.now()

// -- Fixtures --

const thinkingComplete: ReasoningPart = {
  type: 'reasoning',
  text: `The user wants me to fix the failing test in \`src/utils/format.test.ts\`. Let me read the test file first to understand what's expected, then look at the implementation.

The error says "Cannot read properties of undefined (reading 'map')" at line 42. This usually means the data array is undefined — likely an async fetch that hasn't resolved yet.

I should:
1. Read the failing test file
2. Read the implementation
3. Check if there's a missing await or an unhandled promise
4. Fix the issue and re-run tests to confirm`,
  time: { start: NOW - 12400, end: NOW - 6800 },
}

const thinkingActive: ReasoningPart = {
  type: 'reasoning',
  text: `I need to carefully think about the approach here. The test is expecting...`,
  time: { start: NOW - 3000 },
}

const thinkingShort: ReasoningPart = {
  type: 'reasoning',
  text: 'Read the file, check the types, apply the fix.',
  time: { start: NOW - 800, end: NOW - 500 },
}

const thinkingLong: ReasoningPart = {
  type: 'reasoning',
  text: `This is a complex TypeScript type error. Let me trace through the issue systematically.

The component \`RunGroup\` accepts a \`partMap\` of type \`Record<string, SessionPart[]>\`. When we flatten the parts, we iterate \`run.messages\` and look up each message ID in the map. The issue is that \`run.messages\` contains message IDs that might not exist in \`partMap\` yet — this happens during streaming when parts arrive before the message index is updated.

The fix is straightforward: add a null-coalescing fallback (\`?? []\`) when accessing \`partMap[msg.id]\`. This is already present in the code, so the bug must be elsewhere.

Looking more carefully at the type definitions... \`SessionMessage\` has an \`id\` field of type \`string\`, but the \`partMap\` key is constructed from \`message.messageId\` in some callsites and \`message.id\` in others. That's the mismatch.

I'll grep for all callsites to confirm before patching.`,
  time: { start: NOW - 18000, end: NOW - 9000 },
}

const thinkingEmpty: ReasoningPart = {
  type: 'reasoning',
  text: '',
  time: { start: NOW - 400, end: NOW - 200 },
}

// --

const meta: Meta<typeof InlineThinkingItem> = {
  title: 'Run/InlineThinkingItem',
  component: InlineThinkingItem,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof InlineThinkingItem>

export const Complete: Story = {
  args: { part: thinkingComplete, defaultOpen: false, autoCollapse: false },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineThinkingItem {...args} />
    </div>
  ),
}

export const CompleteOpen: Story = {
  name: 'Complete (expanded)',
  args: { part: thinkingComplete, defaultOpen: true, autoCollapse: false },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineThinkingItem {...args} />
    </div>
  ),
}

export const Active: Story = {
  name: 'Active (streaming)',
  args: { part: thinkingActive, defaultOpen: true, autoCollapse: false },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineThinkingItem {...args} />
    </div>
  ),
}

export const ShortReasoning: Story = {
  args: { part: thinkingShort, defaultOpen: false, autoCollapse: false },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineThinkingItem {...args} />
    </div>
  ),
}

export const LongReasoning: Story = {
  args: { part: thinkingLong, defaultOpen: true, autoCollapse: false },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineThinkingItem {...args} />
    </div>
  ),
}

export const EmptyText: Story = {
  args: { part: thinkingEmpty, defaultOpen: true, autoCollapse: false },
  render: (args) => (
    <div className="p-6 max-w-2xl">
      <InlineThinkingItem {...args} />
    </div>
  ),
}

export const AllStates: Story = {
  render: () => (
    <div className="p-6 max-w-2xl space-y-3">
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground px-1">Active</p>
      <InlineThinkingItem part={thinkingActive} defaultOpen={true} autoCollapse={false} />
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground px-1 pt-2">Complete (collapsed)</p>
      <InlineThinkingItem part={thinkingComplete} defaultOpen={false} autoCollapse={false} />
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground px-1 pt-2">Complete (expanded)</p>
      <InlineThinkingItem part={thinkingLong} defaultOpen={true} autoCollapse={false} />
    </div>
  ),
}
