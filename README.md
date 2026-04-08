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

If you are building on the sandbox SDK directly, use `useSdkSession` to turn raw SDK/session-gateway events into the `messages + partMap` model that `ChatContainer` and `SandboxWorkbench` expect:

```tsx
import {
  SandboxWorkbench,
} from "@tangle-network/sandbox-ui";
import { useSdkSession } from "@tangle-network/sandbox-ui/sdk-hooks";

function App() {
  const {
    messages,
    partMap,
    isStreaming,
    appendUserMessage,
    beginAssistantMessage,
    applySdkEvent,
    completeAssistantMessage,
    failAssistantMessage,
  } = useSdkSession();

  async function runTurn(text: string) {
    appendUserMessage({ content: text });
    const assistantMessageId = beginAssistantMessage();

    try {
      for await (const event of sdk.streamPrompt(text)) {
        applySdkEvent(event, { messageId: assistantMessageId });
      }
      completeAssistantMessage({ messageId: assistantMessageId });
    } catch (error) {
      failAssistantMessage(
        error instanceof Error ? error.message : "Agent run failed",
        { messageId: assistantMessageId },
      );
    }
  }

  return (
    <SandboxWorkbench
      session={{
        messages,
        partMap,
        isStreaming,
        onSend: runTurn,
      }}
    />
  );
}
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

- `theme="vault"` — light theme with solid surfaces
- `theme="ocean"` — dark blue theme
- `theme="ember"` — warm amber/orange theme
- `theme="forest"` — green-accented dark theme
- `theme="dawn"` — warm light theme

They also support `density="comfortable"` and `density="compact"`.

```tsx
<SandboxWorkbench
  layout={{
    theme: "vault",
    density: "comfortable",
  }}
  session={{ ... }}
/>
```

If you are not using `SandboxWorkbench`, you can set the same attributes yourself:

```tsx
<div data-sandbox-ui data-sandbox-theme="ocean" data-density="compact">
  <YourSandboxApp />
</div>
```

### 2. Override Semantic Tokens

The shared visual contract lives in [src/styles/tokens.css](./src/styles/tokens.css). The important tokens are:

- surfaces: `--bg-root`, `--bg-card`, `--bg-elevated`, `--bg-section`, `--bg-input`
- text: `--text-primary`, `--text-secondary`, `--text-muted`
- brand: `--brand-cool`, `--brand-glow`, `--brand-purple`
- accent surfaces: `--accent-gradient-strong`, `--accent-surface-soft`, `--accent-surface-strong`, `--accent-text`
- borders: `--border-subtle`, `--border-default`, `--border-accent`
- radii/shadows: `--radius-*`, `--shadow-card`, `--shadow-dropdown`, `--shadow-accent`

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

The higher-order dashboard/billing surfaces are now accent-token driven rather than hardcoded to the default Tangle look. The main seams are:

- `DashboardLayout.className`, `sidebarClassName`, `contentClassName`
- `BillingDashboard.className`, `cardClassName`
- `PricingCards.className`, `cardClassName`
- `UsageChart.className`
- `StandalonePricingPage.className`

For that, compose directly from:

- `/workspace`
- `/chat`
- `/run`
- `/files`

### Current Reality

Retheming is absolutely supported, but the documentation was thinner than it should be. The token layer is strong; the higher-level surfaces are themeable, but more opinionated. For a radically different product look, prefer keeping the token contract and wrapping the higher-level workbench/chat surfaces rather than fighting every internal class.

## Docs

| Guide | Description |
|-------|-------------|
| [Sidebar](./docs/sidebar.md) | Composable Rail + Panel sidebar system (architecture, components, full API) |

## Subpath Exports

| Subpath | Description |
|---------|-------------|
| `/primitives` | Button, Card, Dialog, Badge, Input, Select, Table, Tabs, Toast, etc. |
| `/chat` | ChatContainer, ChatInput, ChatMessage, AgentTimeline, ThinkingIndicator |
| `/run` | ToolCallFeed, RunGroup, InlineToolItem, ExpandedToolDetail |
| `/workspace` | SandboxWorkbench, WorkspaceLayout, DirectoryPane, RuntimePane, StatusBar |
| `/openui` | OpenUIArtifactRenderer and schema types for structured artifact rendering |
| `/files` | FileTree, FilePreview, FileTabs, FileArtifactPane |
| `/dashboard` | [Sidebar](./docs/sidebar.md), DashboardLayout, BillingDashboard, UsageChart, ProfileSelector |
| `/editor` | TipTap collaborative editor (requires optional peers) |
| `/terminal` | xterm.js terminal view (requires optional peers) |
| `/markdown` | Markdown renderer with GFM, code blocks, copy button |
| `/auth` | AuthHeader, GitHubLoginButton, UserMenu |
| `/pages` | Pre-built billing, pricing, profiles pages |
| `/hooks` | useSSEStream, useAuth, usePtySession, useRunGroups, etc. |
| `/sdk-hooks` | Lightweight session/stream hooks without the React Query CRUD hook bundle |
| `/stores` | Session and chat nanostores |
| `/types` | TypeScript types for messages, parts, runs, sessions |
| `/utils` | cn, formatDuration, timeAgo, tool display helpers |
| `/styles` | Compiled CSS bundle |

## Stack

- [Radix UI](https://www.radix-ui.com/) primitives
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Lucide](https://lucide.dev/) icons
- [CVA](https://cva.style/) for variant management
- Shared semantic tokens for `vault`, `ocean`, `ember`, `forest`, and `dawn` sandbox themes
- ESM-only, tree-shakeable, fully typed

## License

Apache-2.0
