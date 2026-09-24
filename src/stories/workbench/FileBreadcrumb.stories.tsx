import type { Meta, StoryObj } from '@storybook/react'
import { FileBreadcrumb } from '../../workbench/file-breadcrumb'

const meta = {
  title: 'Workbench/FileBreadcrumb',
  component: FileBreadcrumb,
  args: { path: 'src/runtime/retry-policy.ts', className: 'w-full max-w-[680px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FileBreadcrumb>

export default meta
type Story = StoryObj<typeof meta>

export const NestedFile: Story = {}
export const RootFile: Story = { args: { path: 'README.md' } }
