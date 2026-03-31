import type { Meta, StoryObj } from '@storybook/react'
import { Markdown } from '../markdown/markdown'
import { CodeBlock, CopyButton } from '../markdown/code-block'

// ─── Markdown ────────────────────────────────────────────────────────────────

const markdownMeta: Meta<typeof Markdown> = {
  title: 'Markdown/Markdown',
  component: Markdown,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-[680px] p-6 rounded-xl bg-[var(--bg-card)] text-[var(--text-primary)]">
        <Story />
      </div>
    ),
  ],
}

export default markdownMeta
type Story = StoryObj<typeof Markdown>

export const Prose: Story = {
  name: 'Prose',
  args: {
    children: `# Getting Started

Welcome to **sandbox-ui**. This library provides a set of composable components
for building agent-powered interfaces.

## Installation

\`\`\`bash
pnpm add @tangle/sandbox-ui
\`\`\`

## Usage

Import the components you need:

\`\`\`tsx
import { ChatInput, DropZone, UploadProgress } from '@tangle/sandbox-ui'
\`\`\`

> **Note:** Components assume a Tailwind CSS v4 setup with the design tokens
> provided by the sandbox theme.

## Features

- Composable chat input with drag-and-drop
- File upload progress indicators
- Full-window and sidebar drop zones
- Dashboard primitives for sandbox monitoring
`,
  },
}

export const InlineCode: Story = {
  name: 'Inline code',
  args: {
    children: `Use the \`onDrop\` prop to handle dropped files. The \`accept\` prop takes a comma-separated
list of extensions like \`.pdf,.csv,.xlsx\`. When \`disabled\` is \`true\`, all drag events are ignored.`,
  },
}

export const Table: Story = {
  name: 'GFM table',
  args: {
    children: `| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`onDrop\` | \`(files: File[]) => void\` | — | Drop handler |
| \`accept\` | \`string\` | \`undefined\` | Accepted extensions |
| \`disabled\` | \`boolean\` | \`false\` | Disable drop zone |
| \`title\` | \`string\` | \`"Drop files to upload"\` | Overlay title |
`,
  },
}

export const CodeFences: Story = {
  name: 'Code fences (multiple languages)',
  args: {
    children: `### TypeScript

\`\`\`typescript
interface DropZoneProps {
  onDrop: (files: File[]) => void
  accept?: string
  disabled?: boolean
  children: ReactNode
}
\`\`\`

### Shell

\`\`\`bash
pnpm build && pnpm storybook
\`\`\`

### JSON

\`\`\`json
{
  "name": "@tangle/sandbox-ui",
  "version": "0.4.0",
  "type": "module"
}
\`\`\`
`,
  },
}

export const ListsAndTaskItems: Story = {
  name: 'Lists & task items',
  args: {
    children: `## Checklist

- [x] Drop zone overlay
- [x] Sidebar drop zone
- [x] Upload progress indicators
- [ ] Resumable uploads
- [ ] Multi-part S3 upload

## Unordered list

- Item one
- Item two
  - Nested item
  - Another nested item
- Item three

## Ordered list

1. Install dependencies
2. Configure theme tokens
3. Wrap your app with providers
4. Import components
`,
  },
}

export const BlockquoteAndHR: Story = {
  name: 'Blockquote & HR',
  args: {
    children: `> This component is designed to be a drop-in replacement for any file upload flow.
> It handles edge cases like nested drag events, accept filtering, and disabled states.

---

Regular paragraph after a horizontal rule.
`,
  },
}

// ─── CodeBlock ───────────────────────────────────────────────────────────────

export const CodeBlockOnly: Story = {
  name: 'CodeBlock standalone',
  render: () => (
    <div className="w-[680px] p-6 rounded-xl bg-[var(--bg-card)] space-y-4">
      <CodeBlock code={`import { DropZone } from '@tangle/sandbox-ui'\n\nfunction App() {\n  return (\n    <DropZone onDrop={files => upload(files)}>\n      <Dashboard />\n    </DropZone>\n  )\n}`} language="tsx">
        <CopyButton text="import { DropZone } from '@tangle/sandbox-ui'" />
      </CodeBlock>
      <CodeBlock code={`pnpm add @tangle/sandbox-ui`} language="bash">
        <CopyButton text="pnpm add @tangle/sandbox-ui" />
      </CodeBlock>
    </div>
  ),
}

export const CodeBlockNoLanguage: Story = {
  name: 'CodeBlock — no language',
  render: () => (
    <div className="w-[680px] p-6 rounded-xl bg-[var(--bg-card)]">
      <CodeBlock code="DROP TABLE users;  -- don't run this" />
    </div>
  ),
}

export const CodeBlockLight: Story = {
  name: 'CodeBlock — light theme',
  parameters: { backgrounds: { default: 'light' } },
  render: () => (
    <div className="w-[680px] p-6 rounded-xl bg-white space-y-4">
      <CodeBlock light code={`interface SandboxConfig {\n  model: string\n  timeout: number\n  env: Record<string, string>\n}\n\n// Create a new sandbox\nconst sandbox = await Sandbox.create(config)`} language="typescript">
        <CopyButton text="interface SandboxConfig" />
      </CodeBlock>
      <CodeBlock light code={`pnpm add @tangle-network/sandbox-ui`} language="bash" />
    </div>
  ),
}
