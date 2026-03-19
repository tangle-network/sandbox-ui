import {
  memo,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "../lib/utils";
import type { SessionMessage } from "../types/message";
import type { SessionPart, TextPart, ToolPart } from "../types/parts";
import type { AgentBranding } from "../types/branding";
import type { CustomToolRenderer } from "../types/tool-display";
import { useRunGroups } from "../hooks/use-run-groups";
import { useRunCollapseState } from "../hooks/use-run-collapse-state";
import { useAutoScroll } from "../hooks/use-auto-scroll";
import { MessageList } from "./message-list";
import {
  AgentTimeline,
  type AgentTimelineItem,
} from "./agent-timeline";
import { ChatInput, type PendingFile } from "./chat-input";
import { InlineThinkingItem } from "../run/inline-thinking-item";
import { getToolDisplayMetadata } from "../utils/tool-display";

export interface ChatContainerProps {
  messages: SessionMessage[];
  partMap: Record<string, SessionPart[]>;
  isStreaming: boolean;
  onSend?: (text: string) => void;
  onCancel?: () => void;
  branding?: AgentBranding;
  placeholder?: string;
  className?: string;
  /** Hide the input area (useful for read-only views). */
  hideInput?: boolean;
  /** Custom renderer for tool details. Return ReactNode to override, null to use default. */
  renderToolDetail?: CustomToolRenderer;
  /** Presentation mode for the session view. */
  presentation?: "runs" | "timeline";
  modelLabel?: string;
  onModelClick?: () => void;
  pendingFiles?: PendingFile[];
  onRemoveFile?: (id: string) => void;
  onAttach?: (files: FileList) => void;
  disabled?: boolean;
}

function formatUnknown(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function createdAtFromMessage(message: SessionMessage) {
  return message.time?.created ? new Date(message.time.created) : undefined;
}

function mapToolPartToTimelineType(part: ToolPart) {
  const name = part.tool.toLowerCase().replace(/^tool:/, "");

  switch (name) {
    case "bash":
    case "shell":
    case "command":
    case "execute":
      return "bash" as const;
    case "write":
    case "write_file":
    case "create_file":
      return "write" as const;
    case "read":
    case "read_file":
    case "cat":
      return "read" as const;
    case "edit":
    case "patch":
    case "sed":
      return "edit" as const;
    case "glob":
    case "find":
      return "glob" as const;
    case "ls":
      return "list" as const;
    case "grep":
    case "search":
    case "rg":
      return "grep" as const;
    case "inspect":
      return "inspect" as const;
    default:
      return "unknown" as const;
  }
}

function buildTimelineItems(
  messages: SessionMessage[],
  partMap: Record<string, SessionPart[]>,
  isStreaming: boolean,
): { items: AgentTimelineItem[]; showThinking: boolean } {
  const items: AgentTimelineItem[] = [];
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");

  for (const message of messages) {
    const parts = partMap[message.id] ?? [];

    if (message.role === "user") {
      const content = parts
        .filter((part): part is TextPart => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim();

      if (!content) continue;

      items.push({
        id: message.id,
        kind: "message",
        role: "user",
        content,
        timestamp: createdAtFromMessage(message),
      });
      continue;
    }

    parts.forEach((part, index) => {
      const itemId = `${message.id}-${index}`;

      if (part.type === "text" && !part.synthetic && part.text.trim()) {
        items.push({
          id: itemId,
          kind: "message",
          role: "assistant",
          content: part.text,
          timestamp: createdAtFromMessage(message),
          isStreaming: isStreaming && lastAssistantMessage?.id === message.id && index === parts.length - 1,
        });
        return;
      }

      if (part.type === "reasoning") {
        items.push({
          id: itemId,
          kind: "custom",
          content: <InlineThinkingItem part={part} />,
        });
        return;
      }

      if (part.type === "tool") {
        const meta = getToolDisplayMetadata(part as ToolPart);
        const start = part.state.time?.start;
        const end = part.state.time?.end;

        items.push({
          id: itemId,
          kind: "tool",
          call: {
            id: part.id,
            type: mapToolPartToTimelineType(part),
            label: meta.description ? `${meta.title}: ${meta.description}` : meta.title,
            status:
              part.state.status === "completed"
                ? "success"
                : part.state.status === "error"
                  ? "error"
                  : "running",
            detail: formatUnknown(part.state.input),
            output: formatUnknown(part.state.output),
            duration: start && end ? end - start : undefined,
          },
        });
      }
    });
  }

  const showThinking =
    isStreaming &&
    lastAssistantMessage != null &&
    !items.some(
      (item) =>
        item.kind === "message" &&
        item.role === "assistant" &&
        item.id.startsWith(lastAssistantMessage.id),
    );

  return { items, showThinking };
}

/**
 * Full chat container: message list + auto-scroll + input area.
 * Orchestrates useRunGroups, useRunCollapseState, and useAutoScroll.
 */
export const ChatContainer = memo(
  ({
    messages,
    partMap,
    isStreaming,
    onSend,
    onCancel,
    branding,
    placeholder = "Type a message...",
    className,
    hideInput = false,
    renderToolDetail,
    presentation = "runs",
    modelLabel,
    onModelClick,
    pendingFiles,
    onRemoveFile,
    onAttach,
    disabled = false,
  }: ChatContainerProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Group messages into runs
    const groups = useRunGroups({ messages, partMap, isStreaming });

    // Extract runs for collapse state
    const runs = groups.filter((g) => g.type === "run").map((g) => g.run);
    const { isCollapsed, toggleCollapse } = useRunCollapseState(runs);

    // Auto-scroll
    const { isAtBottom, scrollToBottom } = useAutoScroll(scrollRef, [
      messages,
      partMap,
      isStreaming,
    ]);

    const timeline = useMemo(
      () => buildTimelineItems(messages, partMap, isStreaming),
      [messages, partMap, isStreaming],
    );

    const handleSend = useCallback(
      (text: string) => {
        onSend?.(text);
      },
      [onSend],
    );

    return (
      <div className={cn("flex flex-col h-full", className)}>
        {/* Message area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              No messages yet
            </div>
          ) : presentation === "timeline" ? (
            <AgentTimeline items={timeline.items} isThinking={timeline.showThinking} />
          ) : (
            <MessageList
              groups={groups}
              partMap={partMap}
              isCollapsed={isCollapsed}
              onToggleCollapse={toggleCollapse}
              branding={branding}
              renderToolDetail={renderToolDetail}
            />
          )}
        </div>

        {/* Scroll-to-bottom button */}
        {!isAtBottom && (
          <div className="flex justify-center -mt-10 relative z-10">
            <button
              onClick={scrollToBottom}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                "border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]",
                "text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]",
              )}
            >
              <ArrowDown className="w-3 h-3" />
              Scroll to bottom
            </button>
          </div>
        )}

        {/* Input area */}
        {!hideInput && onSend && (
          <ChatInput
            onSend={handleSend}
            onCancel={onCancel}
            isStreaming={isStreaming}
            placeholder={placeholder}
            modelLabel={modelLabel}
            onModelClick={onModelClick}
            pendingFiles={pendingFiles}
            onRemoveFile={onRemoveFile}
            onAttach={onAttach}
            disabled={disabled}
            className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-dark)]"
          />
        )}
      </div>
    );
  },
);
ChatContainer.displayName = "ChatContainer";
