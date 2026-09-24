import type { Meta, StoryObj } from '@storybook/react'
import { InvoiceTable } from '../../dashboard/invoice-table'

const invoices = [
  { id: 'INV-2026-009', date: 'Sep 1, 2026', amount: 149, status: 'paid' as const },
  { id: 'INV-2026-008', date: 'Aug 1, 2026', amount: 132.5, status: 'paid' as const },
  { id: 'INV-2026-007', date: 'Jul 1, 2026', amount: 119, status: 'failed' as const },
]

const meta = {
  title: 'Dashboard/InvoiceTable',
  component: InvoiceTable,
  args: { invoices, className: 'w-full max-w-[900px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof InvoiceTable>

export default meta
type Story = StoryObj<typeof meta>

export const BillingHistory: Story = { args: { onViewInvoice: () => {}, onExportAll: () => {}, onLoadMore: () => {}, hasMore: true } }
export const Empty: Story = { args: { invoices: [] } }
