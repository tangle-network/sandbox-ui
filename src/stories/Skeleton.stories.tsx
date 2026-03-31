import type { Meta, StoryObj } from '@storybook/react'
import { Skeleton, SkeletonCard, SkeletonTable } from '../primitives/skeleton'

const meta: Meta = {
  title: 'Primitives/Skeleton',
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj

export const Base: Story = {
  render: () => <Skeleton className="h-4 w-48" />,
}

export const Card: Story = {
  render: () => <SkeletonCard className="w-72" />,
}

export const Table: Story = {
  render: () => (
    <div className="w-[520px] rounded-xl border border-border bg-card p-4">
      <SkeletonTable rows={4} />
    </div>
  ),
}

export const AvatarRow: Story = {
  name: 'Avatar + text row',
  render: () => (
    <div className="flex items-center gap-3 w-72">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  ),
}

export const Overview: Story = {
  name: 'Overview',
  render: () => (
    <div className="flex flex-col gap-8 p-6 w-[560px]">
      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Inline elements</div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Team list</div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Cards</div>
      <div className="flex gap-4">
        <SkeletonCard className="flex-1" />
        <SkeletonCard className="flex-1" />
      </div>

      <div className="text-muted-foreground text-xs font-mono uppercase tracking-widest">Table</div>
      <div className="rounded-xl border border-border bg-card p-4">
        <SkeletonTable rows={3} />
      </div>
    </div>
  ),
}
