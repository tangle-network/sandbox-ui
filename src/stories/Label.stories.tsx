import type { Meta, StoryObj } from '@storybook/react'
import { Label } from '../primitives/label'
import { Input } from '../primitives/input'
import { Switch } from '../primitives/switch'

const meta: Meta<typeof Label> = {
  title: 'Primitives/Label',
  component: Label,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  args: { children: 'Field label' },
}

export default meta
type Story = StoryObj<typeof Label>

export const Default: Story = {}

export const WithInput: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5 w-64">
      <Label htmlFor="sandbox-name">Sandbox name</Label>
      <Input id="sandbox-name" placeholder="my-sandbox-01" />
    </div>
  ),
}

export const WithSwitch: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="auto-sleep" />
      <Label htmlFor="auto-sleep">Enable auto-sleep</Label>
    </div>
  ),
}

export const DisabledPeer: Story = {
  name: 'Disabled (peer state)',
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="auto-sleep-disabled" disabled />
      <Label htmlFor="auto-sleep-disabled" className="peer">
        Enable auto-sleep
      </Label>
    </div>
  ),
}

export const Overview: Story = {
  name: 'Overview',
  render: () => (
    <div className="flex flex-col gap-6 p-6 w-80">
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Standalone</div>
      <Label>Standalone label</Label>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Paired with input</div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="overview-name">Sandbox name</Label>
        <Input id="overview-name" placeholder="my-sandbox-01" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="overview-image">Container image</Label>
        <Input id="overview-image" placeholder="ubuntu:22.04" />
      </div>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Paired with switch</div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Switch id="overview-sleep" defaultChecked />
          <Label htmlFor="overview-sleep">Auto-sleep after idle</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="overview-telemetry" />
          <Label htmlFor="overview-telemetry">Send usage telemetry</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="overview-disabled" disabled />
          <Label htmlFor="overview-disabled" className="opacity-50">
            Public access (requires upgrade)
          </Label>
        </div>
      </div>
    </div>
  ),
}
