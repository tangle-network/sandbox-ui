import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from '../primitives/badge'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../primitives/table'

const meta: Meta = {
  title: 'Primitives/Table',
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj

type SessionStatus = 'running' | 'stopped' | 'creating' | 'warm'

const sessions: {
  id: string
  image: string
  region: string
  status: SessionStatus
  cpu: string
  memory: string
  started: string
  duration: string
}[] = [
  {
    id: 'sess_01j9x8k2m4n3p',
    image: 'node:20-alpine',
    region: 'us-east-1',
    status: 'running',
    cpu: '42%',
    memory: '256 MB',
    started: '14:02:11',
    duration: '47m',
  },
  {
    id: 'sess_01j9x7r9a1b2c',
    image: 'python:3.12-slim',
    region: 'us-east-1',
    status: 'running',
    cpu: '8%',
    memory: '128 MB',
    started: '13:55:44',
    duration: '54m',
  },
  {
    id: 'sess_01j9x6q8z0y1x',
    image: 'golang:1.22-alpine',
    region: 'eu-central-1',
    status: 'warm',
    cpu: '0%',
    memory: '64 MB',
    started: '13:40:02',
    duration: '1h 9m',
  },
  {
    id: 'sess_01j9x5p7w9v0u',
    image: 'node:20-alpine',
    region: 'us-west-2',
    status: 'creating',
    cpu: '—',
    memory: '—',
    started: '14:49:58',
    duration: '< 1s',
  },
  {
    id: 'sess_01j9x4o6v8u9t',
    image: 'rust:1.77-slim',
    region: 'us-east-1',
    status: 'stopped',
    cpu: '0%',
    memory: '0 MB',
    started: '11:22:30',
    duration: '3h 27m',
  },
]

export const SessionsTable: Story = {
  name: 'Sessions Table',
  render: () => (
    <div className="w-[900px] rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session ID</TableHead>
            <TableHead>Image</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>CPU</TableHead>
            <TableHead>Memory</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{s.id}</TableCell>
              <TableCell className="font-mono text-xs">{s.image}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{s.region}</TableCell>
              <TableCell>
                <Badge variant={s.status} dot>
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs tabular-nums">{s.cpu}</TableCell>
              <TableCell className="text-xs tabular-nums">{s.memory}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{s.started}</TableCell>
              <TableCell className="text-xs tabular-nums">{s.duration}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="text-xs text-muted-foreground">
              {sessions.length} sessions
            </TableCell>
            <TableCell className="text-xs">
              <span className="text-green-400 font-medium">2 running</span>
              {' · '}
              <span className="text-muted-foreground">1 warm · 1 creating · 1 stopped</span>
            </TableCell>
            <TableCell colSpan={4} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
}

export const SimpleTable: Story = {
  name: 'Simple Table',
  render: () => (
    <div className="w-[480px] rounded-xl border border-border bg-card">
      <Table>
        <TableCaption>Recent billing activity</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead className="text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { date: '2026-03-29', sessions: 312, cost: '$4.82' },
            { date: '2026-03-28', sessions: 287, cost: '$4.43' },
            { date: '2026-03-27', sessions: 401, cost: '$6.19' },
            { date: '2026-03-26', sessions: 198, cost: '$3.06' },
            { date: '2026-03-25', sessions: 223, cost: '$3.44' },
          ].map((row) => (
            <TableRow key={row.date}>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.date}</TableCell>
              <TableCell className="tabular-nums text-xs">{row.sessions}</TableCell>
              <TableCell className="text-right tabular-nums text-xs font-medium">{row.cost}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
}
