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
export { ChatContainer } from "./chat/chat-container";
export { MessageList } from "./chat/message-list";
export { UserMessage } from "./chat/user-message";
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

// --- Run / Tool Calls ---
export { ToolCallStep, ToolCallGroup, type ToolCallStepProps, type ToolCallGroupProps, type ToolCallType, type ToolCallStatus } from "./run/tool-call-step";
export { ToolCallFeed, parseToolEvent, type ToolCallFeedProps, type ToolCallData, type FeedSegment } from "./run/tool-call-feed";
export { RunGroup } from "./run/run-group";
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
export { FilePreview, type FilePreviewProps } from "./files/file-preview";
export { FileTabs, type FileTabsProps, type FileTabData } from "./files/file-tabs";
export { FileArtifactPane, type FileArtifactPaneProps } from "./files/file-artifact-pane";

// --- Dashboard ---
export { AppSidebar, type AppSidebarProps, type SidebarNavItem, type SidebarSandbox } from "./dashboard/app-sidebar";
export { ClusterStatusBar, type ClusterStatusBarProps, type ClusterStatusItem } from "./dashboard/cluster-status-bar";
export { CreditBalance, type CreditBalanceProps } from "./dashboard/credit-balance";
export { InvoiceTable, type InvoiceTableProps, type Invoice } from "./dashboard/invoice-table";
export { PlanCards, type PlanCardsProps, type PlanCardData } from "./dashboard/plan-cards";
export { DashboardLayout, type DashboardLayoutProps, type DashboardUser, type NavItem, type TopNavLink } from "./dashboard/dashboard-layout";
export { ResourceMeter, type ResourceMeterProps } from "./dashboard/resource-meter";
export { SandboxCard, NewSandboxCard, type SandboxCardProps, type SandboxCardData, type SandboxStatus, type NewSandboxCardProps } from "./dashboard/sandbox-card";
export { SandboxTable, type SandboxTableProps } from "./dashboard/sandbox-table";
export { BillingDashboard, type BillingDashboardProps } from "./dashboard/billing-dashboard";
export { PricingPage as PricingCards, type PricingPageProps } from "./dashboard/pricing-page";
export { UsageChart, type UsageChartProps, type UsageDataPoint } from "./dashboard/usage-chart";
export { BackendSelector, type BackendSelectorProps, type Backend } from "./dashboard/backend-selector";
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
export { useRunGroups } from "./hooks/use-run-groups";
export { useRunCollapseState } from "./hooks/use-run-collapse-state";
export { useAutoScroll } from "./hooks/use-auto-scroll";
export { useSessionStream } from "./hooks/use-session-stream";
export { useDropdownMenu } from "./hooks/use-dropdown-menu";
export { usePtySession } from "./hooks/use-pty-session";
export { useSidecarAuth } from "./hooks/use-sidecar-auth";

// --- Types ---
export type { SessionMessage } from "./types/message";
export type { TextPart, ToolPart, ReasoningPart, SessionPart, ToolStatus, ToolState, ToolTime } from "./types/parts";
export type { Run, RunStats, GroupedMessage, ToolCategory } from "./types/run";
export type { Session } from "./types/sidecar";
export type { ToolDisplayMetadata, DisplayVariant, CustomToolRenderer } from "./types/tool-display";
export type { AgentBranding } from "./types/branding";

// --- Utils ---
export { cn } from "./lib/utils";
export { copyText } from "./utils/copy-text";
export { formatDuration, truncateText } from "./utils/format";
export { timeAgo } from "./utils/time-ago";
export { getToolCategory, getToolDisplayMetadata, getToolErrorText, TOOL_CATEGORY_ICONS } from "./utils/tool-display";
