export { useAuth, createAuthFetcher, useApiKey } from "./use-auth";
export type { AuthUser, UseAuthOptions, UseAuthResult } from "./use-auth";

export { useAutoScroll } from "./use-auto-scroll";

export { useDropdownMenu } from "./use-dropdown-menu";

export { usePtySession } from "./use-pty-session";
export type {
  UsePtySessionOptions,
  UsePtySessionReturn,
} from "./use-pty-session";

export { useRunCollapseState } from "./use-run-collapse-state";

export { useRunGroups } from "./use-run-groups";
export type { UseRunGroupsOptions } from "./use-run-groups";

export {
  useSessions,
  useCreateSession,
  useDeleteSession,
  useRenameSession,
} from "./use-session-crud";

export { useSessionStream } from "./use-session-stream";
export type {
  SessionInfo,
  UseSessionStreamOptions,
  UseSessionStreamResult,
} from "./use-session-stream";

export { useSidecarAuth } from "./use-sidecar-auth";
export type { UseSidecarAuthOptions, SidecarAuth } from "./use-sidecar-auth";

export { useSSEStream } from "./use-sse-stream";
export type {
  SSEEvent,
  ConnectionState,
  UseSSEStreamOptions,
  UseSSEStreamResult,
  TaskStreamEvent,
  AgentStreamEvent,
  TerminalStreamEvent,
  AutomationStreamEvent,
  BotStreamEvent,
} from "./use-sse-stream";

export { useSdkSession } from "./use-sdk-session";
export type {
  SdkSessionAttachment,
  SdkSessionEvent,
  SdkSessionSeed,
  UseSdkSessionOptions,
  UseSdkSessionReturn,
  BeginAssistantMessageOptions,
  AppendUserMessageOptions,
  CompleteAssistantMessageOptions,
  ApplySdkEventOptions,
} from "./use-sdk-session";

export { useToolCallStream } from "./use-tool-call-stream";
export type { UseToolCallStreamReturn } from "./use-tool-call-stream";
