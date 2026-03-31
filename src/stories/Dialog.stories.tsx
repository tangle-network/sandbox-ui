import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../primitives/dialog'

const meta: Meta = {
  title: 'Primitives/Dialog',
  parameters: { layout: 'centered', backgrounds: { default: 'dark' } },
}

export default meta
type Story = StoryObj

export const Default: Story = {
  name: 'Default',
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="rounded-md bg-muted px-4 py-2 text-sm text-foreground hover:bg-muted/80">
            Open Dialog
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Configuration</DialogTitle>
            <DialogDescription>
              Configure the runtime environment for your sandbox session. Changes
              take effect on the next session start.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Image</label>
              <input
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                defaultValue="node:20-alpine"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Memory (MB)</label>
              <input
                type="number"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                defaultValue={512}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Save changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  },
}

export const SandboxVariant: Story = {
  name: 'Sandbox Variant',
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="rounded-md bg-muted px-4 py-2 text-sm text-foreground hover:bg-muted/80">
            Open Sandbox Dialog
          </button>
        </DialogTrigger>
        <DialogContent variant="sandbox">
          <DialogHeader>
            <DialogTitle>New Sandbox Session</DialogTitle>
            <DialogDescription>
              Provision a fresh container with your selected runtime. Sessions
              auto-terminate after the configured timeout.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Runtime</label>
              <select className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none">
                <option>node:20-alpine</option>
                <option>python:3.12-slim</option>
                <option>golang:1.22-alpine</option>
                <option>rust:1.77-slim</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Timeout (seconds)</label>
              <input
                type="number"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                defaultValue={300}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Create session
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  },
}

export const DestructiveAction: Story = {
  name: 'Destructive Action',
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="rounded-md bg-muted px-4 py-2 text-sm text-foreground hover:bg-muted/80">
            Terminate Session
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate session?</DialogTitle>
            <DialogDescription>
              This will immediately kill the running process and destroy all
              ephemeral data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Session <span className="font-mono">sess_01j9x8k2m...</span> has been
            running for 47 minutes. Unsaved work will be lost.
          </div>
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Keep running
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              Terminate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  },
}
