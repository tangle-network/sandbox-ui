"use client"

import * as React from "react"
import { Lock, Plus, Trash2, Eye, EyeOff, Check, Copy, AlertCircle } from "lucide-react"
import { cn } from "../lib/utils"

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

  const loadSecrets = React.useCallback(async () => {
    try {
      setError(null)
      const data = await apiClient.listSecrets()
      setSecrets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load secrets")
    } finally {
      setLoading(false)
    }
  }, [apiClient])

  React.useEffect(() => {
    loadSecrets()
  }, [loadSecrets])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setIsCreating(true)
    setCreateError(null)
    try {
      await apiClient.createSecret(newName.trim(), newValue)
      setIsCreateOpen(false)
      setNewName("")
      setNewValue("")
      setShowValue(false)
      loadSecrets()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create secret")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (name: string) => {
    try {
      await apiClient.deleteSecret(name)
      setDeleteTarget(null)
      loadSecrets()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete secret")
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
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-foreground">Secrets</h1>
          <p className="mt-1 text-muted-foreground">
            Secrets securely stored here will be automatically exposed as environment variables across all your new sandboxes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary/20 border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          Create Secret
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Create dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => { setIsCreateOpen(false); setNewName(""); setNewValue(""); setCreateError(null); setShowValue(false) }}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-1">Create Secret</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Secrets securely stored here will be automatically exposed as environment variables across all your new sandboxes.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                  placeholder="MY_SECRET_KEY"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Value</label>
                <div className="relative">
                  <input
                    type={showValue ? "text" : "password"}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Enter secret value..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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

            {createError && (
              <p className="mt-3 text-sm text-destructive">{createError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setIsCreateOpen(false); setNewName(""); setNewValue(""); setCreateError(null) }}
                className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || !newValue || isCreating}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
              >
                {isCreating ? "Creating..." : "Create Secret"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-2">Delete Secret?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete <span className="font-mono font-bold text-foreground">{deleteTarget}</span>. Sandboxes using this secret will lose access to it.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteTarget && handleDelete(deleteTarget)}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors active:scale-[0.97]"
              >
                Delete Secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secrets table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/20 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Your Secrets</h2>
          <span className="text-xs text-muted-foreground font-mono">{secrets.length} secret{secrets.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : secrets.length === 0 ? (
          <div className="p-12 text-center">
            <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mb-1">No secrets yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create a secret to inject into your sandboxes.</p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary/20 border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Secret
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/10 border-b border-border">
              <tr>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-muted-foreground">Created</th>
                <th className="px-6 py-2.5 text-right text-xs font-medium text-muted-foreground w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {secrets.map((secret) => (
                <tr key={secret.name} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs font-bold text-foreground">{secret.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">{formatDate(secret.createdAt)}</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(secret.name)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
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
    </div>
  )
}
