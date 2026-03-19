![Tangle Network Banner](https://raw.githubusercontent.com/tangle-network/tangle/refs/heads/main/assets/Tangle%20%20Banner.png)

<p align="center">
  <a href="https://www.npmjs.com/package/@tangle-network/sandbox-ui"><img src="https://img.shields.io/npm/v/@tangle-network/sandbox-ui?color=8E59FF&label=npm" alt="npm" /></a>
  <a href="https://github.com/tangle-network/sandbox-ui/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@tangle-network/sandbox-ui?color=6888F9" alt="license" /></a>
  <a href="https://github.com/tangle-network/sandbox-ui"><img src="https://img.shields.io/github/stars/tangle-network/sandbox-ui?style=flat&color=8E59FF" alt="stars" /></a>
</p>

# @tangle-network/sandbox-ui

React component library for [Tangle Sandbox](https://sandbox.tangle.tools) — a shadcn-style primitive layer plus higher-order sandbox surfaces for agent chat, files, runtime state, artifacts, and dashboard views.

## Install

```bash
npm install @tangle-network/sandbox-ui
```

**Peer dependencies:** `react` and `react-dom` (18 or 19). Optional peers for specific subpaths — see [package.json](./package.json).

## Usage

```tsx
import {
  SandboxWorkbench,
  type FileNode,
  type SessionMessage,
  type SessionPart,
} from "@tangle-network/sandbox-ui";
```

Import styles in your app root:

```tsx
import "@tangle-network/sandbox-ui/styles";
```

Compose sandbox applications around `SandboxWorkbench` when you want the library’s default operating model:

```tsx
const root: FileNode = {
  name: "agent",
  path: "/home/agent",
  type: "directory",
  children: [],
};

const messages: SessionMessage[] = [];
const partMap: Record<string, SessionPart[]> = {};

<SandboxWorkbench
  title="Tax filing workspace"
  directory={{
    root,
    visibility: {
      hiddenPathPrefixes: ["/home/agent/tax_toolkit"],
    },
  }}
  session={{
    messages,
    partMap,
    isStreaming: false,
    presentation: "timeline",
    onSend: console.log,
  }}
  runtime={{
    title: "Runtime",
  }}
/>;
```

`FileTreeVisibilityOptions` is a UI-layer policy only. Sensitive paths still need to be hidden and denied by the app/backend layer.

## Theming And Retheming

There is a built-in Tangle default theme, but consumers can restyle the library in three layers:

1. Pick a built-in surface theme
2. Override semantic tokens
3. Wrap higher-level components when you want a different product composition

### 1. Pick a Built-in Theme

`WorkspaceLayout` and `SandboxWorkbench` support:

- `theme="operator"`
- `theme="builder"`
- `theme="consumer"`

They also support `density="comfortable"` and `density="compact"`.

```tsx
<SandboxWorkbench
  layout={{
    theme: "consumer",
    density: "comfortable",
  }}
  session={{ ... }}
/>
```

If you are not using `SandboxWorkbench`, you can set the same attributes yourself:

```tsx
<div data-sandbox-ui data-sandbox-theme="consumer" data-density="compact">
  <YourSandboxApp />
</div>
```

### 2. Override Semantic Tokens

The shared visual contract lives in [src/styles/tokens.css](./src/styles/tokens.css). The important tokens are:

- surfaces: `--bg-root`, `--bg-card`, `--bg-elevated`, `--bg-section`, `--bg-input`
- text: `--text-primary`, `--text-secondary`, `--text-muted`
- brand: `--brand-cool`, `--brand-glow`, `--brand-purple`
- borders: `--border-subtle`, `--border-default`, `--border-accent`
- radii/shadows: `--radius-*`, `--shadow-card`, `--shadow-dropdown`

App-level overrides can be scoped to a wrapper:

```css
.tax-theme {
  --brand-cool: hsl(187 75% 54%);
  --brand-glow: hsl(164 74% 56%);
  --bg-root: hsl(222 18% 9%);
  --bg-card: hsl(223 20% 12%);
  --border-accent: hsl(187 75% 48% / 0.35);
  --font-sans: "Satoshi", ui-sans-serif, system-ui, sans-serif;
}
```

```tsx
<div className="tax-theme">
  <SandboxWorkbench ... />
</div>
```

### 3. Know When To Wrap Instead Of Override

Token overrides are the right tool when you want:

- a different brand color system
- different typography
- tighter or roomier density
- a more consumer-facing or operator-facing tone

Wrap or compose on lower-level exports when you want:

- a different page shell
- different header chrome
- a different artifact tab model
- app-specific empty states and actions

For that, compose directly from:

- `/workspace`
- `/chat`
- `/run`
- `/files`

### Current Reality

Retheming is absolutely supported, but the documentation was thinner than it should be. The token layer is strong; the higher-level surfaces are themeable, but more opinionated. For a radically different product look, prefer keeping the token contract and wrapping the higher-level workbench/chat surfaces rather than fighting every internal class.

## Subpath Exports

| Subpath | Description |
|---------|-------------|
| `/primitives` | Button, Card, Dialog, Badge, Input, Select, Table, Tabs, Toast, etc. |
| `/chat` | ChatContainer, ChatInput, ChatMessage, AgentTimeline, ThinkingIndicator |
| `/run` | ToolCallFeed, RunGroup, InlineToolItem, ExpandedToolDetail |
| `/workspace` | SandboxWorkbench, WorkspaceLayout, DirectoryPane, RuntimePane, StatusBar |
| `/openui` | OpenUIArtifactRenderer and schema types for structured artifact rendering |
| `/files` | FileTree, FilePreview, FileTabs, FileArtifactPane |
| `/dashboard` | DashboardLayout, BillingDashboard, UsageChart, ProfileSelector |
| `/editor` | TipTap collaborative editor (requires optional peers) |
| `/terminal` | xterm.js terminal view (requires optional peers) |
| `/markdown` | Markdown renderer with GFM, code blocks, copy button |
| `/auth` | AuthHeader, GitHubLoginButton, UserMenu |
| `/pages` | Pre-built billing, pricing, profiles pages |
| `/hooks` | useSSEStream, useAuth, usePtySession, useRunGroups, etc. |
| `/stores` | Session and chat nanostores |
| `/types` | TypeScript types for messages, parts, runs, sessions |
| `/utils` | cn, formatDuration, timeAgo, tool display helpers |
| `/styles` | Compiled CSS bundle |

## Stack

- [Radix UI](https://www.radix-ui.com/) primitives
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Lucide](https://lucide.dev/) icons
- [CVA](https://cva.style/) for variant management
- Shared semantic tokens for `operator`, `builder`, and `consumer` sandbox themes
- ESM-only, tree-shakeable, fully typed

## License

Apache-2.0
