import type { Meta, StoryObj } from '@storybook/react'
import { CodeSurface } from '../../workbench/syntax'

const code = 'export async function loadSettings() {\n  const response = await fetch("/api/settings")\n  if (!response.ok) throw new Error("Settings unavailable")\n  return response.json()\n}\n'

const meta = {
  title: 'Workbench/CodeSurface',
  component: CodeSurface,
  args: { code, filename: 'settings.ts', className: 'h-80 w-full max-w-[650px] rounded-lg border border-border bg-surface-container' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CodeSurface>

export default meta
type Story = StoryObj<typeof meta>

export const TypeScript: Story = {}
export const PlainText: Story = { args: { filename: 'README.txt', code: 'Start the sandbox, then open port 3000.\nRestart the process after changing environment variables.', showLineNumbers: false } }
