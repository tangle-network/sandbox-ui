import type { Meta, StoryObj } from '@storybook/react'
import { EmailPreview } from '../../assets/preview/email-preview'
import { brand, email } from './fixtures'

const meta = {
  title: 'Assets/EmailPreview',
  component: EmailPreview,
  args: { content: email, brand },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EmailPreview>

export default meta
type Story = StoryObj<typeof meta>

export const CampaignEmail: Story = { render: (args) => <div style={{ width: 'min(620px, calc(100vw - 32px))' }}><EmailPreview {...args} /></div> }
export const TextOnly: Story = { args: { content: { subject: 'A note from Northstar', preheader: 'A quick update for your team.', sections: [{ type: 'body', text: 'We have a new place for the work ahead. Bring your team together and make the next project easier to run.' }, { type: 'cta', label: 'Open the workspace', url: '#workspace' }] } }, render: (args) => <div style={{ width: 'min(620px, calc(100vw - 32px))' }}><EmailPreview {...args} /></div> }
