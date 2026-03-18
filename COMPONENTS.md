# @tangle-network/sandbox-ui — Component Manifest

## Status Legend
- ✅ Built
- 🔧 Needs work
- ❌ Not started

## Components

### Layout
| Component | Status | Description |
|-----------|--------|-------------|
| `<WorkspaceLayout>` | ✅ | 3-panel shell (left/center/right + bottom terminal) |
| `<PanelResizer>` | ❌ | Draggable panel dividers (left/right width adjustment) |
| `<StatusBar>` | ❌ | Bottom bar: model selector, linked context badges, credits |

### Chat
| Component | Status | Description |
|-----------|--------|-------------|
| `<ChatMessage>` | ❌ | Single message bubble — user or assistant, avatar, timestamp |
| `<ChatMessageList>` | ❌ | Scrolling message container, auto-scroll on new content, virtualized for long conversations |
| `<ChatInput>` | ❌ | Textarea with auto-resize, file attach button, send/cancel, keyboard shortcuts (Enter/Shift+Enter), model selector pill |
| `<ThinkingIndicator>` | ❌ | Animated indicator for agent thinking (bouncing dots + elapsed timer + "Thinking deeply..." for extended thinking) |
| `<StreamingText>` | ❌ | Renders text as it streams in, with cursor blink at end |

### Tool Calls (Conductor-style activity feed)
| Component | Status | Description |
|-----------|--------|-------------|
| `<ToolCallStep>` | ✅ | Single collapsible tool invocation (bash, read, write, etc.) |
| `<ToolCallGroup>` | ✅ | Groups steps under a heading |
| `<ToolCallFeed>` | ❌ | Full activity feed that interleaves tool calls with assistant text — the core Conductor pattern. Renders a sequence of `[text, tool_call, tool_result, text, tool_call, ...]` as a unified thread |

### File System
| Component | Status | Description |
|-----------|--------|-------------|
| `<FileTree>` | ✅ | Hierarchical directory browser with icons |
| `<FilePreview>` | ✅ | Universal file renderer (PDF, CSV, code, images, text) |
| `<FileTab>` | ❌ | Tab bar for open files in the preview panel (like browser tabs) |
| `<PdfViewer>` | ❌ | Full react-pdf viewer with pagination, zoom, page thumbnails |
| `<CsvTable>` | 🔧 | Sortable/filterable table for CSV data (basic version in FilePreview) |
| `<CodeView>` | 🔧 | Syntax highlighted code with line numbers (basic version in FilePreview, needs shiki integration) |
| `<MarkdownEditor>` | ❌ | WYSIWYG markdown editor for editing files (REVIEW_FLAGS.md, reports). View mode + edit mode toggle. |

### Markdown Rendering
| Component | Status | Description |
|-----------|--------|-------------|
| `<Markdown>` | ❌ | Rich markdown renderer with GFM tables, code blocks, lists, links, math. Wraps react-markdown + remark-gfm. Tangle-themed. |
| `<CodeBlock>` | ❌ | Fenced code block with syntax highlighting, copy button, window chrome dots, language label |

