import {
  memo,
  type ReactNode,
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
import type { Run } from "../types/run";
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
import {
  OpenUIArtifactRenderer,
  type OpenUIAction,
  type OpenUIComponentNode,
} from "../openui/openui-artifact-renderer";

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
  /** Callback when an OpenUI action button is pressed within inline OpenUI blocks. */
  onOpenUIAction?: (action: OpenUIAction) => void;
  /** Enable rendering OpenUI schemas inline in the chat timeline. Defaults to true. */
  enableOpenUI?: boolean;
  /** Optional actions rendered beside each grouped assistant run. */
  renderRunActions?: (run: Run) => ReactNode;
  /** Optional actions rendered below each user message bubble. */
  renderUserMessageActions?: (message: SessionMessage, parts: SessionPart[]) => ReactNode;
  /** Optional actions rendered beside individual tool items. */
  renderToolActions?: (
    part: ToolPart,
    options: {
      run: Run;
      messageId: string;
      partIndex: number;
    },
  ) => ReactNode;
}

const OPENUI_NODE_TYPES = new Set([
  "heading", "text", "badge", "stat", "key_value", "code",
  "markdown", "table", "actions", "separator", "stack", "grid", "card",
]);

function isOpenUINode(value: unknown): value is OpenUIComponentNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as Record<string, unknown>).type === "string" &&
    OPENUI_NODE_TYPES.has((value as Record<string, unknown>).type as string)
  );
}

function extractOpenUISchema(output: unknown): OpenUIComponentNode[] | null {
  if (output == null) return null;

  // Direct node or array of nodes
  if (isOpenUINode(output)) return [output];
  if (Array.isArray(output) && output.length > 0 && output.every(isOpenUINode)) {
    return output as OpenUIComponentNode[];
  }

  // Wrapped in { openui: ... } or { schema: ... } or { ui: ... }
  if (typeof output === "object" && !Array.isArray(output)) {
    const obj = output as Record<string, unknown>;
    for (const key of ["openui", "schema", "ui"]) {
      if (obj[key]) {
        const inner = obj[key];
        if (isOpenUINode(inner)) return [inner];
        if (Array.isArray(inner) && inner.length > 0 && inner.every(isOpenUINode)) {
          return inner as OpenUIComponentNode[];
        }
      }
    }
  }

  // Try to parse string as JSON containing OpenUI
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      return extractOpenUISchema(parsed);
    } catch {
      return null;
    }
  }

  return null;
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
  onOpenUIAction?: (action: OpenUIAction) => void,
  enableOpenUI = true,
): { items: AgentTimelineItem[]; showThinking: boolean } {
  const items: AgentTimelineItem[] = [];
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const toToolCall = (part: ToolPart) => {
    const meta = getToolDisplayMetadata(part as ToolPart);
    const start = part.state.time?.start;
    const end = part.state.time?.end;

    return {
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
    } as const;
  };

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

    const toolBuffer: ToolPart[] = [];
    const flushToolBuffer = (index: number) => {
      if (toolBuffer.length === 0) return;

      if (toolBuffer.length === 1) {
        items.push({
          id: `${message.id}-tool-${toolBuffer[0].id}`,
          kind: "tool",
          call: toToolCall(toolBuffer[0]),
        });
      } else {
        items.push({
          id: `${message.id}-tool-group-${index}`,
          kind: "tool_group",
          title: "Tool activity",
          calls: toolBuffer.map((part) => toToolCall(part)),
        });
      }

      // Render OpenUI schemas from completed tool outputs inline
      if (enableOpenUI) {
        for (const part of toolBuffer) {
          if (part.state.status !== "completed" || !part.state.output) continue;
          const schema = extractOpenUISchema(part.state.output);
          if (!schema) continue;
          items.push({
            id: `${message.id}-openui-${part.id}`,
            kind: "custom",
            content: (
              <div className="my-2 rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                <OpenUIArtifactRenderer schema={schema} onAction={onOpenUIAction} />
              </div>
            ),
          });
        }
      }

      toolBuffer.length = 0;
    };

    parts.forEach((part, index) => {
      const itemId = `${message.id}-${index}`;

      if (part.type === "tool") {
        toolBuffer.push(part);
        return;
      }

      flushToolBuffer(index);

      if (part.type === "text" && !part.synthetic && part.text.trim()) {
        // Check if the text itself contains an OpenUI JSON block
        if (enableOpenUI) {
          const jsonMatch = part.text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            const schema = extractOpenUISchema(jsonMatch[1]);
            if (schema) {
              // Render the text before the JSON block (if any)
              const beforeJson = part.text.slice(0, part.text.indexOf("```")).trim();
              if (beforeJson) {
                items.push({
                  id: `${itemId}-text`,
                  kind: "message",
                  role: "assistant",
                  content: beforeJson,
                  timestamp: createdAtFromMessage(message),
                });
              }
              items.push({
                id: `${itemId}-openui`,
                kind: "custom",
                content: (
                  <div className="my-2 rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                    <OpenUIArtifactRenderer schema={schema} onAction={onOpenUIAction} />
                  </div>
                ),
              });
              // Render text after the JSON block (if any)
              const afterJson = part.text.slice(part.text.lastIndexOf("```") + 3).trim();
              if (afterJson) {
                items.push({
                  id: `${itemId}-after`,
                  kind: "message",
                  role: "assistant",
                  content: afterJson,
                  timestamp: createdAtFromMessage(message),
                });
              }
              return;
            }
          }
        }

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
          content: <InlineThinkingItem part={part} defaultOpen={isStreaming && lastAssistantMessage?.id === message.id} />,
        });
        return;
      }
    });

    flushToolBuffer(parts.length);
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
    onOpenUIAction,
    enableOpenUI = true,
    renderRunActions,
    renderUserMessageActions,
    renderToolActions,
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
      () => buildTimelineItems(messages, partMap, isStreaming, onOpenUIAction, enableOpenUI),
      [messages, partMap, isStreaming, onOpenUIAction, enableOpenUI],
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
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md rounded-[var(--radius-xl)] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] px-6 py-8 text-center shadow-[var(--shadow-card)]">
                <div className="text-sm font-semibold text-foreground">Start the filing workflow</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Ask the agent to analyze documents, generate forms, explain a calculation, or review the current filing package.
                </div>
              </div>
            </div>
          ) : presentation === "timeline" ? (
            <AgentTimeline items={timeline.items} isThinking={timeline.showThinking} />
          ) : (
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
              <MessageList
                groups={groups}
                partMap={partMap}
                isCollapsed={isCollapsed}
                onToggleCollapse={toggleCollapse}
                branding={branding}
                renderToolDetail={renderToolDetail}
                renderRunActions={renderRunActions}
                renderUserMessageActions={renderUserMessageActions}
                renderToolActions={renderToolActions}
              />
            </div>
          )}
        </div>

        {/* Scroll-to-bottom button */}
        {!isAtBottom && (
          <div className="flex justify-center -mt-10 relative z-10">
            <button
              onClick={scrollToBottom}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                "border border-border bg-card shadow-[var(--shadow-card)]",
                "text-xs text-foreground transition-colors hover:bg-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
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
            className="shrink-0 border-t border-border bg-background"
          />
        )}
      </div>
    );
  },
);
ChatContainer.displayName = "ChatContainer";
