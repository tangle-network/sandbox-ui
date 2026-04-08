"use client"

import * as React from "react"
import { Lock, Plus, Trash2, Eye, EyeOff, AlertCircle, Key, Shield, CheckCircle } from "lucide-react"
import { cn } from "../lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog"
import { InfoPanel } from "../dashboard/info-panel"

export interface Secret {
  name: string
  createdAt: string
  updatedAt?: string
}

export interface SecretsApiClient {
  listSecrets: () => Promise<Secret[]>
  createSecret: (name: string, value: string) => Promise<void>
  deleteSecret: (name: string) => Promise<void>
}

export interface SecretsPageProps {
  apiClient: SecretsApiClient
  className?: string
}

export function SecretsPage({ apiClient, className }: SecretsPageProps) {
  const [secrets, setSecrets] = React.useState<Secret[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newValue, setNewValue] = React.useState("")
  const [showValue, setShowValue] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const apiRef = React.useRef(apiClient)
  apiRef.current = apiClient
  const loadGenRef = React.useRef(0)

  const loadSecrets = React.useCallback(async (showSpinner = true) => {
    const gen = ++loadGenRef.current
    try {
      if (showSpinner) setLoading(true)
      setError(null)
      const data = await apiRef.current.listSecrets()
      if (gen !== loadGenRef.current) return
      setSecrets(data)
    } catch (err) {
      if (gen !== loadGenRef.current) return
      setError(err instanceof Error ? err.message : "Failed to load secrets")
    } finally {
      if (gen === loadGenRef.current) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadSecrets()
  }, [loadSecrets])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setIsCreating(true)
    setCreateError(null)
    try {
      await apiRef.current.createSecret(newName.trim(), newValue)
      setIsCreateOpen(false)
      setNewName("")
      setNewValue("")
      setShowValue(false)
      await loadSecrets(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create secret")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (name: string) => {
    setIsDeleting(true)
    try {
      await apiRef.current.deleteSecret(name)
      setDeleteTarget(null)
      await loadSecrets(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete secret")
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const ts = /^\d+$/.test(dateStr) ? Number(dateStr) : dateStr
      const date = new Date(ts)
      if (Number.isNaN(date.getTime())) return dateStr
      return date.toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  return (
    <div className={cn("mx-auto w-full max-w-7xl space-y-8", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Environment Secrets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Secrets are securely stored and automatically exposed as environment variables across all your sandboxes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--btn-primary-bg,hsl(var(--primary)))] border border-[var(--border-accent,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--btn-primary-text,#fff)] hover:bg-[var(--btn-primary-hover,hsl(var(--primary)/0.9))] transition-colors active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          Add Secret
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Active Secrets</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-foreground">{secrets.length}</span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
          <div className="mt-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[var(--surface-success-text,#047857)]" />
            <span className="text-sm font-semibold text-[var(--surface-success-text,#047857)]">Encrypted</span>
          </div>
        </div>
        <InfoPanel
          className="md:col-span-2"
          label="Security Audit"
          title="All engines operational."
          description="Secrets are encrypted at rest using AES-256."
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setNewName(""); setNewValue(""); setCreateError(null); setShowValue(false) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Secret</DialogTitle>
            <DialogDescription>
              Secrets are automatically exposed as environment variables across all your new sandboxes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                placeholder="MY_SECRET_KEY"
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Value</label>
              <div className="relative">
                <input
                  type={showValue ? "text" : "password"}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter secret value..."
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowValue(!showValue)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">This value cannot be retrieved after creation.</p>
            </div>
          </div>
          {createError && <p className="mt-3 text-sm text-destructive">{createError}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={() => { setIsCreateOpen(false); setNewName(""); setNewValue(""); setCreateError(null) }}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || !newValue || isCreating}
              className="rounded-md bg-[var(--btn-primary-bg,hsl(var(--primary)))] px-4 py-2 text-sm font-bold text-[var(--btn-primary-text,#fff)] hover:bg-[var(--btn-primary-hover,hsl(var(--primary)/0.9))] transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {isCreating ? "Creating..." : "Create Secret"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Secret?</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-mono font-bold text-foreground">{deleteTarget}</span>. Sandboxes using this secret will lose access to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isDeleting}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {isDeleting ? "Deleting..." : "Delete Secret"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secrets table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex gap-6">
            <button type="button" className="text-xs font-bold uppercase tracking-widest text-foreground border-b-2 border-foreground pb-1">All Secrets</button>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{secrets.length} secret{secrets.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : secrets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No secrets yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">Create a secret to inject into your sandboxes.</p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--btn-primary-bg,hsl(var(--primary)))] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text,#fff)] hover:bg-[var(--btn-primary-hover,hsl(var(--primary)/0.9))] transition-colors active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Create Secret
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Secret Name</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Encrypted Value</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Created</th>
                <th className="px-6 py-4 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {secrets.map((secret) => (
                <tr key={secret.name} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-bold font-mono text-foreground">{secret.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                      ••••••••••••••••
                    </code>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xs text-muted-foreground">{formatDate(secret.createdAt)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(secret.name)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label={`Delete ${secret.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom info section */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-primary,hsl(var(--primary)))] text-[var(--btn-primary-text,#fff)]">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Encryption Standard</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your secrets are encrypted using AES-256-GCM at rest and TLS 1.3 in transit. Hardware Security Modules manage all root keys.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-primary,hsl(var(--primary)))] text-[var(--btn-primary-text,#fff)]">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Access Policy</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Secrets are injected at sandbox creation time and are never exposed in logs, API responses, or container metadata.
          </p>
        </div>
      </div>
    </div>
  )
}
