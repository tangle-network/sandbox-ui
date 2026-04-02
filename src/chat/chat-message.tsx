/**
 * ChatMessage — single message bubble in the conversation.
 *
 * Supports user messages (plain text) and assistant messages
 * (rich markdown with inline tool call activity).
 */

import { type ReactNode } from "react";
import { User, Bot } from "lucide-react";
import { cn } from "../lib/utils";
import { Markdown } from "../markdown/markdown";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessageProps {
  role: MessageRole;
  content: string;
  /** Inline tool call activity rendered between text chunks */
  toolCalls?: ReactNode;
  /** Whether the message is still streaming */
  isStreaming?: boolean;
  /** Timestamp */
  timestamp?: Date;
  className?: string;
  /** Custom user label. Default: "You" */
  userLabel?: string;
  /** Custom assistant label. Default: "Agent" */
  assistantLabel?: string;
  /** Hide the role label row entirely */
  hideRoleLabel?: boolean;
  /** Hide the avatar icon */
  hideAvatar?: boolean;
  /** Custom avatar element (replaces default User/Bot icon) */
  avatar?: ReactNode;
}

export function ChatMessage({
  role,
  content,
  toolCalls,
  isStreaming,
  timestamp,
  className,
  userLabel = "You",
  assistantLabel = "Agent",
  hideRoleLabel,
  hideAvatar,
  avatar,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {/* Avatar */}
      {!hideAvatar && (
        avatar ? (
          <div className="mt-0.5 shrink-0">{avatar}</div>
        ) : (
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-md)+2px)] border",
              isUser
                ? "border-border bg-[var(--accent-surface-soft)] text-[var(--accent-text)]"
                : "border-border bg-muted text-primary",
            )}
          >
            {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
          </div>
        )
      )}

      {/* Bubble */}
      <div
        className={cn(
          "min-w-0 max-w-[85%] space-y-1 rounded-[var(--radius-lg)] border",
          "px-[var(--chat-message-px)] py-[var(--chat-message-py)]",
          isUser
            ? "border-border bg-muted/50"
            : "border-border bg-card",
        )}
      >
        {/* Role label + timestamp */}
        {!hideRoleLabel && (
          <div className={cn("flex items-center gap-2", isUser && "flex-row-reverse")}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
              {isUser ? userLabel : assistantLabel}
            </span>
            {timestamp && (
              <span className="text-[11px] text-muted-foreground">
                {formatTime(timestamp)}
              </span>
            )}
          </div>
        )}

        {/* Message body */}
        {isUser ? (
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
            {content}
          </div>
        ) : (
          <>
            {content && <Markdown className="tangle-prose text-[15px] leading-7">{content}</Markdown>}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-primary align-text-bottom" />
            )}
          </>
        )}

        {/* Inline tool calls (left-aligned below agent text) */}
        {toolCalls}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
