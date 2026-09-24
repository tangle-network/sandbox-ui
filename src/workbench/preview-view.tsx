"use client"

import * as React from "react"
import { Button } from "@tangle-network/ui/primitives"
import { focusField } from "@tangle-network/ui/utils"
import { ExternalLink, RotateCw } from "lucide-react"
import { cn } from "../lib/utils"
import { previewAccessLabel, previewReadinessLabel, safePreviewUrl, type PreviewAccess, type PreviewReadiness } from "./preview-policy"

export interface PreviewViewProps {
  /** A product-authorized preview URL. Relative navigation stays on its origin. */
  url: string
  allowedOrigins?: readonly string[]
  /** Supply only metadata obtained from the enforcing service, never a UI guess. */
  access?: PreviewAccess
  readiness?: PreviewReadiness
  onCheckReadiness?: () => void
  onNavigate?: (url: string) => void
  className?: string
}

export function PreviewView({ url, allowedOrigins, access, readiness, onCheckReadiness, onNavigate, className }: PreviewViewProps) {
  const initial = React.useMemo(() => {
    try { return { url: safePreviewUrl(url), error: null } }
    catch (failure) { return { url: null, error: failure instanceof Error ? failure.message : "Preview URL is invalid." } }
  }, [url])
  const [address, setAddress] = React.useState(url)
  const [location, setLocation] = React.useState({ source: url, active: initial.url })
  const [iframeKey, setIframeKey] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [slow, setSlow] = React.useState(false)
  const [addressError, setAddressError] = React.useState<string | null>(null)
  const errorId = React.useId()
  const stateId = React.useId()
  const activeUrl = location.source === url ? location.active : initial.url

  React.useEffect(() => {
    setAddress(url)
    setLocation({ source: url, active: initial.url })
    setIframeKey((key) => key + 1)
    setLoading(true); setSlow(false); setAddressError(null)
  }, [url, initial.url])
  React.useEffect(() => {
    if (!loading || !activeUrl) return
    const timer = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(timer)
  }, [iframeKey, loading, activeUrl])

  const reload = () => {
    setIframeKey((key) => key + 1)
    setLoading(true); setSlow(false)
  }
  const navigate = () => {
    try {
      if (!initial.url) throw new Error(initial.error ?? "Preview URL is invalid.")
      const origins = [new URL(initial.url).origin, ...(allowedOrigins ?? [])]
      const next = safePreviewUrl(address, activeUrl ?? initial.url, origins)
      setAddress(next); setLocation({ source: url, active: next }); setAddressError(null)
      reload(); onNavigate?.(next)
    } catch (failure) {
      setAddressError(failure instanceof Error ? failure.message : "Preview address is invalid.")
    }
  }
  const error = initial.error ?? addressError
  // Metadata for the initial address cannot make a newly entered address ready.
  const currentReadiness = activeUrl === initial.url ? readiness : undefined
  const currentAccess = activeUrl === initial.url ? access : undefined
  const sameApplicationOrigin = activeUrl && typeof window !== "undefined" && new URL(activeUrl).origin === window.location.origin

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col bg-surface-container", className)}>
      <form aria-label="Preview navigation" onSubmit={(event) => { event.preventDefault(); navigate() }}
        className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-container-low px-2 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={reload} disabled={!activeUrl} aria-label="Reload preview">
          <RotateCw aria-hidden="true" className="size-4" />
        </Button>
        <input value={address} onChange={(event) => { setAddress(event.target.value); setAddressError(null) }}
          aria-label="Preview address" aria-invalid={!!error} aria-describedby={error ? errorId : stateId}
          spellCheck={false} autoComplete="off"
          className={`h-9 min-w-0 flex-1 rounded-md border bg-surface-container px-2.5 font-mono text-sm text-foreground ${focusField}`} />
        <Button type="submit" variant="outline" size="sm" disabled={!initial.url}>Go</Button>
        {activeUrl && <Button asChild type="button" variant="ghost" size="sm">
          <a href={activeUrl} target="_blank" rel="noopener noreferrer" aria-label="Open preview in new tab">
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </Button>}
      </form>
      {error && <p id={errorId} role="alert" className="px-3 py-2 text-sm text-destructive">{error}</p>}
      <div id={stateId} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{previewAccessLabel(currentAccess)}</span>
        <span role="status">{previewReadinessLabel(currentReadiness)}</span>
        {currentReadiness && "checkedAt" in currentReadiness && <time dateTime={currentReadiness.checkedAt}>Checked {currentReadiness.checkedAt}</time>}
        {currentAccess && "expiresAt" in currentAccess && currentAccess.expiresAt && <time dateTime={currentAccess.expiresAt}>Expires {currentAccess.expiresAt}</time>}
        {onCheckReadiness && <Button type="button" variant="outline" size="sm" onClick={onCheckReadiness}
          disabled={currentReadiness?.state === "checking"}>Check application</Button>}
      </div>
      <div className="relative min-h-0 min-w-0 flex-1 bg-surface-container-lowest">
        {activeUrl && <iframe key={`${activeUrl}:${iframeKey}`} src={activeUrl} title="Sandbox preview"
          className="h-full w-full border-0 bg-white" referrerPolicy="no-referrer"
          sandbox={sameApplicationOrigin ? "allow-scripts allow-forms" : "allow-scripts allow-same-origin allow-forms"}
          onLoad={() => { setLoading(false); setSlow(false) }}
          onError={() => { setLoading(false); setAddressError("The preview frame could not be loaded. Check the application or open the URL separately.") }} />}
        {loading && activeUrl && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-container-lowest">
          <p className="px-4 text-center text-sm text-muted-foreground">
            {slow ? "The preview frame is still loading. This does not establish whether the application is ready." : "Loading preview frame…"}
          </p>
        </div>}
      </div>
    </div>
  )
}
