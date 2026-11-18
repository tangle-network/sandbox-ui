"use client"

import * as React from "react"
import { Globe, Plus, Trash2 } from "lucide-react"
import { cn } from "../lib/utils"
import { CopyButton, StatusPill } from "@tangle-network/ui/primitives"
import { focusField, focusRing } from "@tangle-network/ui/utils"

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
  const [statusMessage, setStatusMessage] = React.useState("")
  const pendingRemovalRef = React.useRef<{ removed: number; next: number | null; restoreFocus: boolean } | null>(null)
  const removeButtonsRef = React.useRef(new Map<number, HTMLButtonElement>())
  const portInputRef = React.useRef<HTMLInputElement>(null)
  const portInputId = React.useId()
  const portErrorId = React.useId()
  const portNumber = Number(newPort)
  const validPort = /^\d+$/.test(newPort) && portNumber >= 1 && portNumber <= 65535
  const duplicatePort = validPort && ports.some((port) => port.port === portNumber)
  const portError = newPort === "" ? null : !validPort
    ? "Enter a whole port number from 1 to 65535."
    : duplicatePort ? `Port ${portNumber} is already exposed.` : null

  React.useEffect(() => {
    const pending = pendingRemovalRef.current
    if (!pending || ports.some((port) => port.port === pending.removed)) return
    setStatusMessage(`Port ${pending.removed} removed.`)
    if (pending.restoreFocus) {
      const nextButton = pending.next == null ? null : removeButtonsRef.current.get(pending.next)
      const focusTarget = nextButton ?? removeButtonsRef.current.values().next().value ?? portInputRef.current
      focusTarget?.focus()
    }
    pendingRemovalRef.current = null
  }, [ports])

  const handleExpose = () => {
    if (validPort && !duplicatePort && !isExposing) {
      onExposePort(portNumber)
      setNewPort("")
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <span role="status" className="sr-only">{statusMessage}</span>
      {ports.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container text-sm">
          <div aria-hidden="true" className="hidden border-b border-[var(--md3-outline-variant)] bg-surface-container-high px-3 py-2.5 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[4rem_minmax(0,1fr)_5.5rem_3rem] sm:gap-x-2">
            <span>Port</span>
            <span>Public URL</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-border">
            {ports.map((p, index) => (
              <li key={p.port} className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-3 py-2 sm:grid-cols-[4rem_minmax(0,1fr)_5.5rem_3rem] sm:py-1">
                <span className="col-start-1 row-start-1 font-mono text-xs text-foreground">
                  <span className="sr-only">Port </span>{p.port}
                </span>
                <CopyButton
                  text={p.url}
                  label={p.url}
                  copiedLabel={p.url}
                  aria-label={`Copy public URL for port ${p.port}: ${p.url}`}
                  className="col-span-2 row-start-3 min-h-10 min-w-0 flex-row-reverse justify-between border-0 bg-transparent px-0 text-left font-mono text-xs text-[var(--accent-text)] hover:underline sm:col-span-1 sm:col-start-2 sm:row-start-1 [&>span]:min-w-0 [&>span]:break-all sm:[&>span]:truncate [&>svg]:shrink-0"
                />
                <StatusPill
                  tone={p.status === "active" ? "success" : "warning"}
                  className="col-start-1 row-start-2 justify-self-start sm:col-start-3 sm:row-start-1"
                >
                  <span className="sr-only">Status: </span>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </StatusPill>
                {onRemovePort && (
                  <button
                    type="button"
                    aria-label={`Remove port ${p.port}`}
                    ref={(button) => {
                      if (button) removeButtonsRef.current.set(p.port, button)
                      else removeButtonsRef.current.delete(p.port)
                    }}
                    onClick={(event) => {
                      pendingRemovalRef.current = {
                        removed: p.port,
                        next: ports[index + 1]?.port ?? ports[index - 1]?.port ?? null,
                        restoreFocus: event.detail === 0,
                      }
                      onRemovePort(p.port)
                    }}
                    className={`col-start-2 row-start-1 inline-flex min-h-10 min-w-10 items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive sm:col-start-4 ${focusRing}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container p-6 text-center">
          <Globe className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No ports exposed yet</p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-[1_1_10rem]">
          <label htmlFor={portInputId} className="mb-1 block text-xs font-medium text-muted-foreground">Port number</label>
          <input
            ref={portInputRef}
            id={portInputId}
            type="number"
            min={1}
            max={65535}
            step={1}
            aria-invalid={Boolean(portError)}
            aria-describedby={portError ? portErrorId : undefined}
            placeholder="3000"
            value={newPort}
            onChange={(e) => setNewPort(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleExpose()}
            className={`w-full min-w-0 rounded-lg border bg-surface-container-low px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground ${focusField}`}
          />
        </div>
        <button
          type="button"
          onClick={handleExpose}
          disabled={!validPort || duplicatePort || isExposing}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] shadow-sm transition-colors hover:bg-[var(--btn-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none ${focusRing}`}
        >
          <Plus className="h-4 w-4" />
          Expose
        </button>
      </div>
      {portError && <p id={portErrorId} className="text-xs text-[var(--surface-danger-text)]">{portError}</p>}
    </div>
  )
}
