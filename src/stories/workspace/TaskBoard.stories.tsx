import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { TaskBoard, type TaskBoardItem } from '../../workspace/task-board'

const columns = [{ id: 'todo', label: 'To do' }, { id: 'doing', label: 'In progress' }, { id: 'done', label: 'Done' }]
const initial: TaskBoardItem[] = [
  { id: 'retry', title: 'Review retry policy', status: 'todo', priority: 'High', tags: ['runtime'] },
  { id: 'tests', title: 'Run browser checks', status: 'doing', priority: 'Medium', tags: ['quality'] },
  { id: 'spec', title: 'Approve deployment spec', status: 'done', tags: ['release'] },
]

function LiveBoard() {
  const [items, setItems] = useState(initial)
  const move = (id: string, status: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item))
  return <TaskBoard items={items} columns={columns} onMoveItem={move} renderItemMeta={(item) => <select aria-label={`Move ${item.title}`} value={item.status} onChange={(event) => move(item.id, event.target.value)} className="mt-3 w-full rounded border border-border bg-background p-1 text-xs">{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select>} className="h-[580px] w-full max-w-[1050px] rounded-lg border border-border bg-background" />
}

const meta = {
  title: 'Workspace/TaskBoard',
  component: TaskBoard,
  args: { items: initial, columns },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TaskBoard>

export default meta
type Story = StoryObj<typeof meta>

export const MoveTasks: Story = { render: () => <LiveBoard /> }
export const EmptyColumns: Story = { args: { items: [], columnEmptyState: <span className="text-xs text-muted-foreground">No tasks</span>, className: 'h-80 w-full max-w-[1050px]' } }
