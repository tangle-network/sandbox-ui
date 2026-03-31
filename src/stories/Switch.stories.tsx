import type { Meta, StoryObj } from '@storybook/react'
import { Switch } from '../primitives/switch'
import { Label } from '../primitives/label'

const meta: Meta<typeof Switch> = {
  title: 'Primitives/Switch',
  component: Switch,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof Switch>

export const Unchecked: Story = {
  args: { defaultChecked: false },
}

export const Checked: Story = {
  args: { defaultChecked: true },
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const DisabledChecked: Story = {
  name: 'Disabled (checked)',
  args: { disabled: true, defaultChecked: true },
}

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="auto-sleep" defaultChecked />
      <Label htmlFor="auto-sleep">Auto-sleep after 30 min idle</Label>
    </div>
  ),
}

export const Overview: Story = {
  name: 'Overview',
  render: () => (
    <div className="flex flex-col gap-6 p-6 w-80">
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">States</div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Off</span>
          <Switch />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">On</span>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Disabled off</span>
          <Switch disabled />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Disabled on</span>
          <Switch disabled defaultChecked />
        </div>
      </div>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mt-2">Settings panel</div>
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        {[
          { id: 'auto-sleep', label: 'Auto-sleep after idle', checked: true },
          { id: 'public-access', label: 'Public network access', checked: false },
          { id: 'telemetry', label: 'Usage telemetry', checked: true },
          { id: 'snapshots', label: 'Automatic snapshots', checked: false, disabled: true },
        ].map(({ id, label, checked, disabled }) => (
          <div key={id} className="flex items-center justify-between">
            <Label
              htmlFor={id}
              className={disabled ? 'opacity-50' : ''}
            >
              {label}
            </Label>
            <Switch id={id} defaultChecked={checked} disabled={disabled} />
          </div>
        ))}
      </div>
    </div>
  ),
}