### Status & Feedback
| Component | Status | Description |
|-----------|--------|-------------|
| `<StatusBanner>` | ❌ | Full-width banner: provisioning spinner, connection lost, error states |
| `<AuditResults>` | ❌ | Structured pass/fail per form per field, expandable detail |
| `<CreditBadge>` | ❌ | Compact credit balance display with usage indicator |
| `<ModelSelector>` | ❌ | Dropdown/pill to switch model (Sonnet/Opus/Haiku) |
| `<FileBadge>` | ❌ | Linked context badge (like Conductor's "Link Issue ×1") for attached docs |

### Terminal
| Component | Status | Description |
|-----------|--------|-------------|
| `<Terminal>` | ❌ | Read-only terminal output panel with ANSI color support, auto-scroll |

---

## Hooks

| Hook | Status | Description |
|------|--------|-------------|
| `useChat()` | ❌ | Manages conversation state, message history, sending, streaming. Wraps WebSocket/SSE connection to orchestrator. Returns `{ messages, send, isStreaming, error }` |
| `useToolCallStream()` | ❌ | Parses SSE events into structured `ToolCallStep[]` data. Handles `message.part.updated`, `tool.invocation`, `tool.result` events. |
| `useFileSystem()` | ❌ | Lists files from sandbox, reads content, watches for changes. Returns `{ tree: FileNode, readFile, refresh }` |
| `useSandboxConnection()` | ❌ | Manages sandbox lifecycle: provision, connect, reconnect, health check. Returns `{ status, sidecarUrl, connect, disconnect }` |
| `usePdfDocument()` | ❌ | Loads PDF blob, provides page count, renders pages via react-pdf |

---

## Design Tokens

| Asset | Status | Description |
|-------|--------|-------------|
| `tokens.css` | ✅ | CSS variables for all colors, spacing, radii, transitions |
| Satoshi font | ❌ | Need to bundle or reference Satoshi variable font |
| JetBrains Mono | ❌ | Need to bundle or reference JetBrains Mono |
| Tailwind preset | ❌ | Tailwind config that maps tokens to Tailwind utilities |

---

## Integration Pattern

Consumer apps (tax-filler-filer, blueprint-agent, etc.) use the components like:

```tsx
import {
  WorkspaceLayout,
  ChatMessageList,
  ChatInput,
  FileTree,
  FilePreview,
  ToolCallFeed,
  useChat,
  useFileSystem,
  useToolCallStream,
} from "@tangle-network/sandbox-ui";
import "@tangle-network/sandbox-ui/styles";

function SessionPage({ sessionId }: { sessionId: string }) {
  const chat = useChat({ sessionId, orchestratorUrl, token });
  const files = useFileSystem({ sessionId, sidecarUrl });
  const toolCalls = useToolCallStream(chat.sseEvents);
  const [previewFile, setPreviewFile] = useState(null);

  return (
    <WorkspaceLayout
      left={
        <FileTree
          root={files.tree}
          onSelect={(path) => setPreviewFile(path)}
        />
      }
      center={
        <ChatMessageList messages={chat.messages}>
          {/* Tool calls render inline between messages */}
          {(msg) => msg.toolCalls && (
            <ToolCallFeed steps={msg.toolCalls} />
          )}
        </ChatMessageList>
      }
      centerFooter={
        <ChatInput
          onSend={chat.send}
          isStreaming={chat.isStreaming}
          onCancel={chat.cancel}
        />
      }
      right={previewFile && (
        <FilePreview
          filename={previewFile}
          content={files.readFile(previewFile)}
          onClose={() => setPreviewFile(null)}
        />
      )}
    />
  );
}
```

---

## Build Order (Next Session)

### Phase 1 — Core Chat (highest impact)
1. `<ChatMessage>` — message bubble
2. `<Markdown>` + `<CodeBlock>` — rich content rendering
3. `<ChatMessageList>` — scrolling container
4. `<ChatInput>` — input bar with attach + send
5. `<ThinkingIndicator>` — animated thinking state
6. `<StreamingText>` — cursor-at-end streaming

### Phase 2 — Tool Call Feed
7. `<ToolCallFeed>` — interleaved text + tool calls
8. `useToolCallStream()` — SSE event parser

### Phase 3 — File System
9. `<PdfViewer>` — react-pdf integration
10. `<FileTab>` — tab bar for open files
11. `useFileSystem()` — sandbox file listing
12. `<MarkdownEditor>` — WYSIWYG markdown editing

### Phase 4 — Hooks & Integration
13. `useChat()` — full chat state management
14. `useSandboxConnection()` — lifecycle management
15. `<StatusBanner>` + `<ModelSelector>` + `<CreditBadge>`
16. `<Terminal>` — output panel
17. `<AuditResults>` — structured audit display

### Phase 5 — Polish
18. `<PanelResizer>` — draggable dividers
19. Tailwind preset + font bundling
20. `<StatusBar>` — bottom bar
