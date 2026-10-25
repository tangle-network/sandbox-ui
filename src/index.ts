// =============================================================================
// @tangle-network/sandbox-ui — Unified UI component library
// =============================================================================
//
// Generic primitives now live in `@tangle-network/ui` and re-export through
// shim subpaths in this package. Sandbox-coupled surfaces (workspace,
// dashboard, pages, terminal, sandbox-specific hooks/stores/types, plus the
// sandbox-branded Logo) stay here.

// --- Primitives ---
// Every ui primitive, plus Sandbox's own Logo and SectionTitle. `TerminalLine` at
// the root is the workspace terminal type (named below, so it wins over the
// star); ui's terminal display parts are also aliased as TerminalDisplay*.
export * from "./primitives";
export type { TerminalLine } from "./workspace";

// CodeBlockDisplay is the alias name historically used by sandbox-ui consumers.
export { CodeBlock as CodeBlockDisplay } from "@tangle-network/ui/markdown";

// Aliased terminal exports.
export {
  TerminalLine as TerminalDisplayLine,
  TerminalInput as TerminalDisplayInput,
  TerminalCursor as TerminalDisplayCursor,
} from "@tangle-network/ui/primitives";

// --- Workspace ---
export * from "./workspace";

// --- Workbench (artifact pane: code/diff/preview/ports/terminal) ---
export * from "./workbench";

// --- OpenUI ---
export * from "./openui";

// --- Chat ---
export * from "./chat";

// --- Run / Tool Calls ---
export * from "./run";

// --- Tool Previews ---
export {
  CommandPreview,
  type CommandPreviewProps,
  WriteFilePreview,
  type WriteFilePreviewProps,
  GrepResultsPreview,
  type GrepResultsPreviewProps,
  GlobResultsPreview,
  type GlobResultsPreviewProps,
  WebSearchPreview,
  type WebSearchPreviewProps,
  QuestionPreview,
  type QuestionPreviewProps,
  DiffPreview,
  type DiffPreviewProps,
} from "@tangle-network/ui/tool-previews";

// --- Files ---
export * from "./files";
export * from "./vault-tree";

// --- Dashboard ---
export * from "./dashboard";

// --- Auth ---
export * from "./auth";

// --- Connections ---
export * from "./connections";

// --- Markdown ---
export { ApiSchema, type ApiSchemaProps, type CopyButtonProps, codeBlockGrammar, fenceInfo, getSanitizedMarkdownHeadingIdFromRawFragment, Markdown, type MarkdownLinkChip, type MarkdownLinkChipResolver, type MarkdownProps, numericColumns, tableCsv } from "@tangle-network/ui/markdown";

// --- Hooks (named — excludes `ConnectionState`. The editor declares a
//     `ConnectionState` of its own, so neither type takes the root name and
//     each stays reachable from its subpath) ---
export {
  useAuth,
  createAuthFetcher,
  useApiKey,
  type AuthUser,
  type UseAuthOptions,
  type UseAuthResult,
  useAutoScroll,
  useDropdownMenu,
  useToolCallStream,
  type UseToolCallStreamReturn,
  useSSEStream,
  type SSEEvent,
  type UseSSEStreamOptions,
  type UseSSEStreamResult,
  type TaskStreamEvent,
  type AgentStreamEvent,
  type TerminalStreamEvent,
  type AutomationStreamEvent,
  type BotStreamEvent,
  useSdkSession,
  type SdkSessionAttachment,
  type SdkSessionEvent,
  type SdkSessionSeed,
  type UseSdkSessionOptions,
  type UseSdkSessionReturn,
  type BeginAssistantMessageOptions,
  type AppendUserMessageOptions,
  type CompleteAssistantMessageOptions,
  type ApplySdkEventOptions,
  useRealtimeSession,
  RealtimeSessionRegistry,
  type RealtimeSessionOptions,
  type RealtimeSessionState,
  type RealtimeSessionTarget,
  type RealtimeSessionRegistryProps,
  useRunGroups,
  type UseRunGroupsOptions,
  useRunCollapseState,
  useLiveTime,
  usePtySession,
  type UsePtySessionOptions,
  type UsePtySessionReturn,
  useSandboxMetrics,
  type SandboxMetrics,
  type SidecarMetricsPayload,
  type UseSandboxMetricsOptions,
  type UseSandboxMetricsResult,
  useSessionStream,
  type SessionDegradation,
  type SessionInfo,
  type UseSessionStreamOptions,
  type UseSessionStreamResult,
  useSidecarAuth,
  type UseSidecarAuthOptions,
  type SidecarAuth,
  useSessions,
  useCreateSession,
  useDeleteSession,
  useRenameSession,
} from "./hooks";

// --- Stores ---
export * from "./stores";

// --- Types ---
export * from "./types";

// --- Utils ---
export * from "./utils";
