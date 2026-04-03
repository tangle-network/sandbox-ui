"use client"

import * as React from "react"
import { Network, Plus, Trash2, ShieldAlert } from "lucide-react"
import { cn } from "../lib/utils"

export interface NetworkConfigData {
  blockOutbound: boolean
  allowList: string[]
}

export interface NetworkConfigProps {
  config: NetworkConfigData | null
  onUpdate: (config: Partial<NetworkConfigData>) => void
  loading?: boolean
  className?: string
}

export function NetworkConfig({ config, onUpdate, loading = false, className }: NetworkConfigProps) {
  const [newCidr, setNewCidr] = React.useState("")

  const isValidCidr = (value: string): boolean => {
    const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/)
    if (!match) return false
    const octets = [match[1], match[2], match[3], match[4]].map(Number)
    const prefix = Number(match[5])
    return octets.every((o) => o <= 255) && prefix <= 32
  }

  const handleAddCidr = () => {
    const cidr = newCidr.trim()
    if (cidr && config && isValidCidr(cidr) && !config.allowList.includes(cidr)) {
      onUpdate({ allowList: [...config.allowList, cidr] })
      setNewCidr("")
    }
  }

  const handleRemoveCidr = (cidr: string) => {
    if (config) {
      onUpdate({ allowList: config.allowList.filter((c) => c !== cidr) })
    }
  }

  if (loading || !config) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/20 p-6 text-center", className)}>
        <Network className="mx-auto h-6 w-6 text-muted-foreground animate-pulse mb-2" />
        <p className="text-sm text-muted-foreground">Loading network configuration...</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Outbound toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Block Outbound Traffic</p>
            <p className="text-xs text-muted-foreground">Prevent the sandbox from making external network requests</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.blockOutbound}
          aria-label="Block outbound traffic"
          onClick={() => onUpdate({ blockOutbound: !config.blockOutbound })}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            config.blockOutbound ? "bg-destructive" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
              config.blockOutbound ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* CIDR Allowlist */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Allowlist (CIDR)</h4>
        {config.allowList.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {config.allowList.map((cidr) => (
              <div key={cidr} className="flex items-center justify-between rounded border border-border bg-muted/20 px-3 py-2">
                <span className="font-mono text-xs text-foreground">{cidr}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCidr(cidr)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mb-3">No CIDR rules configured. All traffic is allowed.</p>
        )}

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="CIDR (e.g. 10.0.0.0/8)"
            value={newCidr}
            onChange={(e) => setNewCidr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCidr()}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleAddCidr}
            disabled={!newCidr.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary/20 border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
