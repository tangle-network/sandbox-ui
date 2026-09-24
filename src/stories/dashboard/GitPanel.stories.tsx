import type { Meta, StoryObj } from '@storybook/react'
import { GitPanel } from '../../dashboard/git-panel'

const status = { branch: 'feature/retry-policy', isDirty: true, ahead: 2, behind: 0, staged: ['src/runtime/retry.ts'], modified: ['src/runtime/worker.ts'], untracked: ['src/runtime/retry.test.ts'] }
const log = [
  { shortSha: 'ad3c802', message: 'fix: back off after worker timeout', author: 'Ava Chen', date: '2 hours ago' },
  { shortSha: '71e4a2b', message: 'test: cover retry cancellation', author: 'Ava Chen', date: 'Yesterday' },
]

const meta = {
  title: 'Dashboard/GitPanel',
  component: GitPanel,
  args: { status, log, className: 'w-full max-w-[460px]' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof GitPanel>

export default meta
type Story = StoryObj<typeof meta>

export const WorkingTree: Story = { args: { onRefresh: () => {} } }
export const NoRepository: Story = { args: { status: null, log: [] } }
export const Loading: Story = { args: { loading: true } }
