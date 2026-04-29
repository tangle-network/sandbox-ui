// =============================================================================
// @tangle-network/sandbox-ui — Unified UI component library
// =============================================================================

// --- Primitives ---
export {
  Avatar, AvatarFallback, AvatarImage,
  Badge, type BadgeProps, badgeVariants,
  Button, type ButtonProps, buttonVariants,
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger,
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
  EmptyState, type EmptyStateProps,
  Input, type InputProps, Textarea, type TextareaProps,
  Label,
  Progress,
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectScrollDownButton, SelectScrollUpButton, SelectSeparator,
  SelectTrigger, SelectValue,
  Skeleton, SkeletonCard, SkeletonTable,
  StatCard, type StatCardProps,
  Switch,
  Table, TableBody, TableCaption, TableCell, TableFooter,
  TableHead, TableHeader, TableRow,
  Tabs, TabsContent, TabsList, TabsTrigger,
  ToastProvider, ToastContainer, useToast, type Toast,
} from "./primitives/index";

export { Logo, TangleKnot, type LogoProps } from "./primitives/logo";
export { ThemeToggle, useTheme } from "./primitives/theme-toggle";
export { CodeBlock as CodeBlockDisplay, InlineCode } from "./primitives/code-block";
export { TerminalDisplay, TerminalLine as TerminalDisplayLine, TerminalInput as TerminalDisplayInput, TerminalCursor as TerminalDisplayCursor } from "./primitives/terminal-display";

// --- Workspace ---
export { WorkspaceLayout, type WorkspaceLayoutProps } from "./workspace/workspace-layout";
export { ArtifactPane, type ArtifactPaneProps } from "./workspace/artifact-pane";
export { DirectoryPane, type DirectoryPaneProps } from "./workspace/directory-pane";
export { RuntimePane, type RuntimePaneProps } from "./workspace/runtime-pane";
export {
  SessionSidebar,
  type SessionSidebarProps,
  type SessionSidebarItem,
  type SessionSidebarLink,
  type SessionSidebarFilter,
  type SessionSidebarBadge,
} from "./workspace/session-sidebar";
export { SessionActivityMonitor, type SessionActivityMonitorProps } from "./workspace/session-activity-monitor";
export {
  SandboxWorkbench,
  AgentWorkbench,
  type SandboxWorkbenchProps,
  type SandboxWorkbenchLayoutOptions,
  type SandboxWorkbenchSessionProps,
  type SandboxWorkbenchArtifact,
  type SandboxWorkbenchFileArtifact,
  type SandboxWorkbenchMarkdownArtifact,
  type SandboxWorkbenchOpenUIArtifact,
  type SandboxWorkbenchCustomArtifact,
} from "./workspace/sandbox-workbench";
export { StatusBar, type StatusBarProps, type ContextBadge } from "./workspace/status-bar";
export { StatusBanner, type StatusBannerProps, type BannerType } from "./workspace/status-banner";
export { AuditResults, type AuditResultsProps, type FormAudit, type AuditCheck } from "./workspace/audit-results";
export { TerminalPanel, type TerminalProps, type TerminalLine } from "./workspace/terminal-panel";
export { TaskBoard, type TaskBoardProps, type TaskBoardItem, type TaskBoardColumn } from "./workspace/task-board";
export { CalendarView, type CalendarViewProps, type CalendarEvent } from "./workspace/calendar-view";
export { ApprovalQueue, type ApprovalQueueProps, type ApprovalItem, type ApprovalConfidenceStat } from "./workspace/approval-queue";

// --- OpenUI ---
export {
  OpenUIArtifactRenderer,
  type OpenUIArtifactRendererProps,
  type OpenUIAction,
  type OpenUIPrimitive,
  type OpenUIComponentNode,
  type OpenUIHeadingNode,
  type OpenUITextNode,
  type OpenUIBadgeNode,
  type OpenUIStatNode,
  type OpenUIKeyValueNode,
  type OpenUICodeNode,
  type OpenUIMarkdownNode,
  type OpenUITableNode,
  type OpenUIActionsNode,
  type OpenUISeparatorNode,
  type OpenUIStackNode,
  type OpenUIGridNode,
  type OpenUICardNode,
} from "./openui/openui-artifact-renderer";

// --- Chat ---
export { ChatMessage, type ChatMessageProps, type MessageRole } from "./chat/chat-message";
export { ChatInput, type ChatInputProps, type PendingFile } from "./chat/chat-input";
export { ChatContainer, type ChatContainerProps } from "./chat/chat-container";
export { MessageList, type MessageListProps } from "./chat/message-list";
export { UserMessage, type UserMessageProps } from "./chat/user-message";
export { ThinkingIndicator, type ThinkingIndicatorProps } from "./chat/thinking-indicator";
export {
  AgentTimeline,
  type AgentTimelineProps,
  type AgentTimelineItem,
  type AgentTimelineMessageItem,
  type AgentTimelineToolItem,
  type AgentTimelineToolGroupItem,
  type AgentTimelineStatusItem,
  type AgentTimelineArtifactItem,
  type AgentTimelineCustomItem,
  type AgentTimelineTone,
} from "./chat/agent-timeline";

