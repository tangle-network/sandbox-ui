import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { OutOfCreditsModal } from '../../dashboard/out-of-credits'

const balance = { manageUrl: '#billing', plan: 'Starter', remainingBalanceUsd: 0, message: 'Your sandbox is paused until you add credits.' }

function Dismissible() {
  const [open, setOpen] = useState(true)
  return <div className="h-80 w-full max-w-[500px] p-6"><button className="rounded border border-border px-3 py-2" onClick={() => setOpen(true)}>Resume sandbox</button><OutOfCreditsModal balance={open ? balance : null} onClose={() => setOpen(false)} /></div>
}

const meta = {
  title: 'Dashboard/OutOfCreditsModal',
  component: OutOfCreditsModal,
  args: { balance },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof OutOfCreditsModal>

export default meta
type Story = StoryObj<typeof meta>

export const DismissibleWarning: Story = { render: () => <Dismissible /> }
export const BillingRequired: Story = { args: { ctaLabel: 'Manage billing' } }
