import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { CodeView } from '../../workbench/code-view'

const files: Record<string, string> = {
  'src/runtime/retry.ts': 'export function retryDelay(attempt: number) {\n  return Math.min(1000 * 2 ** attempt, 30_000)\n}\n',
  'src/runtime/worker.ts': 'import { retryDelay } from "./retry"\n\nexport async function runWorker() {\n  return retryDelay(2)\n}\n',
  'src/runtime/retry.test.ts': 'import { expect, test } from "vitest"\nimport { retryDelay } from "./retry"\n\ntest("caps the delay", () => {\n  expect(retryDelay(9)).toBe(30_000)\n})\n',
}

function NavigableFiles() {
  const [path, setPath] = useState('src/runtime/retry.ts')
  return <div className="h-[480px] w-full max-w-[860px] overflow-hidden rounded-lg border border-border"><CodeView path={path} filename={path.split('/').at(-1)!} content={files[path]} paths={Object.keys(files)} onFileSelect={setPath} /></div>
}

const meta = {
  title: 'Workbench/CodeView',
  component: CodeView,
  args: { path: 'src/runtime/retry.ts', filename: 'retry.ts', content: files['src/runtime/retry.ts'] },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CodeView>

export default meta
type Story = StoryObj<typeof meta>

export const FileTreeNavigation: Story = { render: () => <NavigableFiles /> }
export const SingleFileEmbed: Story = { args: { showTree: false }, render: (args) => <div className="h-80 w-full max-w-[650px] overflow-hidden rounded-lg border border-border"><CodeView {...args} /></div> }
