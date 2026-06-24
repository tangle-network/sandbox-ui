"use client"

import * as React from "react"
import { Code2, GitCompare, Globe, Network, SquareTerminal } from "lucide-react"
import { cn } from "../lib/utils"
import { PortsList } from "../dashboard"
import { TerminalView } from "../terminal"
import { PillTabs, type PillTabItem } from "./pill-tabs"
import { PanelHeader } from "./panel-header"
import { CodeView } from "./code-view"
import { DiffView } from "./diff-view"
import { PreviewView } from "./preview-view"
import { buildUnifiedPatch, computeDiffStats } from "./diff-utils"
import type { ArtifactView, SandboxArtifactPaneProps } from "./types"

const VIEW_ORDER: ArtifactView[] = ["code", "diff", "preview", "ports", "terminal"]

const VIEW_META: Record<ArtifactView, { label: string; icon: React.ReactNode }> = {
  code: { label: "Code", icon: <Code2 className="h-3.5 w-3.5" /> },
  diff: { label: "Diff", icon: <GitCompare className="h-3.5 w-3.5" /> },
  preview: { label: "Preview", icon: <Globe className="h-3.5 w-3.5" /> },
  ports: { label: "Ports", icon: <Network className="h-3.5 w-3.5" /> },
  terminal: { label: "Terminal", icon: <SquareTerminal className="h-3.5 w-3.5" /> },
}

const noop = () => {}

/**
 * Blueprint-grade artifact workbench. Composes the sandbox-ui substrate
 * (`RichFileTree`, `PortsList`, `TerminalView`, `@pierre/diffs`) behind a
 * single pill-tab view switcher: Code · Diff · Preview · Ports · Terminal.
 * Tabs appear only when their data is present (Diff requires a differing
 * baseline; Preview a url; Ports a port list; Terminal a live binding), so the
 * chrome never shows a dead surface.
 */
export function SandboxArtifactPane({
  artifact,
  paths,
  gitStatus,
  showTree,
  ports,
  previewUrl,
  terminal,
  activeView,
  defaultView,
  onViewChange,
  onFileSelect,
  onExposePort,
  onRemovePort,
  className,
  style,
}: SandboxArtifactPaneProps) {
  const hasDiff = artifact.baselineContent != null && artifact.baselineContent !== artifact.content
  const hasPreview = previewUrl != null && previewUrl !== ""
  const hasPorts = ports != null
  const hasTerminal = terminal != null

  const available = React.useMemo<ArtifactView[]>(() => {
    return VIEW_ORDER.filter((v) => {
      if (v === "diff") return hasDiff
      if (v === "preview") return hasPreview
      if (v === "ports") return hasPorts
      if (v === "terminal") return hasTerminal
      return true // code always available
    })
  }, [hasDiff, hasPreview, hasPorts, hasTerminal])

  const [internalView, setInternalView] = React.useState<ArtifactView>(
    () => (defaultView && (defaultView !== "diff" || hasDiff) ? defaultView : "code"),
  )

  const controlled = activeView != null
  const requestedView = controlled ? activeView : internalView
  // Never render a tab whose data has gone away (e.g. baseline cleared).
  const view = available.includes(requestedView) ? requestedView : available[0]

  const selectView = React.useCallback(
    (next: ArtifactView) => {
      if (!controlled) setInternalView(next)
      onViewChange?.(next)
    },
    [controlled, onViewChange],
  )

  const tabs = React.useMemo<PillTabItem<ArtifactView>[]>(
    () => available.map((v) => ({ value: v, label: VIEW_META[v].label, icon: VIEW_META[v].icon })),
    [available],
  )

  const activeGitStatus = React.useMemo(
    () => gitStatus?.find((e) => e.path === artifact.path)?.status,
    [gitStatus, artifact.path],
  )

  const stats = React.useMemo(
    () => (hasDiff ? computeDiffStats(artifact.baselineContent ?? "", artifact.content) : undefined),
    [hasDiff, artifact.baselineContent, artifact.content],
  )

  // Copy yields the patch on the Diff surface, the file contents elsewhere.
  const copyText = React.useMemo(() => {
    if (view === "diff" && hasDiff) {
      return buildUnifiedPatch(artifact.filename, artifact.baselineContent ?? "", artifact.content)
    }
    if (view === "code" || view === "diff") return artifact.content
    return undefined
  }, [view, hasDiff, artifact.filename, artifact.baselineContent, artifact.content])

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--md3-outline-variant)] bg-surface-container shadow-[var(--shadow-card)]",
        className,
      )}
      style={style}
    >
      <PanelHeader
        filename={artifact.filename}
        gitStatus={activeGitStatus}
        stats={view === "diff" ? stats : undefined}
        copyText={copyText}
      />

      <div className="flex items-center border-b border-[var(--md3-outline-variant)] bg-surface-container-lowest px-3 py-1.5">
        <PillTabs items={tabs} value={view} onChange={selectView} aria-label="Artifact view" />
      </div>

      <div className="min-h-0 flex-1">
        {view === "code" && (
          <CodeView
            path={artifact.path}
            filename={artifact.filename}
            content={artifact.content}
            language={artifact.language}
            paths={paths}
            gitStatus={gitStatus}
            showTree={showTree}
            onFileSelect={onFileSelect}
          />
        )}

        {view === "diff" && hasDiff && (
          <DiffView
            filename={artifact.filename}
            baseline={artifact.baselineContent ?? ""}
            current={artifact.content}
          />
        )}

        {view === "preview" && hasPreview && <PreviewView url={previewUrl} />}

        {view === "ports" && hasPorts && (
          <div className="h-full overflow-auto bg-surface-container p-4">
            <PortsList
              ports={ports}
              onExposePort={onExposePort ?? noop}
              onRemovePort={onRemovePort}
            />
          </div>
        )}

        {view === "terminal" && hasTerminal && (
          <div className="h-full bg-surface-container-lowest">
            <TerminalView
              apiUrl={terminal.apiUrl}
              token={terminal.token}
              connectionId={terminal.connectionId}
              title={terminal.title}
              subtitle={terminal.subtitle}
            />
          </div>
        )}
      </div>
    </div>
  )
}
