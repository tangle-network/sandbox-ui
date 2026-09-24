import type { Meta, StoryObj } from '@storybook/react'
import { CopyPreview } from '../../assets/preview/copy-preview'
import { caption } from './fixtures'

const meta = {
  title: 'Assets/CopyPreview',
  component: CopyPreview,
  args: { content: caption },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CopyPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Instagram: Story = { render: (args) => <div style={{ width: 'min(420px, calc(100vw - 32px))' }}><CopyPreview {...args} /></div> }
export const NearSmsLimit: Story = { args: { content: { ...caption, platform: 'sms', headline: 'Launch reminder', body: 'Your Northstar Studio workspace is ready. Bring the team into one focused place and keep every draft, decision, and launch detail together this week.' } }, render: (args) => <div style={{ width: 'min(420px, calc(100vw - 32px))' }}><CopyPreview {...args} /></div> }
export const OverXLimit: Story = { args: { content: { ...caption, platform: 'x', body: `${caption.body} `.repeat(4), hashtags: [] } }, render: (args) => <div style={{ width: 'min(420px, calc(100vw - 32px))' }}><CopyPreview {...args} /></div> }
