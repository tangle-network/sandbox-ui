import type { Meta, StoryObj } from '@storybook/react'
import { CreditBalance } from '../../dashboard/credit-balance'

const meta: Meta<typeof CreditBalance> = {
  title: 'Dashboard/CreditBalance',
  component: CreditBalance,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    amount: 47.83,
    onTopUp: (amount) => console.log('top up', amount),
  },
}

export default meta
type Story = StoryObj<typeof CreditBalance>

export const Default: Story = {
  name: 'Default',
}

export const HighBalance: Story = {
  name: 'High balance',
  args: { amount: 1250.0 },
}

export const LowBalance: Story = {
  name: 'Low balance',
  args: { amount: 2.41 },
}

export const ZeroBalance: Story = {
  name: 'Zero balance',
  args: { amount: 0 },
}

export const ReadOnly: Story = {
  name: 'Read-only (no top-up)',
  args: { amount: 47.83, onTopUp: undefined },
}

export const CustomQuickAmounts: Story = {
  name: 'Custom quick amounts',
  args: { quickAmounts: [5, 20, 50, 200] },
}

export const CustomDescription: Story = {
  name: 'Custom description',
  args: {
    description: 'Credits are consumed per agent operation. Unused credits roll over each month.',
  },
}
