import type { CSSProperties } from "react"
import type { RichFileTreeGitEntry, RichFileTreeGitStatus } from "../files"
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

/**
 * One entry of the sandbox's git working tree, as the Changes pane lists it.
 * `additions` / `deletions` are the numstat counts the sidecar's
 * `GET /git/diff` reports per file.
 *
 * `baseline` / `current` are the file contents the diff is drawn from and are
 * absent until the consumer resolves them for the selected file. Which of the
 * two counts as "resolved" follows the status: an added or untracked file has
 * no baseline and diffs against the empty string once `current` is present; a
 * deleted file has no working copy and diffs against the empty string once
 * `baseline` is present; every other status waits for both.
 */
export interface ChangedFile {
  path: string
  status: RichFileTreeGitStatus
  additions: number
  deletions: number
  /** Present once the consumer has resolved contents for the selected file. */
  baseline?: string
  current?: string
}

export interface ChangesPaneProps {
  /** Current branch; `null` when the tree has no commits yet or is not a repository. */
  branch: string | null
  ahead?: number
  behind?: number
  files: ChangedFile[]
  selectedPath?: string
  onSelectFile?: (path: string) => void
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  /** Stage everything and commit. Resolve on success; reject with an Error the pane shows inline. */
  onCommit?: (message: string) => Promise<void>
  onPush?: () => Promise<void>
  /** Which action is in flight; the pane disables the other and shows a spinner on this one. */
  busy?: "commit" | "push" | null
  /** Open the file as a workbench artifact (the product wires this to its artifact opener). */
  onOpenFile?: (path: string) => void
  className?: string
}
