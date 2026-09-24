"use client"

import * as React from "react"
import { Activity, Plus, Skull, Terminal } from "lucide-react"
import { cn } from "../lib/utils"
import { focusField, focusRing } from "@tangle-network/ui/utils"

export interface ProcessInfo {
  pid: number
  command: string
  running: boolean
  exitCode?: number
  startedAt?: string
  cwd?: string
}

export interface ProcessListProps {
  processes: ProcessInfo[]
  onSpawn: (command: string) => void
  onKill: (pid: number) => void
  loading?: boolean
  className?: string
}

function formatUptime(startedAt?: string): string {
  if (!startedAt) return "-"
  const ms = Date.now() - new Date(startedAt).getTime()
  if (Number.isNaN(ms) || ms < 0) return "-"
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`
  return `${Math.floor(ms / 3600_000)}h ${Math.floor((ms % 3600_000) / 60_000)}m`
}

export function ProcessList({ processes, onSpawn, onKill, loading = false, className }: ProcessListProps) {
  const [newCommand, setNewCommand] = React.useState("")
  const [statusMessage, setStatusMessage] = React.useState("")
  const commandId = React.useId()
  const commandInputRef = React.useRef<HTMLInputElement>(null)
  const pendingKillRef = React.useRef<{ pid: number; restoreFocus: boolean } | null>(null)

  React.useEffect(() => {
    const pending = pendingKillRef.current
    if (!pending || processes.some((process) => process.pid === pending.pid && process.running)) return
    const stopped = processes.find((process) => process.pid === pending.pid)
    setStatusMessage(stopped?.exitCode == null
      ? `Process ${pending.pid} stopped.`
      : `Process ${pending.pid} exited with code ${stopped.exitCode}.`)
    if (pending.restoreFocus) commandInputRef.current?.focus()
    pendingKillRef.current = null
  }, [processes])

  const handleSpawn = () => {
    const cmd = newCommand.trim()
    if (cmd) {
      onSpawn(cmd)
      setNewCommand("")
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <span role="status" className="sr-only">{statusMessage}</span>
      {loading ? (
        <div className="rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container p-6 text-center">
          <Activity className="mx-auto h-6 w-6 text-muted-foreground animate-spin mb-2" data-motion="essential" />
          <p className="text-sm text-muted-foreground">Loading processes...</p>
        </div>
      ) : processes.length > 0 ? (
        <div className="rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container overflow-hidden">
          <ul aria-label="Processes" className="divide-y divide-border">
            {processes.map((p) => {
              const age = formatUptime(p.startedAt)
              return (
                <li key={`${p.pid}-${p.startedAt ?? p.command}`} className="flex min-w-0 items-start gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <code className="block break-all font-mono text-xs leading-5 text-foreground">{p.command}</code>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">PID {p.pid}</span>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        p.running
                          ? "bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]"
                          : "bg-surface-container-high text-muted-foreground"
                      )}>
                        {p.running ? "running" : `exited (${p.exitCode ?? "?"})`}
                      </span>
                      {age !== "-" && (
                        <span className="font-mono tabular-nums">{p.running ? `Uptime ${age}` : `Started ${age} ago`}</span>
                      )}
                    </div>
                  </div>
                  {p.running && (
                    <button
                      type="button"
                      onClick={(event) => {
                        pendingKillRef.current = { pid: p.pid, restoreFocus: event.detail === 0 }
                        onKill(p.pid)
                      }}
                      className={`flex size-10 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive ${focusRing}`}
                      aria-label={`Kill process ${p.pid}`}
                      title={`Kill process ${p.pid}`}
                    >
                      <Skull aria-hidden="true" className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container p-6 text-center">
          <Terminal className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No processes running</p>
        </div>
      )}

      <form onSubmit={(event) => { event.preventDefault(); handleSpawn() }} className="flex min-w-0 flex-wrap items-end gap-2">
        <div className="min-w-0 flex-[1_1_12rem]">
          <label htmlFor={commandId} className="mb-1 block text-xs font-medium text-muted-foreground">Command</label>
          <input
            ref={commandInputRef}
            id={commandId}
            type="text"
            placeholder="node app.js"
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            className={`w-full min-w-0 rounded-lg border bg-surface-container-low px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground ${focusField}`}
          />
        </div>
        <button
          type="submit"
          disabled={!newCommand.trim()}
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-surface-soft)] px-3 text-sm font-medium text-[var(--accent-text)] transition-colors hover:bg-[var(--btn-primary-bg)] hover:text-[var(--btn-primary-text)] disabled:opacity-50 ${focusRing}`}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Spawn
        </button>
      </form>
    </div>
  )
}
