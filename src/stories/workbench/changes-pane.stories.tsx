import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { ChangesPane, type ChangedFile, type ChangesPaneProps } from "../../workbench"

// Two edits far enough apart to land in separate hunks: the signature and
// option block at the top, and the backoff arithmetic near the bottom.
const RETRY_BASELINE = `import { sleep } from "./sleep"

/**
 * Retry an async operation a fixed number of times with a linear backoff.
 */
export async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      log("retry", i)
      await sleep(100 * i)
    }
  }
  throw lastErr
}

function log(scope: string, attempt: number) {
  if (process.env.DEBUG_RETRY) {
    console.debug(\`[\${scope}] attempt \${attempt}\`)
  }
}

export function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const code = (err as { code?: string }).code
  return code === "ECONNRESET" || code === "ETIMEDOUT"
}

export const DEFAULT_ATTEMPTS = 3
export const DEFAULT_DELAY_MS = 100
`

const RETRY_CURRENT = `import { sleep } from "./sleep"
import { backoff } from "./backoff"

export interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  signal?: AbortSignal
}

/**
 * Retry an async operation with exponential backoff, full jitter, and
 * cooperative cancellation via an AbortSignal.
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = DEFAULT_ATTEMPTS, baseDelayMs = DEFAULT_DELAY_MS, maxDelayMs = 5_000, signal } = options
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) throw signal.reason
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      log("retry", i)
      await sleep(backoff(i, baseDelayMs, maxDelayMs))
    }
  }
  throw lastErr
}

function log(scope: string, attempt: number) {
  if (process.env.DEBUG_RETRY) {
    console.debug(\`[\${scope}] attempt \${attempt}\`)
  }
}

export function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const code = (err as { code?: string }).code
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EAI_AGAIN"
}

export const DEFAULT_ATTEMPTS = 5
export const DEFAULT_DELAY_MS = 100
`

const BACKOFF_CURRENT = `/**
 * Exponential backoff with full jitter, capped at \`maxDelayMs\`.
 */
export function backoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const ceiling = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
  return Math.random() * ceiling
}
`

const POLL_BASELINE = `import { sleep } from "../lib/sleep"

export async function poll<T>(fn: () => Promise<T | null>, intervalMs = 500, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await fn()
    if (value != null) return value
    await sleep(intervalMs)
  }
  throw new Error("poll: timed out")
}
`

const FILES: ChangedFile[] = [
  { path: "src/lib/retry.ts", status: "modified", additions: 16, deletions: 5, baseline: RETRY_BASELINE, current: RETRY_CURRENT },
  { path: "src/lib/backoff.ts", status: "added", additions: 7, deletions: 0, current: BACKOFF_CURRENT },
  { path: "src/lib/sleep.ts", status: "modified", additions: 2, deletions: 2 },
  { path: "src/legacy/poll.ts", status: "deleted", additions: 0, deletions: 11, baseline: POLL_BASELINE },
  { path: "README.md", status: "modified", additions: 6, deletions: 1 },
]

const MANY_FILES: ChangedFile[] = [
  ...FILES,
  { path: "src/client/api.ts", status: "modified", additions: 3, deletions: 1 },
  { path: "src/client/session.ts", status: "modified", additions: 18, deletions: 4 },
  { path: "src/client/index.ts", status: "modified", additions: 1, deletions: 0 },
  { path: "src/lib/retry.test.ts", status: "added", additions: 64, deletions: 0 },
  { path: "src/lib/backoff.test.ts", status: "added", additions: 31, deletions: 0 },
  { path: "docs/retry.md", status: "untracked", additions: 40, deletions: 0 },
  { path: "package.json", status: "modified", additions: 1, deletions: 1 },
  { path: "pnpm-lock.yaml", status: "modified", additions: 12, deletions: 12 },
  { path: "src/legacy/index.ts", status: "deleted", additions: 0, deletions: 2 },
]

