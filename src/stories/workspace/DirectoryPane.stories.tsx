import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { DirectoryPane } from '../../workspace/directory-pane'

const root = { name: 'workspace', path: '/', type: 'directory' as const, children: [
  { name: 'src', path: '/src', type: 'directory' as const, children: [
    { name: 'index.ts', path: '/src/index.ts', type: 'file' as const },
    { name: 'retry.ts', path: '/src/retry.ts', type: 'file' as const },
  ] },
  { name: 'package.json', path: '/package.json', type: 'file' as const },
] }

function NavigableDirectory() {
  const [selectedPath, setSelectedPath] = useState('/src/retry.ts')
  return <DirectoryPane root={root} selectedPath={selectedPath} onSelect={setSelectedPath} onRefresh={() => {}} onUpload={() => {}} className="h-[550px] w-full max-w-[500px] rounded-lg border border-border" />
}

const meta = {
  title: 'Workspace/DirectoryPane',
  component: DirectoryPane,
  args: { root },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DirectoryPane>

export default meta
type Story = StoryObj<typeof meta>

export const SearchAndSelect: Story = { render: () => <NavigableDirectory /> }
