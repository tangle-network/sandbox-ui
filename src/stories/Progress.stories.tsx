import type { Meta, StoryObj } from '@storybook/react'
import { Progress } from '../primitives/progress'

const meta: Meta<typeof Progress> = {
  title: 'Primitives/Progress',
  component: Progress,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  args: { value: 60 },
}

export default meta
type Story = StoryObj<typeof Progress>

export const Default: Story = {
  render: () => <Progress value={60} className="w-80" />,
}

export const SandboxVariant: Story = {
  name: 'Sandbox variant',
  render: () => <Progress value={60} variant="sandbox" className="w-80" />,
}

export const WithValue: Story = {
  name: 'With value label',
  render: () => (
    <div className="pt-6 w-80">
      <Progress value={73} showValue />
    </div>
  ),
}

export const SandboxWithValue: Story = {
  name: 'Sandbox with value label',
  render: () => (
    <div className="pt-6 w-80">
      <Progress value={73} variant="sandbox" showValue />
    </div>
  ),
}

export const Empty: Story = {
  render: () => <Progress value={0} className="w-80" />,
}

export const Full: Story = {
  render: () => <Progress value={100} className="w-80" />,
}

export const Overview: Story = {
  name: 'Overview',
  render: () => (
    <div className="flex flex-col gap-8 p-6 w-96">
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Default variant</div>
      <div className="flex flex-col gap-4">
        {[0, 25, 50, 75, 100].map((v) => (
          <div key={v} className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs w-8 text-right">{v}%</span>
            <Progress value={v} className="flex-1" />
          </div>
        ))}
      </div>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Sandbox variant</div>
      <div className="flex flex-col gap-4">
        {[0, 25, 50, 75, 100].map((v) => (
          <div key={v} className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs w-8 text-right">{v}%</span>
            <Progress value={v} variant="sandbox" className="flex-1" />
          </div>
        ))}
      </div>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Sandbox task list</div>
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        {[
          { label: 'Pulling image', value: 100 },
          { label: 'Provisioning volume', value: 100 },
          { label: 'Starting runtime', value: 68 },
          { label: 'Installing packages', value: 12 },
          { label: 'Applying config', value: 0 },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span className="text-sm">{label}</span>
              <span className="text-muted-foreground text-xs">{value}%</span>
            </div>
            <Progress value={value} variant="sandbox" />
          </div>
        ))}
      </div>
    </div>
  ),
}
