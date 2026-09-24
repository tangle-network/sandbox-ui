import type { Meta, StoryObj } from '@storybook/react'
import { Heading, PageHeader, SectionTitle } from '../../primitives/heading'

const meta = {
  title: 'Primitives/Heading',
  component: Heading,
  args: { role: 'page', children: 'Sandbox settings' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Heading>

export default meta
type Story = StoryObj<typeof meta>

export const TypeScale: Story = { render: () => <div className="w-full max-w-[700px] space-y-6"><Heading role="display">Build in your own environment</Heading><Heading role="hero">Choose a template</Heading><Heading role="page">Sandbox settings</Heading><Heading role="section">Network access</Heading><Heading role="subsection">Allowed IP ranges</Heading><Heading role="eyebrow">Workspace</Heading></div> }
export const PageComposites: Story = { render: () => <div className="w-full max-w-[700px] space-y-8"><PageHeader title="Sandbox settings" description="Manage your environment and access." /><SectionTitle title="Network access" description="Control connections from the sandbox." /></div> }