// --- Editor / Collaboration ---
export {
  EditorProvider,
  useEditorContext,
  type EditorProviderProps,
  type EditorContextValue,
  type EditorUser,
  type ConnectionState,
  type Collaborator,
} from "./editor/editor-provider";
export {
  TiptapEditor,
  CollaboratorsList,
  EditorToolbar,
  type TiptapEditorProps,
} from "./editor/tiptap-editor";
export {
  DocumentEditorPane,
  type DocumentEditorPaneProps,
  type DocumentEditorMode,
  type DocumentEditorBackend,
  type DocumentEditorPaneCollaborationConfig,
} from "./editor/document-editor-pane";
export {
  useEditorConnection,
  useCollaborators,
  useCollaboratorPresence,
  useYjsState,
  useDocumentChanges,
  useAwareness,
} from "./editor/use-editor";

// --- Run / Tool Calls ---
export { ToolCallStep, ToolCallGroup, type ToolCallStepProps, type ToolCallGroupProps, type ToolCallType, type ToolCallStatus } from "./run/tool-call-step";
export { ToolCallFeed, parseToolEvent, type ToolCallFeedProps, type ToolCallData, type FeedSegment } from "./run/tool-call-feed";
export { RunGroup, type RunGroupProps } from "./run/run-group";
export { InlineToolItem } from "./run/inline-tool-item";
export { InlineThinkingItem } from "./run/inline-thinking-item";
export { ExpandedToolDetail } from "./run/expanded-tool-detail";

// --- Tool Previews ---
export { CommandPreview } from "./tool-previews/command-preview";
export { WriteFilePreview } from "./tool-previews/write-file-preview";
export { GrepResultsPreview } from "./tool-previews/grep-results-preview";
export { GlobResultsPreview } from "./tool-previews/glob-results-preview";
export { WebSearchPreview } from "./tool-previews/web-search-preview";
export { QuestionPreview } from "./tool-previews/question-preview";
export { DiffPreview } from "./tool-previews/diff-preview";

// --- Files ---
export {
  FileTree,
  filterFileTree,
  type FileTreeProps,
  type FileNode,
  type FileTreeVisibilityOptions,
} from "./files/file-tree";
export {
  RichFileTree,
  type RichFileTreeProps,
  type RichFileTreeGitEntry,
  type RichFileTreeGitStatus,
  type RichFileTreeThemeVars,
} from "./files/rich-file-tree";
export { FilePreview, type FilePreviewProps } from "./files/file-preview";
export { FileTabs, type FileTabsProps, type FileTabData } from "./files/file-tabs";
export { FileArtifactPane, type FileArtifactPaneProps } from "./files/file-artifact-pane";

// --- Dashboard ---
export {
  Sidebar, SidebarRail, SidebarRailHeader, SidebarRailNav, SidebarRailFooter,
  SidebarPanel, SidebarPanelHeader, SidebarPanelContent, SidebarContent,
  RailButton, RailModeButton, RailSeparator, ProfileAvatar,
  type SidebarProps, type SidebarRailProps, type SidebarRailHeaderProps,
  type SidebarRailNavProps, type SidebarRailFooterProps,
  type SidebarPanelProps, type SidebarPanelHeaderProps, type SidebarPanelContentProps,
  type SidebarContentProps, type RailButtonProps, type RailModeButtonProps,
  type RailSeparatorProps, type ProfileAvatarProps, type SidebarUser,
} from "./dashboard/app-sidebar";
export { SidebarProvider, useSidebar, SIDEBAR_RAIL_WIDTH, SIDEBAR_PANEL_WIDTH, SIDEBAR_TOTAL_WIDTH, SIDEBAR_MOBILE_WIDTH, type SidebarProviderProps } from "./dashboard/sidebar-context";
export { ClusterStatusBar, type ClusterStatusBarProps, type ClusterStatusItem } from "./dashboard/cluster-status-bar";
export { CreditBalance, type CreditBalanceProps } from "./dashboard/credit-balance";
export { InvoiceTable, type InvoiceTableProps, type Invoice } from "./dashboard/invoice-table";
export { PlanCards, type PlanCardsProps, type PlanCardData } from "./dashboard/plan-cards";
export { DashboardLayout, type DashboardLayoutProps, type DashboardUser, type NavItem, type TopNavLink, type ProductVariant, type PanelConfig } from "./dashboard/dashboard-layout";
export { ResourceMeter, type ResourceMeterProps } from "./dashboard/resource-meter";
export { SandboxCard, NewSandboxCard, type SandboxCardProps, type SandboxCardData, type SandboxStatus, type NewSandboxCardProps } from "./dashboard/sandbox-card";
export { SandboxTable, type SandboxTableProps } from "./dashboard/sandbox-table";
export { BillingDashboard, type BillingDashboardProps } from "./dashboard/billing-dashboard";
export { PricingPage as PricingCards, type PricingPageProps } from "./dashboard/pricing-page";
export { UsageChart, type UsageChartProps, type UsageDataPoint } from "./dashboard/usage-chart";
export { BackendSelector, type BackendSelectorProps, type Backend } from "./dashboard/backend-selector";
export { HarnessPicker, HARNESS_OPTIONS, type HarnessPickerProps, type HarnessType } from "./dashboard/harness-picker";
export { ModelPicker, canonicalModelId, formatPricing, formatContext, type ModelPickerProps, type ModelPickerVariant, type ModelInfo, type ModelPreset } from "./dashboard/model-picker";
export { ProfileSelector, type ProfileSelectorProps, ProfileComparison, type ProfileComparisonProps } from "./dashboard/profile-selector";
export { VariantList, type VariantListProps } from "./dashboard/variant-list";

