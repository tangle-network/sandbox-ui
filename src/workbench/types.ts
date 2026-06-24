import type { CSSProperties } from "react"
import type { RichFileTreeGitEntry } from "../files"
import type { ExposedPort } from "../dashboard"

/** Which surface the artifact pane is currently showing. */
export type ArtifactView = "code" | "diff" | "preview" | "ports" | "terminal"

/**
 * A single artifact rendered by the pane. `content` is the working copy;
 * when `baselineContent` differs from it, the Diff view becomes available
 * and renders a word-level unified diff of baseline → content.
 */
export interface SandboxArtifact {
  id: string
  /** Canonical path inside the sandbox, e.g. `src/lib/retry.ts`. */
  path: string
  /** Display name for the active file (usually the last path segment). */
  filename: string
  /** Working-copy contents of the file. */
  content: string
  /** Prior contents the working copy is diffed against. */
  baselineContent?: string
  /** Explicit syntax language id (overrides extension inference). */
  language?: string
  mimeType?: string
}

/**
 * Live PTY terminal binding. Maps straight onto `TerminalView` — both
 * `apiUrl` and `token` are required to open a session against the sidecar.
 */
export interface SandboxArtifactTerminal {
  apiUrl: string
  token: string
  /** Stable id so the same PTY is restored across remounts. */
  connectionId?: string
  title?: string
  subtitle?: string
}

export interface SandboxArtifactPaneProps {
  /** The active artifact shown in the Code / Diff surfaces. */
  artifact: SandboxArtifact
  /**
   * Flat list of canonical paths for the file-tree rail in the Code view.
   * Defaults to `[artifact.path]` when omitted (single-file tree).
   */
  paths?: ReadonlyArray<string>
  /** Per-path git-status decorations for the file tree. */
  gitStatus?: ReadonlyArray<RichFileTreeGitEntry>
  /** Show the Code view's file-tree rail. Off for single-file embeds where the host owns navigation/tabs. */
  showTree?: boolean
  /** Exposed ports; presence enables the Ports tab. */
  ports?: ExposedPort[]
  /** Live preview origin; presence enables the Preview tab. */
  previewUrl?: string
  /** Live terminal binding; presence enables the Terminal tab. */
  terminal?: SandboxArtifactTerminal
  /** Controlled active view. Pair with `onViewChange`. */
  activeView?: ArtifactView
  /** Initial view when uncontrolled. Defaults to the first available view. */
  defaultView?: ArtifactView
  onViewChange?: (view: ArtifactView) => void
  /** Fired when a different file is chosen in the tree (host swaps artifact). */
  onFileSelect?: (path: string) => void
  /** Forwarded to the Ports view. */
  onExposePort?: (port: number) => void
  onRemovePort?: (port: number) => void
  className?: string
  style?: CSSProperties
}