const meta: Meta<typeof ChangesPane> = {
  title: "Workbench/ChangesPane",
  component: ChangesPane,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    branch: "feat/retry-backoff",
    ahead: 2,
    behind: 0,
    files: FILES,
    selectedPath: "src/lib/retry.ts",
    onSelectFile: () => {},
    onRefresh: () => {},
    onCommit: async () => {},
    onPush: async () => {},
    onOpenFile: () => {},
  },
  decorators: [
    (Story) => (
      <div data-sandbox-ui="true" className="h-[720px] w-[440px] border-r border-[var(--md3-outline-variant)] bg-surface-container-low">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ChangesPane>

export const Default: Story = {
  name: "Default",
}

/**
 * Selection, lazy content resolution, and the commit / push round trip, the
 * way a host wires them: `onSelectFile` sets the selection, contents arrive a
 * beat later, a commit folds the files into `ahead`, a push clears it.
 */
function InteractiveChangesPane(args: ChangesPaneProps) {
  const [files, setFiles] = React.useState<ChangedFile[]>(() => args.files.map((f) => ({ ...f, baseline: undefined, current: undefined })))
  const [selectedPath, setSelectedPath] = React.useState<string | undefined>(undefined)
  const [ahead, setAhead] = React.useState(args.ahead ?? 0)
  const [busy, setBusy] = React.useState<"commit" | "push" | null>(null)

  const select = React.useCallback(
    (path: string) => {
      setSelectedPath(path)
      const source = args.files.find((f) => f.path === path)
      if (!source) return
      setTimeout(() => {
        setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, baseline: source.baseline, current: source.current } : f)))
      }, 600)
    },
    [args.files],
  )

  const commit = React.useCallback(async (message: string) => {
    setBusy("commit")
    await new Promise((r) => setTimeout(r, 900))
    setBusy(null)
    if (/fail/i.test(message)) throw new Error("pre-commit hook failed: lint reported 2 errors")
    setFiles([])
    setSelectedPath(undefined)
    setAhead((n) => n + 1)
  }, [])

  const push = React.useCallback(async () => {
    setBusy("push")
    await new Promise((r) => setTimeout(r, 900))
    setBusy(null)
    setAhead(0)
  }, [])

  return (
    <ChangesPane
      {...args}
      files={files}
      selectedPath={selectedPath}
      onSelectFile={select}
      ahead={ahead}
      busy={busy}
      onCommit={commit}
      onPush={push}
    />
  )
}

export const Interactive: Story = {
  name: "Interactive (select, commit, push)",
  render: (args) => <InteractiveChangesPane {...args} />,
}

export const ManyFiles: Story = {
  name: "Many files (list scrolls, diff stays)",
  args: {
    files: MANY_FILES,
    ahead: 0,
  },
}

export const ResolvingContents: Story = {
  name: "Resolving contents",
  args: {
    selectedPath: "src/lib/sleep.ts",
  },
}

export const CommitFailed: Story = {
  name: "Commit rejected",
  args: {
    onCommit: async () => {
      await new Promise((r) => setTimeout(r, 400))
      throw new Error("pre-commit hook failed: lint reported 2 errors")
    },
  },
}

export const Committing: Story = {
  name: "Commit in flight",
  args: {
    busy: "commit",
  },
}

export const Loading: Story = {
  args: {
    branch: null,
    ahead: 0,
    files: [],
    selectedPath: undefined,
    loading: true,
  },
}

export const Empty: Story = {
  name: "Clean tree",
  args: {
    files: [],
    ahead: 0,
    selectedPath: undefined,
  },
}

export const NoCommitsYet: Story = {
  name: "No commits yet",
  args: {
    branch: null,
    ahead: 0,
    files: FILES.filter((f) => f.status !== "deleted").map((f) => ({ ...f, status: "untracked" as const, deletions: 0 })),
    selectedPath: undefined,
  },
}

export const Failed: Story = {
  name: "Status failed",
  args: {
    files: [],
    ahead: 0,
    selectedPath: undefined,
    error: "git status: fatal: not a git repository (or any of the parent directories): .git",
  },
}