// --- Auth ---
export { AuthHeader, GitHubLoginButton, UserMenu } from "./auth/auth";
export { LoginLayout, type LoginLayoutProps } from "./auth/login-layout";

// --- Markdown ---
export { Markdown, type MarkdownProps } from "./markdown/markdown";
export { CodeBlock, CopyButton } from "./markdown/code-block";
// --- Hooks ---
export { useToolCallStream, type UseToolCallStreamReturn } from "./hooks/use-tool-call-stream";
export { useAuth, createAuthFetcher, useApiKey } from "./hooks/use-auth";
export { useSSEStream } from "./hooks/use-sse-stream";
export {
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
} from "./hooks/use-sdk-session";
export {
  useRealtimeSession,
  RealtimeSessionRegistry,
  type RealtimeSessionOptions,
  type RealtimeSessionState,
  type RealtimeSessionTarget,
  type RealtimeSessionRegistryProps,
} from "./hooks/use-realtime-session";
export { useRunGroups } from "./hooks/use-run-groups";
export { useRunCollapseState } from "./hooks/use-run-collapse-state";
export { useAutoScroll } from "./hooks/use-auto-scroll";
export { useSessionStream } from "./hooks/use-session-stream";
export { useDropdownMenu } from "./hooks/use-dropdown-menu";
export { usePtySession } from "./hooks/use-pty-session";
export { useSidecarAuth } from "./hooks/use-sidecar-auth";
export { useLiveTime } from "./hooks/use-live-time";
export {
  useSandboxMetrics,
  type SandboxMetrics,
  type SidecarMetricsPayload,
  type UseSandboxMetricsOptions,
  type UseSandboxMetricsResult,
} from "./hooks/use-sandbox-metrics";

// --- Types ---
export type { SessionMessage } from "./types/message";
export type { TextPart, ToolPart, ReasoningPart, SessionPart, ToolStatus, ToolState, ToolTime } from "./types/parts";
export type { Run, RunStats, GroupedMessage, ToolCategory } from "./types/run";
export type { Session } from "./types/sidecar";
export type { ToolDisplayMetadata, DisplayVariant, CustomToolRenderer } from "./types/tool-display";
export type { AgentBranding } from "./types/branding";
export type {
  SessionProjectKey,
  ActiveSessionStatus,
  ActiveSessionReconnectState,
  ActiveSessionConnectionState,
  ActiveSessionTransportMode,
  ActiveSessionRecord,
  ActiveSessionsState,
  RegisterActiveSessionOptions,
  ActiveSessionConnectionOptions,
  ActiveSessionActivityOptions,
  ActiveProjectActivity,
} from "./stores/active-sessions-store";

// --- Utils ---
export { cn } from "./lib/utils";
export { copyText } from "./utils/copy-text";
export { formatBytes, formatDuration, formatUptime, truncateText } from "./utils/format";
export { timeAgo } from "./utils/time-ago";
export { getToolCategory, getToolDisplayMetadata, getToolErrorText, TOOL_CATEGORY_ICONS } from "./utils/tool-display";

export { DropZone } from "./primitives/drop-zone";
export type { DropZoneProps } from "./primitives/drop-zone";
export { UploadProgress } from "./primitives/upload-progress";
export type { UploadProgressProps, UploadFile } from "./primitives/upload-progress";
export { SidebarDropZone } from "./primitives/sidebar-drop-zone";
export type { SidebarDropZoneProps } from "./primitives/sidebar-drop-zone";
