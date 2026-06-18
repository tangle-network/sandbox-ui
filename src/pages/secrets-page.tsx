"use client"

import * as React from "react"
import { Lock, Plus, Trash2, Eye, EyeOff, AlertCircle, Key, Shield, CheckCircle, Users, ArrowRight, Upload } from "lucide-react"
import { cn } from "../lib/utils"
import { PageHeader } from "../primitives"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tangle-network/ui/primitives"
import { InfoPanel } from "../dashboard/info-panel"
import { parseEnvText, type EnvImportResult } from "./env-importer"

/** Cap pasted/uploaded import sources so a pathological file cannot blow up the parser/UI. */
const MAX_IMPORT_FILE_BYTES = 256 * 1024 // 256 KiB

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

type ImportRowStatus = "idle" | "success" | "error"

export interface SecretsPageProps {
  apiClient: SecretsApiClient
  className?: string
  /**
   * Optional hint pointing users at team-level secrets. When provided,
   * renders a persistent informational banner below the header clarifying
   * that personal secrets are NOT shared with teams and linking the
   * user to their team-management page to configure shared secrets
   * there. Omit entirely to hide the banner (e.g. in deployments
   * without teams).
   */
  teamSecretsHint?: {
    /** Callback fired when the user clicks the banner's CTA. */
    onNavigate: () => void
    /** CTA label. Defaults to "Manage team secrets". */
    label?: string
  }
}

