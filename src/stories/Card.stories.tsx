import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../primitives/card'
import { Badge } from '../primitives/badge'

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof Card>

const SampleCard = ({ variant, hover }: { variant?: 'default' | 'glass' | 'sandbox' | 'elevated', hover?: boolean }) => (
  <Card variant={variant} hover={hover} className="w-72">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>Agent Session</CardTitle>
        <Badge variant="running" dot>Running</Badge>
      </div>
      <CardDescription>GPT-4o · Tangle Cloud</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Processing 14 tool calls · 3.2k tokens used
      </p>
    </CardContent>
  </Card>
)

export const Default: Story = { render: () => <SampleCard variant="default" /> }
export const Elevated: Story = { render: () => <SampleCard variant="elevated" /> }
export const Glass: Story = {
  render: () => (
    <div className="bg-mesh bg-[var(--depth-1)] p-10 rounded-xl">
      <SampleCard variant="glass" />
    </div>
  ),
}
export const Sandbox: Story = { render: () => <SampleCard variant="sandbox" /> }
export const Hoverable: Story = { render: () => <SampleCard variant="default" hover /> }

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <div className="bg-mesh bg-[var(--depth-1)] p-10 rounded-xl flex flex-wrap gap-4">
      <SampleCard variant="default" />
      <SampleCard variant="elevated" />
      <SampleCard variant="glass" />
      <SampleCard variant="sandbox" />
    </div>
  ),
}
