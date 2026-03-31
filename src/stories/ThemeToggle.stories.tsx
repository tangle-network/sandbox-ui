import type { Meta, StoryObj } from '@storybook/react'
import { ThemeToggle } from '../primitives/theme-toggle'

const meta: Meta<typeof ThemeToggle> = {
  title: 'Primitives/ThemeToggle',
  component: ThemeToggle,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof ThemeToggle>

export const Default: Story = {}

export const InToolbar: Story = {
  name: 'In Toolbar',
  render: () => (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1">
      <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
        Sessions
      </button>
      <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
        Logs
      </button>
      <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
        Billing
      </button>
      <div className="mx-2 h-4 w-px bg-border" />
      <ThemeToggle />
    </div>
  ),
}