export function SecretsPage({ apiClient, className, teamSecretsHint }: SecretsPageProps) {
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

  // --- Bulk .env import state ---
  const [isImportOpen, setIsImportOpen] = React.useState(false)
  const [importText, setImportText] = React.useState("")
  const [importResult, setImportResult] = React.useState<EnvImportResult | null>(null)
  const [rowStatus, setRowStatus] = React.useState<ImportRowStatus[]>([])
  const [rowMessages, setRowMessages] = React.useState<string[]>([])
  const [isImportSaving, setIsImportSaving] = React.useState(false)
  const [showImportValues, setShowImportValues] = React.useState(false)
  const [importFileError, setImportFileError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
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
    if (!newName.trim() || !newValue.trim()) return
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

  const resetImportState = () => {
    setImportText("")
    setImportResult(null)
    setRowStatus([])
    setRowMessages([])
    setShowImportValues(false)
    setImportFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const runParse = (text: string) => {
    const result = parseEnvText(text)
    setImportResult(result)
    setRowStatus(new Array(result.rows.length).fill("idle"))
    setRowMessages(new Array(result.rows.length).fill(""))
  }

  const handleParse = () => {
    runParse(importText)
  }

  const handleImportFile = async (file: File | null) => {
    if (!file) return
    setImportFileError(null)
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setImportFileError(`File is too large (${Math.round(file.size / 1024)} KiB). Limit is ${MAX_IMPORT_FILE_BYTES / 1024} KiB.`)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    const text = await file.text()
    setImportText(text)
    runParse(text)
  }

  const updateRowKey = (index: number, next: string) => {
    setImportResult((prev) => {
      if (!prev) return prev
      const rows = prev.rows.slice()
      rows[index] = { ...rows[index], key: next.toUpperCase().replace(/[^A-Z0-9_]/g, "_") }
      return { ...prev, rows }
    })
  }

  const updateRowValue = (index: number, next: string) => {
    setImportResult((prev) => {
      if (!prev) return prev
      const rows = prev.rows.slice()
      rows[index] = { ...rows[index], value: next }
      return { ...prev, rows }
    })
  }

  const removeImportRow = (index: number) => {
    setImportResult((prev) => {
      if (!prev) return prev
      const rows = prev.rows.slice()
      rows.splice(index, 1)
      return { ...prev, rows }
    })
    setRowStatus((prev) => { const next = prev.slice(); next.splice(index, 1); return next })
    setRowMessages((prev) => { const next = prev.slice(); next.splice(index, 1); return next })
  }

  const importRows = importResult?.rows ?? []
  const hasImportErrors = !!(importResult && importResult.errors.length > 0)
  const importSaveDisabled =
    isImportSaving ||
    importRows.length === 0 ||
    hasImportErrors ||
    importRows.some((r) => !r.key || !/[A-Z0-9]/.test(r.key) || !r.value.trim())

  const handleImportSave = async () => {
    if (!importResult || importSaveDisabled) return
    const rows = importResult.rows
    setIsImportSaving(true)
    const statuses: ImportRowStatus[] = new Array(rows.length).fill("idle")
    const messages: string[] = new Array(rows.length).fill("")
    try {
      for (let i = 0; i < rows.length; i++) {
        try {
          await apiRef.current.createSecret(rows[i].key, rows[i].value)
          statuses[i] = "success"
        } catch (err) {
          statuses[i] = "error"
          messages[i] = err instanceof Error ? err.message : "Failed to create secret"
        }
      }
      setRowStatus(statuses)
      setRowMessages(messages)
      // Refresh so successful secrets appear in the (masked) list.
      // Holds the interaction lock open until the refresh completes.
      await loadSecrets(false)
      if (statuses.every((s) => s === "success")) {
        setIsImportOpen(false)
        resetImportState()
      }
    } finally {
      setIsImportSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const ts = /^\d+$/.test(dateStr) ? Number(dateStr) : dateStr
      const date = new Date(ts)
      if (Number.isNaN(date.getTime())) return dateStr
      return date.toLocaleDateString("en-US")
    } catch {
      return dateStr
    }
  }

  return (
    <div className={cn("mx-auto w-full max-w-6xl space-y-8", className)}>
      <PageHeader
        title="Environment Secrets"
        description="Secrets are securely stored and automatically exposed as environment variables across all your sandboxes."
        action={
          <>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors active:scale-[0.97]"
            >
              <Upload className="h-4 w-4" />
              Import .env
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--btn-primary-bg)] border border-[var(--border-accent,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              New Secret
            </button>
          </>
        }
      />

      {/* Team-secrets hint — rendered only when the host app opts in.
          These secrets are personal; team-scoped credentials live on the
          team management page. The banner prevents users from pasting
          shared credentials here and wondering why teammates can't see
          them. */}
      {teamSecretsHint && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-[var(--accent-surface-soft)]/40 px-4 py-3">
          <Users className="h-5 w-5 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-foreground">
              Setting up secrets for a team?
            </p>
            <p className="mt-0.5 text-muted-foreground text-xs">
              Secrets here are <strong>personal</strong> — only available in
              sandboxes you create. To share credentials with teammates,
              configure them on the team page instead.
            </p>
          </div>
          <button
            type="button"
            onClick={teamSecretsHint.onNavigate}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            {teamSecretsHint.label ?? "Manage team secrets"}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      )}

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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (newName.trim() && newValue.trim() && !isCreating) handleCreate()
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="secret-name" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Name</label>
              <input
                id="secret-name"
                name="secret-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                placeholder="MY_SECRET_KEY"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="secret-value" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Value</label>
              <div className="relative">
                <input
                  id="secret-value"
                  name="secret-value"
                  type={showValue ? "text" : "password"}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter secret value..."
                  autoComplete="new-password"
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowValue(!showValue)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showValue ? "Hide value" : "Show value"}
                >
                  {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">This value cannot be retrieved after creation.</p>
            </div>
            {/* Hidden submit so the form is valid and Enter key submits even though the visible
                submit button lives in DialogFooter and uses type="button" for layout reasons. */}
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">Submit</button>
          </form>
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
              disabled={!newName.trim() || !newValue.trim() || isCreating}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-bold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {isCreating ? "Creating..." : "Create Secret"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk .env import dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open && !isImportSaving) { setIsImportOpen(false); resetImportState() } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Secrets</DialogTitle>
            <DialogDescription>
              Upload a <span className="font-mono">.env</span> file or paste key-value pairs. Review and edit each row before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Source controls */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".env,.txt,text/plain"
                  aria-label="Upload .env file"
                  className="hidden"
                  onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Choose .env file
                </button>
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={!importText.trim()}
                  className="rounded-md bg-[var(--btn-primary-bg)] px-3 py-2 text-xs font-bold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors disabled:opacity-50"
                >
                  Parse
                </button>
              </div>
              <textarea
                aria-label="Paste .env contents"
                placeholder={"Paste .env contents, e.g.\nAPI_KEY=abc123\n# comment\nexport DB_URL=postgres://localhost"}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground">
                Lines starting with <span className="font-mono">#</span> are comments. Text after <span className="font-mono">#</span> inside a value is preserved.
              </p>
              {importFileError && (
                <p className="text-xs text-destructive" role="alert">{importFileError}</p>
              )}
            </div>

            {/* Parse errors */}
            {importResult && importResult.errors.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-destructive">
                  {importResult.errors.length} line{importResult.errors.length !== 1 ? "s" : ""} could not be parsed
                </p>
                <ul className="space-y-1">
                  {importResult.errors.map((err) => (
                    <li key={err.lineNumber} className="text-xs text-destructive" role="alert">
                      Line {err.lineNumber}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Parsed, editable rows */}
            {importResult && importResult.rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {importResult.rows.length} secret{importResult.rows.length !== 1 ? "s" : ""} ready
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowImportValues((s) => !s)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {showImportValues ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showImportValues ? "Hide values" : "Show values"}
                  </button>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {importResult.rows.map((row, index) => {
                    const status = rowStatus[index]
                    const message = rowMessages[index]
                    return (
                      <div key={`${row.lineNumber}-${index}`} className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2">
                        <input
                          type="text"
                          aria-label={`Import row ${index + 1} key`}
                          value={row.key}
                          onChange={(e) => updateRowKey(index, e.target.value)}
                          disabled={isImportSaving}
                          className="w-2/5 rounded border border-border bg-card px-2 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                        />
                        <input
                          type={showImportValues ? "text" : "password"}
                          aria-label={`Import row ${index + 1} value`}
                          value={row.value}
                          onChange={(e) => updateRowValue(index, e.target.value)}
                          disabled={isImportSaving}
                          className="w-2/5 rounded border border-border bg-card px-2 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                        />
                        <div className="flex w-1/5 flex-col items-end gap-1">
                          {status === "success" && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--surface-success-text,#047857)]">
                              <CheckCircle className="h-3.5 w-3.5" /> Saved
                            </span>
                          )}
                          {status === "error" && (
                            <span className="text-right text-xs font-semibold text-destructive" title={message}>
                              {message || "Failed"}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImportRow(index)}
                            disabled={isImportSaving}
                            aria-label={`Remove import row ${index + 1}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Nothing parseable */}
            {importResult && importResult.rows.length === 0 && importResult.errors.length === 0 && (
              <p className="text-xs text-muted-foreground">No secrets found. Add at least one KEY=value line.</p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => { setIsImportOpen(false); resetImportState() }}
              disabled={isImportSaving}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImportSave}
              disabled={importSaveDisabled}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-bold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {isImportSaving
                ? "Importing..."
                : importRows.length > 0
                  ? `Import ${importRows.length} secret${importRows.length === 1 ? "" : "s"}`
                  : "Import secrets"}
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
              // aria-label distinguishes this empty-state CTA from the
              // header "New Secret" button for assistive tech (and tests)
              // while keeping the visible verb consistent across the page.
              aria-label="Create your first secret"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              New Secret
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
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-primary,hsl(var(--primary)))] text-[var(--btn-primary-text)]">
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
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-primary,hsl(var(--primary)))] text-[var(--btn-primary-text)]">
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
