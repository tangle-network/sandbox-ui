import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from '../primitives/badge'

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  args: { children: 'Label' },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { variant: 'default' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Secondary' } }
export const Outline: Story = { args: { variant: 'outline', children: 'Outline' } }
export const Sandbox: Story = { args: { variant: 'sandbox', children: 'Sandbox' } }
export const Success: Story = { args: { variant: 'success', children: 'Success' } }
export const Warning: Story = { args: { variant: 'warning', children: 'Warning' } }
export const Error: Story = { args: { variant: 'error', children: 'Error' } }
export const Info: Story = { args: { variant: 'info', children: 'Info' } }

// Status variants
export const Running: Story = { args: { variant: 'running', dot: true, children: 'Running' } }
export const Creating: Story = { args: { variant: 'creating', dot: true, children: 'Creating' } }
export const Stopped: Story = { args: { variant: 'stopped', dot: true, children: 'Stopped' } }
export const Warm: Story = { args: { variant: 'warm', dot: true, children: 'Warm' } }
export const Cold: Story = { args: { variant: 'cold', dot: true, children: 'Cold' } }
export const Deleted: Story = { args: { variant: 'deleted', dot: true, children: 'Deleted' } }

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <div className="flex flex-col gap-4 p-6">
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Semantic</div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="sandbox">Sandbox</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="error">Error</Badge>
        <Badge variant="info">Info</Badge>
      </div>
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest mt-2">Operational Status</div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="running" dot>Running</Badge>
        <Badge variant="creating" dot>Creating</Badge>
        <Badge variant="stopped" dot>Stopped</Badge>
        <Badge variant="warm" dot>Warm</Badge>
        <Badge variant="cold" dot>Cold</Badge>
        <Badge variant="deleted" dot>Deleted</Badge>
      </div>
    </div>
  ),
}
