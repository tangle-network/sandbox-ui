import type { Meta, StoryObj } from '@storybook/react'
import { ShellHeader } from '../../workspace/shell-header'

const meta = {
  title: 'Shell/ShellHeader',
  component: ShellHeader,
  args: { children: <><span className="font-medium">Workspace files</span><span className="ml-auto text-xs text-muted-foreground">3 files</span></>, className: 'w-full max-w-[620px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ShellHeader>

export default meta
type Story = StoryObj<typeof meta>

export const FilePane: Story = {}
