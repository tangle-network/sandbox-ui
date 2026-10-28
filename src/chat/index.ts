export {
  AgentTimeline, AgentTimelineColumn, AgentTimelineStep, agentTimelineStepKind, foldSummary,
  type AgentTimelineArtifactItem, type AgentTimelineCustomItem, type AgentTimelineFoldItem,
  type AgentTimelineItem, type AgentTimelineMessageItem, type AgentTimelineProps,
  type AgentTimelineStatusItem, type AgentTimelineStepKind, type AgentTimelineStepProps,
  type AgentTimelineTone, type AgentTimelineToolGroupItem, type AgentTimelineToolItem,
  ChatContainer, ChatMessage, isViewerMessage, MessageAuthor, MessageList,
  type ChatAuthor, type ChatContainerProps, type ChatMessageProps, type MessageAuthorProps,
  type MessageListProps, type MessageRole,
  SpeakerHeader, partitionBySpeaker, type Speaker, type SpeakerHeaderProps,
  type SpeakerPart, type SpeakerSection, type SpeakerState,
  ThinkingIndicator, type ThinkingIndicatorProps, TRANSCRIPT_TEXT, UserMessage, type UserMessageProps,
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
  type ArtifactAgentDockProps,
  type ArtifactAgentDockTransport,
  type ArtifactDockMessage,
  type ArtifactDockStreamEvent,
  type ArtifactKind,
  type ArtifactScope,
} from "./artifact-agent-dock";
