import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { PillTabs } from '../../workbench/pill-tabs'

const items = [{ value: 'code', label: 'Code' }, { value: 'preview', label: 'Preview' }, { value: 'changes', label: 'Changes' }] as const

function LiveTabs() {
  const [value, setValue] = useState<'code' | 'preview' | 'changes'>('code')
  return <div className="space-y-4"><PillTabs items={items} value={value} onChange={setValue} aria-label="Workbench view" /><p className="text-sm text-muted-foreground">Showing {value}</p></div>
}

const meta = {
  title: 'Workbench/PillTabs',
  component: PillTabs,
  args: { items, value: 'code', onChange: () => {} },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PillTabs>

export default meta
type Story = StoryObj<typeof meta>

export const SwitchViews: Story = { render: () => <LiveTabs /> }
