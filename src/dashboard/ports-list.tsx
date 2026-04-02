"use client"

import * as React from "react"
import { Copy, Check, Globe, Plus, Trash2 } from "lucide-react"
import { cn } from "../lib/utils"

export interface ExposedPort {
  port: number
  url: string
  status: "active" | "pending"
}

export interface PortsListProps {
  ports: ExposedPort[]
  onExposePort: (port: number) => void
  onRemovePort?: (port: number) => void
  isExposing?: boolean
  className?: string
}

export function PortsList({ ports, onExposePort, onRemovePort, isExposing = false, className }: PortsListProps) {
  const [newPort, setNewPort] = React.useState("")
  const [copiedPort, setCopiedPort] = React.useState<number | null>(null)

  const handleCopy = async (url: string, port: number) => {
    await navigator.clipboard.writeText(url)
    setCopiedPort(port)
    setTimeout(() => setCopiedPort(null), 2000)
  }

  const handleExpose = () => {
    const port = parseInt(newPort, 10)
    if (port > 0 && port <= 65535) {
      onExposePort(port)
      setNewPort("")
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {ports.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Port</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Public URL</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ports.map((p) => (
                <tr key={p.port}>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{p.port}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleCopy(p.url, p.port)}
                      className="flex items-center gap-2 font-mono text-xs text-primary hover:underline cursor-pointer group"
                    >
                      <span className="truncate max-w-[300px]">{p.url}</span>
                      {copiedPort === p.port ? (
                        <Check className="h-3 w-3 text-[var(--surface-success-text)] shrink-0" />
                      ) : (
                        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      p.status === "active"
                        ? "bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]"
                        : "bg-[var(--surface-warning-bg)] text-[var(--surface-warning-text)]"
                    )}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {onRemovePort && (
                      <button
                        type="button"
                        onClick={() => onRemovePort(p.port)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
          <Globe className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No ports exposed yet</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          max={65535}
          placeholder="Port (e.g. 3000)"
          value={newPort}
          onChange={(e) => setNewPort(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleExpose()}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleExpose}
          disabled={!newPort || isExposing}
          className="inline-flex items-center gap-2 rounded-lg bg-primary/20 border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Expose
        </button>
      </div>
    </div>
  )
}
