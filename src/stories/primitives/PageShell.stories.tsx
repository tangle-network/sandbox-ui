import type { Meta, StoryObj } from '@storybook/react'
import { PageShell } from '../../primitives/page-shell'
import { Heading } from '../../primitives/heading'

const meta = {
  title: 'Primitives/PageShell',
  component: PageShell,
  args: { children: <Heading role="page">Sandboxes</Heading> },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PageShell>

export default meta
type Story = StoryObj<typeof meta>

export const PageGrid: Story = { render: () => <PageShell><Heading role="page">Sandboxes</Heading><div className="grid gap-4 md:grid-cols-3">{['Production API', 'Staging app', 'Preview'].map((name) => <div key={name} className="rounded-lg border border-border bg-card p-6">{name}</div>)}</div></PageShell> }
