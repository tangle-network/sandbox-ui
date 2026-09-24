import type { Meta, StoryObj } from '@storybook/react'
import { SchemaTable } from '../../connectors/schema-table'

const inputSchema = {
  type: 'object',
  required: ['recipient', 'message'],
  properties: {
    recipient: { type: 'string', description: 'Email address to notify.' },
    message: { type: 'string', description: 'Message body.' },
    priority: { type: 'string', enum: ['normal', 'urgent'], description: 'Delivery priority.' },
    attachments: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' } } }, description: 'Files to include.' },
  },
}

const meta = {
  title: 'Connectors/SchemaTable',
  component: SchemaTable,
  args: { label: 'Input', schema: inputSchema },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SchemaTable>

export default meta
type Story = StoryObj<typeof meta>

export const NestedFields: Story = { render: (args) => <div style={{ width: 'min(720px, calc(100vw - 32px))' }}><SchemaTable {...args} /></div> }
export const NoFields: Story = { args: { schema: { type: 'object', properties: {} } }, render: (args) => <div className="w-80"><SchemaTable {...args} /></div> }
export const UnionSchema: Story = { args: { schema: { oneOf: [{ type: 'string' }, { type: 'number' }] } }, render: (args) => <div style={{ width: 'min(720px, calc(100vw - 32px))' }}><SchemaTable {...args} /></div> }
