"use client"

import * as React from "react"
import { Activity, Plus, Skull, Terminal } from "lucide-react"
import { cn } from "../lib/utils"

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

  const handleSpawn = () => {
    const cmd = newCommand.trim()
    if (cmd) {
      onSpawn(cmd)
      setNewCommand("")
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {loading ? (
        <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
          <Activity className="mx-auto h-6 w-6 text-muted-foreground animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">Loading processes...</p>
        </div>
      ) : processes.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">PID</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Command</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Uptime</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {processes.map((p) => (
                <tr key={`${p.pid}-${p.startedAt ?? p.command}`}>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{p.pid}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground truncate max-w-[250px]">{p.command}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      p.running
                        ? "bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {p.running ? "running" : `exited (${p.exitCode ?? "?"})`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatUptime(p.startedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.running && (
                      <button
                        type="button"
                        onClick={() => onKill(p.pid)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                        title="Kill process"
                      >
                        <Skull className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
          <Terminal className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No processes running</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Command (e.g. node server.js)"
          value={newCommand}
          onChange={(e) => setNewCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSpawn()}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleSpawn}
          disabled={!newCommand.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary/20 border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Spawn
        </button>
      </div>
    </div>
  )
}
