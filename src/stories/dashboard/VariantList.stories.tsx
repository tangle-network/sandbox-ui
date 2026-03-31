import type { Meta, StoryObj } from '@storybook/react'
import { VariantList, type Variant } from '../../dashboard/variant-list'

const meta: Meta<typeof VariantList> = {
  title: 'Dashboard/VariantList',
  component: VariantList,
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-[680px] p-4 bg-[var(--depth-1)] rounded-xl">
        <Story />
      </div>
    ),
  ],
  args: {
    onSelect: (id) => console.log('select', id),
    onAccept: (id) => console.log('accept', id),
    onReject: (id) => console.log('reject', id),
  },
}

export default meta
type Story = StoryObj<typeof VariantList>

const allVariants: Variant[] = [
  {
    id: 'v1',
    label: 'claude-sonnet-4-6',
    sublabel: 'temp=0.7',
    status: 'completed',
    outcome: 'pending_review',
    durationMs: 4230,
    summary: 'Refactored the authentication module to use JWT tokens with 24-hour expiry and refresh token rotation.',
  },
  {
    id: 'v2',
    label: 'gpt-4o',
    sublabel: 'temp=0.7',
    status: 'running',
    durationMs: 8100,
  },
  {
    id: 'v3',
    label: 'gemini-pro',
    sublabel: 'temp=0.5',
    status: 'pending',
  },
  {
    id: 'v4',
    label: 'claude-opus-4',
    sublabel: 'temp=1.0',
    status: 'failed',
    error: 'Context window exceeded — prompt + history is 198k tokens.',
  },
  {
    id: 'v5',
    label: 'gpt-4o-mini',
    status: 'completed',
    outcome: 'accepted',
    durationMs: 2100,
    summary: 'Added rate limiting middleware with Redis-backed sliding window.',
  },
]

export const AllStatuses: Story = {
  name: 'All statuses',
  args: { variants: allVariants },
}

export const PendingReview: Story = {
  name: 'Completed — pending review (with actions)',
  args: {
    variants: [allVariants[0]],
    selectedId: 'v1',
  },
}

export const Running: Story = {
  name: 'Running variants',
  args: {
    variants: [
      { id: 'r1', label: 'claude-sonnet-4-6', status: 'running', durationMs: 3200 },
      { id: 'r2', label: 'gpt-4o', status: 'running', durationMs: 5800 },
    ],
  },
}

export const WithOutcomes: Story = {
  name: 'With outcome badges',
  args: {
    variants: [
      { id: 'o1', label: 'claude-sonnet', status: 'completed', outcome: 'accepted', durationMs: 3100, summary: 'Clean implementation, well-structured.' },
      { id: 'o2', label: 'gpt-4o', status: 'completed', outcome: 'rejected', durationMs: 4400, summary: 'Over-engineered; added unnecessary abstraction layers.' },
      { id: 'o3', label: 'gemini-pro', status: 'completed', outcome: 'merged_with_conflicts', durationMs: 2800 },
      { id: 'o4', label: 'gpt-4o-mini', status: 'completed', outcome: 'expired', durationMs: 1900 },
    ],
  },
}

export const Selected: Story = {
  name: 'Selected item',
  args: {
    variants: allVariants.slice(0, 3),
    selectedId: 'v2',
  },
}

export const WithExternalLinks: Story = {
  name: 'With external detail links',
  args: {
    variants: [
      { id: 'l1', label: 'claude-sonnet', status: 'completed', outcome: 'accepted', durationMs: 2900, detailsUrl: 'https://example.com/runs/l1' },
      { id: 'l2', label: 'gpt-4o', status: 'completed', outcome: 'pending_review', durationMs: 4100, detailsUrl: 'https://example.com/runs/l2' },
    ],
  },
}

export const Actioning: Story = {
  name: 'Actioning in progress',
  args: {
    variants: [
      { id: 'a1', label: 'claude-sonnet', status: 'completed', outcome: 'pending_review', durationMs: 3500 },
    ],
    isActioning: 'a1',
  },
}
