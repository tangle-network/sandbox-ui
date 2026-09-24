"use client"

import * as React from "react"
import { ExternalLink, RotateCw } from "lucide-react"
import { cn } from "../lib/utils"
import { focusField } from "@tangle-network/ui/utils"

export interface PreviewViewProps {
  /** Origin to load in the preview iframe. */
  url: string
  className?: string
}

/**
 * Live preview: a slim address bar (reload + open-in-new-tab) over a sandboxed
 * iframe. The iframe is force-remounted by bumping `iframeKey` on reload — the
 * same remount trick blueprint-agent's `Preview` uses. The readiness probe is
 * intentionally a stub here: the iframe shows optimistically and a loading
 * veil clears when the frame fires `load`. A slow load stays visible as a
 * warning, since a timer cannot prove the preview became ready.
 */
export function PreviewView({ url, className }: PreviewViewProps) {
  const [address, setAddress] = React.useState(url)
  const [activeUrl, setActiveUrl] = React.useState(url)
  const [iframeKey, setIframeKey] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [slow, setSlow] = React.useState(false)
  const [addressError, setAddressError] = React.useState<string | null>(null)
  const errorId = React.useId()

  React.useEffect(() => {
    setAddress(url)
    setActiveUrl(url)
    setIframeKey((k) => k + 1)
    setLoading(true)
    setSlow(false)
    setAddressError(null)
  }, [url])

  React.useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [iframeKey, loading])

  const reload = React.useCallback(() => {
    setIframeKey((k) => k + 1)
    setLoading(true)
    setSlow(false)
  }, [])

  const navigate = React.useCallback(() => {
    let nextUrl: URL
    try {
      nextUrl = new URL(address, activeUrl)
    } catch {
      setAddressError("Enter a valid preview URL.")
      return
    }
    if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
      setAddressError("Use an HTTP or HTTPS preview URL.")
      return
    }
    setAddressError(null)
    setActiveUrl(nextUrl.toString())
    setIframeKey((k) => k + 1)
    setLoading(true)
    setSlow(false)
  }, [activeUrl, address])

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-surface-container", className)}>
      <div className="flex items-center gap-2 border-b border-[var(--md3-outline-variant)] bg-surface-container-low px-2 py-1.5">
        <button
          type="button"
          onClick={reload}
          aria-label="Reload preview"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <input
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            setAddressError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate()
          }}
          aria-label="Preview address"
          aria-invalid={addressError != null}
          aria-describedby={addressError ? errorId : undefined}
          spellCheck={false}
          className={`h-7 flex-1 rounded-md border bg-surface-container px-2.5 font-mono text-xs text-foreground ${focusField}`}
        />
        <a
          href={activeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open preview in new tab"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {addressError && <p id={errorId} role="alert" className="px-3 py-1 text-xs text-destructive">{addressError}</p>}
      <div className="relative min-h-0 flex-1 bg-surface-container-lowest">
        <iframe
          key={iframeKey}
          src={activeUrl}
          title="Sandbox preview"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => {
            setLoading(false)
            setSlow(false)
          }}
        />
        {loading && (
          <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-container-lowest">
            <p className="px-4 text-center text-xs text-muted-foreground">
              {slow ? "Preview is still loading. Check the address or open it in a new tab." : `Loading ${activeUrl}…`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
