![Tangle Network Banner](https://raw.githubusercontent.com/tangle-network/tangle/refs/heads/main/assets/Tangle%20%20Banner.png)

<p align="center">
  <a href="https://www.npmjs.com/package/@tangle-network/sandbox-ui"><img src="https://img.shields.io/npm/v/@tangle-network/sandbox-ui?color=8E59FF&label=npm" alt="npm" /></a>
  <a href="https://github.com/tangle-network/sandbox-ui/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@tangle-network/sandbox-ui?color=6888F9" alt="license" /></a>
  <a href="https://github.com/tangle-network/sandbox-ui"><img src="https://img.shields.io/github/stars/tangle-network/sandbox-ui?style=flat&color=8E59FF" alt="stars" /></a>
</p>

# @tangle-network/sandbox-ui

React component library for [Tangle Sandbox](https://sandbox.tangle.tools) — 100+ components for building AI agent interfaces with chat, terminal, file browser, tool call feeds, and dashboard views.

## Install

```bash
npm install @tangle-network/sandbox-ui
```

**Peer dependencies:** `react` and `react-dom` (18 or 19). Optional peers for specific subpaths — see [package.json](./package.json).

## Usage

```tsx
import { Button, Badge, Card } from "@tangle-network/sandbox-ui/primitives";
import { ChatContainer } from "@tangle-network/sandbox-ui/chat";
import { WorkspaceLayout } from "@tangle-network/sandbox-ui/workspace";
```

Import styles in your app root:

```tsx
import "@tangle-network/sandbox-ui/styles";
```

## Subpath Exports

| Subpath | Description |
|---------|-------------|
| `/primitives` | Button, Card, Dialog, Badge, Input, Select, Table, Tabs, Toast, etc. |
| `/chat` | ChatContainer, ChatInput, ChatMessage, MessageList |
| `/run` | ToolCallFeed, RunGroup, InlineToolItem, ExpandedToolDetail |
| `/workspace` | WorkspaceLayout, StatusBar, StatusBanner, TerminalPanel |
| `/files` | FileTree, FilePreview, FileTabs |
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
- ESM-only, tree-shakeable, fully typed

## License

Apache-2.0
