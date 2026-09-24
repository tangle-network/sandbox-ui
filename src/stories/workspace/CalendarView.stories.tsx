import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { CalendarView } from '../../workspace/calendar-view'

const events = [
  { id: 'review', title: 'Review release candidate', type: 'review', startAt: '2026-09-23T15:00:00' },
  { id: 'deploy', title: 'Staging deployment', type: 'deploy', startAt: '2026-09-24T10:00:00' },
  { id: 'retro', title: 'Sprint retrospective', type: 'meeting', startAt: '2026-09-28T16:00:00' },
]

function ReleaseCalendar() {
  const [view, setView] = useState({ year: 2026, month: 8 })
  const [selectedDay, setSelectedDay] = useState('2026-09-23')
  return <CalendarView events={events} {...view} onMonthChange={(year, month) => setView({ year, month })} selectedDay={selectedDay} onSelectDay={setSelectedDay} className="h-[650px] w-full max-w-[1000px] rounded-lg border border-border bg-background" />
}

const meta = {
  title: 'Workspace/CalendarView',
  component: CalendarView,
  args: { events, year: 2026, month: 8, selectedDay: '2026-09-23', className: 'h-[650px] w-full max-w-[1000px] rounded-lg border border-border bg-background' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CalendarView>

export default meta
type Story = StoryObj<typeof meta>

export const ReleaseWeek: Story = { render: () => <ReleaseCalendar /> }
export const EmptyMonth: Story = { args: { events: [], month: 9, selectedDay: '2026-10-01' } }
