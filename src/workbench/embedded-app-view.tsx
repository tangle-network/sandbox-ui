"use client"

import * as React from "react"
import { Button } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { previewAccessLabel, previewReadinessLabel, safePreviewUrl, type PreviewAccess, type PreviewReadiness } from "./preview-policy"
import { PreviewView } from "./preview-view"

export interface EmbeddedApp {
  /** Stable app identity. The host uses it to preserve selection across updates. */
  id: string
  name: string
  /** Resolved, credential-free sandbox preview URL. */
  previewUrl?: string
  /** The host supplies this state from its application or preview service. */
  status: "starting" | "ready" | "unavailable"
  statusMessage?: string
}

export interface EmbeddedAppViewProps {
  app: EmbeddedApp
  /** Product-approved origins, obtained independently of the app URL. */
  allowedOrigins?: readonly string[]
  /** Service-observed HTTP result. Never derive it from iframe load. */
  readiness?: PreviewReadiness
  /** Enforced access policy, supplied by the host service. */
  access?: PreviewAccess
  /** Product actions beside the app name in the ready preview header. */
  toolbarActions?: React.ReactNode
  /** Recheck or restart the preview through the host's own service. */
  onRetry?: () => void
  className?: string
}

/**
 * An app-sized preview surface for a product workspace.
 * The host owns app discovery, persistence, access policy, and readiness checks.
 */
export function EmbeddedAppView({ app, allowedOrigins, readiness, access, toolbarActions, onRetry, className }: EmbeddedAppViewProps) {
  let previewUrl: string | null = null
  let urlError: string | null = null
  if (app.status === "ready") {
    try {
      previewUrl = safePreviewUrl(app.previewUrl ?? "", undefined, allowedOrigins)
    } catch (failure) {
      urlError = failure instanceof Error ? failure.message : "Preview URL is invalid."
    }
  }

  if (previewUrl) {
    return (
      <section aria-label={`${app.name} app`} className={cn("h-full w-full min-h-0 min-w-0", className)}>
        <PreviewView key={app.id} url={previewUrl} allowedOrigins={allowedOrigins} readiness={readiness} access={access} title={app.name} toolbarActions={toolbarActions} variant="embedded" />
      </section>
    )
  }

  const starting = app.status === "starting"
  const message = starting
    ? app.statusMessage ?? "The app preview is starting."
    : urlError ?? app.statusMessage ?? "The app preview is unavailable."

  return (
    <section aria-label={`${app.name} app`} className={cn("flex h-full w-full min-h-0 min-w-0 flex-col bg-surface-container", className)}>
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-base font-medium text-foreground">{app.name}</h2>
          <p role={starting ? "status" : "alert"} className="mt-2 text-sm text-muted-foreground">{message}</p>
          {(readiness || access) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {previewReadinessLabel(readiness)} · {previewAccessLabel(access)}
            </p>
          )}
          {!starting && onRetry && (
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>
              Retry preview
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
