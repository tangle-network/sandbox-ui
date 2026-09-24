import type { Meta, StoryObj } from '@storybook/react'
import { PanelHeader } from '../../workbench/panel-header'

const meta = {
  title: 'Workbench/PanelHeader',
  component: PanelHeader,
  args: { filename: 'src/runtime/retry.ts', gitStatus: 'modified', stats: { added: 8, removed: 3 }, copyText: 'export function retryDelay() {}', className: 'w-full max-w-[700px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PanelHeader>

export default meta
type Story = StoryObj<typeof meta>

export const ModifiedWithDiffStats: Story = {}
export const CleanFile: Story = { args: { gitStatus: undefined, stats: undefined, copyText: undefined } }
