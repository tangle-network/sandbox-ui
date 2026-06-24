"use client"

import * as React from "react"
import { ExternalLink, RotateCw } from "lucide-react"
import { cn } from "../lib/utils"

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
 * veil clears on `onLoad` (or a short fallback timer), which is the right
 * behavior for a static origin without a probe service wired in.
 */
export function PreviewView({ url, className }: PreviewViewProps) {
  const [address, setAddress] = React.useState(url)
  const [iframeKey, setIframeKey] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setAddress(url)
    setIframeKey((k) => k + 1)
    setLoading(true)
  }, [url])

  // Optimistic fallback — clear the veil even if `onLoad` never fires
  // (cross-origin frames sometimes suppress it).
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(t)
  }, [iframeKey])

  const reload = React.useCallback(() => {
    setIframeKey((k) => k + 1)
    setLoading(true)
  }, [])

  const navigate = React.useCallback(() => {
    setIframeKey((k) => k + 1)
    setLoading(true)
  }, [])

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
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate()}
          spellCheck={false}
          className="h-7 flex-1 rounded-md border border-[var(--md3-outline-variant)] bg-surface-container px-2.5 font-mono text-xs text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <a
          href={address}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open preview in new tab"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="relative min-h-0 flex-1 bg-surface-container-lowest">
        <iframe
          key={`${iframeKey}-${address}`}
          src={address}
          title="Sandbox preview"
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoading(false)}
        />
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-container-lowest">
            <p className="text-xs text-muted-foreground">Loading {address}…</p>
          </div>
        )}
      </div>
    </div>
  )
}
