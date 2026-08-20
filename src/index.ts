// =============================================================================
// @tangle-network/sandbox-ui — Unified UI component library
// =============================================================================
//
// Generic primitives now live in `@tangle-network/ui` and re-export through
// shim subpaths in this package. Sandbox-coupled surfaces (workspace,
// dashboard, pages, terminal, sandbox-specific hooks/stores/types, plus the
// sandbox-branded Logo) stay here.

// --- Primitives (named — TerminalLine/TerminalInput/TerminalCursor are intentionally
//     excluded here since they clash with workspace's own `TerminalLine` type;
//     they are re-exported below as aliased TerminalDisplay* to match 0.14 root names) ---
export {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  type BadgeProps,
  badgeVariants,
  Button,
  type ButtonProps,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CodeBlock,
  type CodeBlockProps,
  CopyButton,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropZone,
  type DropZoneProps,
  EmptyState,
  type EmptyStateProps,
  FilterField,
  type FilterFieldProps,
  InlineCode,
  type InlineCodeProps,
  Input,
  type InputProps,
  Label,
  Logo,
  type LogoProps,
  Metric,
  type MetricProps,
  MetricStrip,
  type MetricStripProps,
  Progress,
  SegmentedControl,
  type SegmentedControlOption,
  type SegmentedControlProps,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SidebarDropZone,
  type SidebarDropZoneProps,
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  StatCard,
  type StatCardProps,
  StatusPill,
  type StatusPillProps,
  type StatusTone,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TangleKnot,
  TerminalDisplay,
  Textarea,
  type TextareaProps,
  ThemeToggle,
  type Toast,
  ToastContainer,
  ToastProvider,
  Toolbar,
  type ToolbarProps,
  type UploadFile,
  UploadProgress,
  type UploadProgressProps,
  useTheme,
  useToast,
} from "./primitives";

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

// --- Dashboard ---
export * from "./dashboard";

// --- Auth ---
export * from "./auth";

// --- Markdown ---
export { Markdown, type MarkdownProps } from "@tangle-network/ui/markdown";

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
