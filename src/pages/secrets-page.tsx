"use client"

import * as React from "react"
import { Lock, Plus, Trash2, Eye, EyeOff, AlertCircle, Key, CheckCircle, Upload } from "lucide-react"
import { cn } from "../lib/utils"
import { DashboardPageHeader } from "../dashboard/page-layout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tangle-network/ui/primitives"
import { parseEnvText, type EnvImportResult } from "./env-importer"
import { focusField } from "@tangle-network/ui/utils"
import { ShellHeader } from "../workspace/shell-header"

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
  /**
   * Replace the value of an existing secret. When provided, each row offers
   * Replace value; omit it when the backend cannot overwrite a saved value.
   */
  updateSecret?: (name: string, value: string) => Promise<void>
}

type ImportRowStatus = "idle" | "success" | "error"

const DEFAULT_DESCRIPTION = "Manage environment variables for your sandboxes."
const DEFAULT_CREATE_DESCRIPTION = "Secrets are automatically exposed as environment variables across all your new sandboxes."
const DEFAULT_EMPTY_DESCRIPTION = "Create a secret to inject into your sandboxes."
const DEFAULT_DELETE_CONSEQUENCE = "Sandboxes using this secret will lose access to it."

export interface SecretsPageProps {
  apiClient: SecretsApiClient
  className?: string
  /** Page title. Defaults to "Environment Secrets". */
  title?: string
  /** Text below the title. Defaults to the Sandbox environment-variable description. */
  description?: React.ReactNode
  /** Explains where a new secret is used, in the create dialog. */
  createDescription?: string
  /** Text in the empty state. */
  emptyDescription?: string
  /** Sentence after "This will permanently delete NAME." in the delete dialog. */
  deleteConsequence?: string
  /**
   * `page` renders a padded page with a bordered list.
   * `pane` fills its container like a workspace pane: a header bar above an
   * edge-to-edge list that scrolls inside the available height.
   */
  variant?: "page" | "pane"
  /** Optional navigation to team-scoped credentials, shown beside the page actions. */
  teamSecretsHint?: {
    /** Navigate to team-scoped credentials. */
    onNavigate: () => void
    /** CTA label. Defaults to "Manage team secrets". */
    label?: string
  }
}

