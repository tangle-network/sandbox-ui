export {
  AgentTimeline,
  type AgentTimelineArtifactItem,
  type AgentTimelineCustomItem,
  type AgentTimelineItem,
  type AgentTimelineMessageItem,
  type AgentTimelineProps,
  type AgentTimelineStatusItem,
  type AgentTimelineTone,
  type AgentTimelineToolGroupItem,
  type AgentTimelineToolItem,
  ChatContainer,
  type ChatContainerProps,
  ChatMessage,
  type ChatMessageProps,
  MessageList,
  type MessageListProps,
  type MessageRole,
  ThinkingIndicator,
  type ThinkingIndicatorProps,
  UserMessage,
  type UserMessageProps,
} from "@tangle-network/ui/chat";

export {
  DEFAULT_REASONING_LEVEL_OPTIONS,
  HARNESS_REASONING_OPTIONS,
  ReasoningLevelPicker,
  type ReasoningLevel,
  type ReasoningLevelOption,
  type ReasoningLevelPickerProps,
} from "./reasoning-level-picker";

export {
  AgentProfilePicker,
  type AgentProfileCapability,
  type AgentProfileDraft,
  type AgentProfileOption,
  type AgentProfilePickerProps,
} from "./agent-profile-picker";

export {
  modelProvider,
  snapHarnessToModel,
} from "./harness-model-compat";

export {
  ArtifactAgentDock,
  createFetchTransport,
  type ArtifactAgentDockProps,
  type ArtifactAgentDockTransport,
  type ArtifactDockMessage,
  type ArtifactDockStreamEvent,
  type ArtifactKind,
  type ArtifactScope,
} from "./artifact-agent-dock";
