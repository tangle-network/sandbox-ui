import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '../primitives/button'

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Button' },
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {}
export const Sandbox: Story = { args: { variant: 'sandbox', children: 'Get Started' } }
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Outline: Story = { args: { variant: 'outline' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete' } }
export const Loading: Story = { args: { loading: true, children: 'Loading...' } }

export const AllSizes: Story = {
  name: 'All Sizes',
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">XLarge</Button>
    </div>
  ),
}

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="default">Default</Button>
        <Button variant="sandbox">Sandbox</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    </div>
  ),
}
