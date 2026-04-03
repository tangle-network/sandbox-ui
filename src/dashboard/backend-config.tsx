"use client"

import * as React from "react"
import { Bot, Plus, RefreshCw, Trash2, Server, Wrench } from "lucide-react"
import { cn } from "../lib/utils"

export interface BackendStatusData {
  running: boolean
  model?: string
  provider?: string
  uptime?: number
}

export interface McpServer {
  name: string
  command: string
  args?: string[]
  status?: "running" | "stopped" | "error"
}

export interface BackendConfigProps {
  status: BackendStatusData | null
  mcpServers: McpServer[]
  onAddMcp: (server: { name: string; command: string; args?: string[] }) => void
  onRemoveMcp: (name: string) => void
  onRestart: () => void
  loading?: boolean
  className?: string
}

export function BackendConfig({
  status,
  mcpServers,
  onAddMcp,
  onRemoveMcp,
  onRestart,
  loading = false,
  className,
}: BackendConfigProps) {
  const [showAddMcp, setShowAddMcp] = React.useState(false)
  const [mcpName, setMcpName] = React.useState("")
  const [mcpCommand, setMcpCommand] = React.useState("")
  const [mcpArgs, setMcpArgs] = React.useState("")

  const handleAddMcp = () => {
    const name = mcpName.trim()
    const command = mcpCommand.trim()
    if (name && command) {
      onAddMcp({
        name,
        command,
        args: mcpArgs.trim() ? mcpArgs.trim().split(/\s+/) : undefined,
      })
      setMcpName("")
      setMcpCommand("")
      setMcpArgs("")
      setShowAddMcp(false)
    }
  }

  if (loading || !status) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/20 p-6 text-center", className)}>
        <Bot className="mx-auto h-6 w-6 text-muted-foreground animate-pulse mb-2" />
        <p className="text-sm text-muted-foreground">Loading backend status...</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Agent Status */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent Status</h4>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors border border-border"
          >
            <RefreshCw className="h-3 w-3" />
            Restart
          </button>
        </div>
        <div className="p-4">
          <dl className="grid grid-cols-[100px_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                status.running
                  ? "bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]"
                  : "bg-destructive/10 text-destructive"
              )}>
                {status.running ? "Running" : "Stopped"}
              </span>
            </dd>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="font-mono text-xs">{status.model ?? "Default"}</dd>
            {status.provider && (
              <>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-mono text-xs">{status.provider}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* MCP Servers */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5" />
            MCP Servers
          </h4>
          <button
            type="button"
            onClick={() => setShowAddMcp(!showAddMcp)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/20 border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {mcpServers.length > 0 ? (
          <div className="divide-y divide-border">
            {mcpServers.map((s) => (
              <div key={s.name} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{s.command} {s.args?.join(" ") ?? ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.status && (
                    <span className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
                      s.status === "running" ? "bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]" :
                      s.status === "error" ? "bg-destructive/10 text-destructive" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {s.status}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveMcp(s.name)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">No MCP servers configured</p>
          </div>
        )}

        {showAddMcp && (
          <div className="p-4 border-t border-border bg-muted/10 space-y-2">
            <input
              type="text"
              placeholder="Server name"
              value={mcpName}
              onChange={(e) => setMcpName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Command (e.g. npx @server/mcp)"
              value={mcpCommand}
              onChange={(e) => setMcpCommand(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Arguments (space-separated, optional)"
              value={mcpArgs}
              onChange={(e) => setMcpArgs(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddMcp(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddMcp}
                disabled={!mcpName.trim() || !mcpCommand.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Add Server
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
