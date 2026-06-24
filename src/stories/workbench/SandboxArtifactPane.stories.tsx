import type { Meta, StoryObj } from "@storybook/react"
import { SandboxArtifactPane } from "../../workbench"

const BASELINE = `import { sleep } from "./sleep"

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
      await sleep(100 * i)
    }
  }
  throw lastErr
}
`

const CURRENT = `import { sleep } from "./sleep"

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
  const { attempts = 5, baseDelayMs = 100, maxDelayMs = 5_000, signal } = options
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) throw signal.reason
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const backoff = Math.min(baseDelayMs * 2 ** i, maxDelayMs)
      const jitter = Math.random() * backoff
      await sleep(backoff + jitter)
    }
  }
  throw lastErr
}
`

const PATHS = [
  "src/lib/retry.ts",
  "src/lib/sleep.ts",
  "src/lib/index.ts",
  "src/client/api.ts",
  "src/client/session.ts",
  "package.json",
  "README.md",
] as const

const meta: Meta<typeof SandboxArtifactPane> = {
  title: "Workbench/SandboxArtifactPane",
  component: SandboxArtifactPane,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
  args: {
    artifact: {
      id: "retry-ts",
      path: "src/lib/retry.ts",
      filename: "retry.ts",
      content: CURRENT,
      baselineContent: BASELINE,
      language: "typescript",
    },
    paths: PATHS,
    gitStatus: [
      { path: "src/lib/retry.ts", status: "modified" },
      { path: "src/client/session.ts", status: "added" },
      { path: "src/lib/sleep.ts", status: "untracked" },
    ],
    ports: [
      { port: 3000, url: "https://3000-sandbox.tngl.dev", status: "active" },
      { port: 5173, url: "https://5173-sandbox.tngl.dev", status: "pending" },
    ],
    previewUrl: "https://3000-sandbox.tngl.dev",
    terminal: {
      apiUrl: "https://sandbox.example.com",
      token: "demo-token",
      connectionId: "story-retry-ts",
      subtitle: "node 20 · /workspace",
    },
  },
  decorators: [
    (Story) => (
      <div data-sandbox-ui="true" className="dark h-[640px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SandboxArtifactPane>

export const Default: Story = {
  name: "Default",
}

export const DiffActive: Story = {
  name: "Diff active",
  args: {
    defaultView: "diff",
  },
}

export const CodeOnly: Story = {
  name: "Code only (no baseline / ports / preview)",
  args: {
    artifact: {
      id: "sleep-ts",
      path: "src/lib/sleep.ts",
      filename: "sleep.ts",
      content: `export function sleep(ms: number): Promise<void> {\n  return new Promise((resolve) => setTimeout(resolve, ms))\n}\n`,
      language: "typescript",
    },
    paths: ["src/lib/sleep.ts"],
    gitStatus: [{ path: "src/lib/sleep.ts", status: "untracked" }],
    ports: undefined,
    previewUrl: undefined,
    terminal: undefined,
  },
}