export function SecretsPage({
  apiClient,
  className,
  teamSecretsHint,
  title = "Environment Secrets",
  description = DEFAULT_DESCRIPTION,
  createDescription = DEFAULT_CREATE_DESCRIPTION,
  emptyDescription = DEFAULT_EMPTY_DESCRIPTION,
  deleteConsequence = DEFAULT_DELETE_CONSEQUENCE,
  variant = "page",
}: SecretsPageProps) {
  const pane = variant === "pane"
  const canReplace = typeof apiClient.updateSecret === "function"
  const [secrets, setSecrets] = React.useState<Secret[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newValue, setNewValue] = React.useState("")
  const [showValue, setShowValue] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const [replaceTarget, setReplaceTarget] = React.useState<string | null>(null)
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

  const openCreate = () => {
    setReplaceTarget(null)
    setNewName("")
    setNewValue("")
    setCreateError(null)
    setShowValue(false)
    setIsCreateOpen(true)
  }

  const openReplace = (name: string) => {
    setReplaceTarget(name)
    setNewName(name)
    setNewValue("")
    setCreateError(null)
    setShowValue(false)
    setIsCreateOpen(true)
  }

  const closeCreate = () => {
    setIsCreateOpen(false)
    setReplaceTarget(null)
    setNewName("")
    setNewValue("")
    setCreateError(null)
    setShowValue(false)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newValue.trim()) return
    setIsCreating(true)
    setCreateError(null)
    try {
      const update = apiRef.current.updateSecret
      if (replaceTarget && update) await update(replaceTarget, newValue)
      else await apiRef.current.createSecret(newName.trim(), newValue)
      closeCreate()
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

  const actions = (
    <>
      {teamSecretsHint && <button type="button" onClick={teamSecretsHint.onNavigate}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface-container-high px-3 text-sm font-medium text-foreground shadow-sm hover:bg-surface-container-highest">
        {teamSecretsHint.label ?? "Team secrets"}
      </button>}
      <button
        type="button"
        onClick={() => setIsImportOpen(true)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container-high px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-container-high active:scale-[0.97] sm:gap-2"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        Import .env
      </button>
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-accent,transparent)] bg-[var(--btn-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)] active:scale-[0.97] sm:gap-2 sm:px-4"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New Secret
      </button>
    </>
  )

  return (
    <div
      className={cn(
        pane ? "flex h-full min-h-0 w-full flex-col" : "w-full min-w-0 space-y-5",
        className,
      )}
    >
      {pane ? (
        <>
          {/* A ShellHeader row, so the pane's divider continues the rail's; the
              description reads under it instead of growing the row. */}
          <ShellHeader as="header" className="justify-between gap-4 bg-transparent px-4 sm:px-6">
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-foreground">{title}</h1>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </ShellHeader>
          {description && <p className="shrink-0 px-4 pt-4 text-sm text-muted-foreground sm:px-6">{description}</p>}
        </>
      ) : (
        <DashboardPageHeader title={title} description={description} actions={actions} />
      )}

      {/* Error banner. A failed first load renders its own retry state in the list. */}
      {error && (secrets.length > 0 || loading) && (
        <div role="alert" className={cn(
          "flex items-center gap-3 border-destructive/30 bg-destructive/10 p-4",
          pane ? "shrink-0 border-b sm:px-6" : "rounded-lg border",
        )}>
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) closeCreate() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{replaceTarget ? "Replace Value" : "Create Secret"}</DialogTitle>
            <DialogDescription>
              {replaceTarget
                ? <>Save a new value for <span className="font-mono font-bold text-foreground">{replaceTarget}</span>. The current value is overwritten and cannot be recovered.</>
                : createDescription}
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
                readOnly={replaceTarget !== null}
                aria-readonly={replaceTarget !== null}
                className={`w-full rounded-md border bg-surface-container-low px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground ${focusField}`}
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
                  autoFocus={replaceTarget !== null}
                  className={`w-full rounded-md border bg-surface-container-low px-3 py-2.5 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground ${focusField}`}
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
              <p className="mt-1.5 text-xs text-muted-foreground">This value cannot be retrieved after it is saved.</p>
            </div>
            {/* Hidden submit so the form is valid and Enter key submits even though the visible
                submit button lives in DialogFooter and uses type="button" for layout reasons. */}
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">Submit</button>
          </form>
          {createError && <p className="mt-3 text-sm text-destructive">{createError}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={closeCreate}
              className="rounded-md border border-[var(--md3-outline-variant)] bg-surface-container px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || !newValue.trim() || isCreating}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-bold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {isCreating ? "Saving..." : replaceTarget ? "Replace Value" : "Create Secret"}
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
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--md3-outline-variant)] bg-surface-container px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-container-high transition-colors"
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
                className={`w-full rounded-md border bg-surface-container-low px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground ${focusField}`}
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
                      <div key={`${row.lineNumber}-${index}`} className="flex items-start gap-2 rounded-md border border-[var(--md3-outline-variant)] bg-surface-container-high p-2">
                        <input
                          type="text"
                          aria-label={`Import row ${index + 1} key`}
                          value={row.key}
                          onChange={(e) => updateRowKey(index, e.target.value)}
                          disabled={isImportSaving}
                          className={`w-2/5 rounded border bg-surface-container-low px-2 py-1.5 font-mono text-xs text-foreground disabled:opacity-60 ${focusField}`}
                        />
                        <input
                          type={showImportValues ? "text" : "password"}
                          aria-label={`Import row ${index + 1} value`}
                          value={row.value}
                          onChange={(e) => updateRowValue(index, e.target.value)}
                          disabled={isImportSaving}
                          className={`w-2/5 rounded border bg-surface-container-low px-2 py-1.5 font-mono text-xs text-foreground disabled:opacity-60 ${focusField}`}
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
              className="rounded-md border border-[var(--md3-outline-variant)] bg-surface-container px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:pointer-events-none"
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
              This will permanently delete <span className="font-mono font-bold text-foreground">{deleteTarget}</span>. {deleteConsequence}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-md border border-[var(--md3-outline-variant)] bg-surface-container px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-container-high transition-colors"
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

      {/* Secrets list */}
      <section
        aria-label={title}
        className={cn(
          pane
            ? "min-h-0 flex-1 overflow-y-auto"
            : "overflow-hidden rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container shadow-[var(--shadow-card)]",
        )}
      >
        {loading ? (
          <div role="status" aria-busy="true" className="divide-y divide-border">
            <span className="sr-only">Loading secrets…</span>
            {[44, 36, 52].map((width) => (
              <div key={width} className="flex items-center gap-3 px-4 py-4 sm:px-6" aria-hidden="true">
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                <div className="h-4 animate-pulse rounded bg-muted" style={{ width: `${width * 4}px` }} />
              </div>
            ))}
          </div>
        ) : error && secrets.length === 0 ? (
          <div role="alert" className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <AlertCircle className="mb-4 h-10 w-10 text-destructive" aria-hidden="true" />
            <h3 className="text-base font-semibold text-foreground">Secrets could not load</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => void loadSecrets()}
              className="mt-6 rounded-md border border-[var(--md3-outline-variant)] bg-surface-container px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-container-high"
            >
              Retry
            </button>
          </div>
        ) : secrets.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Lock className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-foreground">No secrets yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
            <button
              type="button"
              onClick={openCreate}
              // aria-label distinguishes this empty-state CTA from the
              // header "New Secret" button for assistive tech (and tests)
              // while keeping the visible verb consistent across the page.
              aria-label="Create your first secret"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)] active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Secret
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{secrets.length} secret{secrets.length !== 1 ? "s" : ""}</caption>
            <thead className={cn(pane && "sticky top-0 z-10 bg-background")}>
              <tr className="border-b border-[var(--md3-outline-variant)]">
                <th scope="col" className="px-4 py-2.5 text-xs font-medium text-muted-foreground sm:px-6">
                  Name <span className="ml-1 font-mono tabular-nums">{secrets.length}</span>
                </th>
                <th scope="col" className="hidden px-4 py-2.5 text-xs font-medium text-muted-foreground md:table-cell">Value</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right text-xs font-medium text-muted-foreground sm:table-cell">Updated</th>
                <th scope="col" className="w-px px-4 py-2.5 sm:pr-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {secrets.map((secret) => {
                const changedAt = formatDate(secret.updatedAt ?? secret.createdAt)
                return (
                  <tr key={secret.name} className="transition-colors hover:bg-surface-container-high">
                    <td className="py-3 pl-4 pr-1 sm:px-6">
                      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                        <Key className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0">
                          <span className="font-mono text-[13px] font-semibold text-foreground [overflow-wrap:anywhere] sm:text-sm">{secret.name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">Updated {changedAt}</span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="font-mono text-xs tracking-widest text-muted-foreground" aria-label="Value hidden">••••••••••••</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right text-xs text-muted-foreground sm:table-cell">{changedAt}</td>
                    <td className="whitespace-nowrap py-3 pl-1 pr-3 sm:px-4 sm:pr-6">
                      <div className="flex items-center justify-end gap-1">
                        {canReplace && (
                          <button
                            type="button"
                            onClick={() => openReplace(secret.name)}
                            className="rounded-md px-2 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-container-high"
                            aria-label={`Replace value of ${secret.name}`}
                          >
                            Replace
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(secret.name)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${secret.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
