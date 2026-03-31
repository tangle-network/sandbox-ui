import type { Meta, StoryObj } from '@storybook/react'
import { Logo, TangleKnot } from '../primitives/logo'

const meta: Meta<typeof Logo> = {
  title: 'Primitives/Logo',
  component: Logo,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj<typeof Logo>

export const Default: Story = {
  args: { size: 'md', variant: 'sandbox' },
}

export const SizeSm: Story = {
  name: 'Size sm',
  args: { size: 'sm', variant: 'sandbox' },
}

export const SizeLg: Story = {
  name: 'Size lg',
  args: { size: 'lg', variant: 'sandbox' },
}

export const SizeXl: Story = {
  name: 'Size xl',
  args: { size: 'xl', variant: 'sandbox' },
}

export const IconOnly: Story = {
  name: 'Icon Only',
  args: { size: 'md', iconOnly: true },
}

export const AllSizes: Story = {
  name: 'All Sizes',
  render: () => (
    <div className="flex flex-col gap-6 items-start">
      <Logo size="sm" variant="sandbox" />
      <Logo size="md" variant="sandbox" />
      <Logo size="lg" variant="sandbox" />
      <Logo size="xl" variant="sandbox" />
    </div>
  ),
}

export const IconOnlySizes: Story = {
  name: 'Icon Only — All Sizes',
  render: () => (
    <div className="flex items-end gap-6">
      <TangleKnot size={24} />
      <TangleKnot size={28} />
      <TangleKnot size={36} />
      <TangleKnot size={48} />
    </div>
  ),
}

export const InNavbar: Story = {
  name: 'In Navbar',
  render: () => (
    <div className="flex items-center justify-between w-[640px] rounded-xl border border-border bg-card px-4 py-3">
      <Logo size="md" variant="sandbox" />
      <nav className="flex items-center gap-1">
        <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          Sessions
        </button>
        <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          Logs
        </button>
        <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          Billing
        </button>
      </nav>
    </div>
  ),
}
