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
              "mt-0.5 flex shrink-0 items-center justify-center rounded-[calc(var(--radius-md)+2px)] border",
              "h-[var(--avatar-size)] w-[var(--avatar-size)]",
              isUser
                ? "border-border bg-[var(--accent-surface-soft)] text-[var(--accent-text)]"
                : "border-border bg-muted text-[var(--brand-cool)]",
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
            <span className="text-[var(--font-size-xs)] font-[var(--chat-label-weight,600)] uppercase tracking-[var(--chat-label-tracking,0.14em)] text-foreground">
              {isUser ? userLabel : assistantLabel}
            </span>
            {timestamp && (
              <span className="text-[var(--font-size-xs)] text-muted-foreground">
                {formatTime(timestamp)}
              </span>
            )}
          </div>
        )}

        {/* Message body */}
        {isUser ? (
          <div className="whitespace-pre-wrap text-[var(--font-size-base)] leading-[var(--line-height-base)] text-foreground">
            {content}
          </div>
        ) : (
          <>
            {content && <Markdown className="tangle-prose text-[var(--font-size-base)] leading-[var(--line-height-base)]">{content}</Markdown>}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-[var(--brand-cool)] align-text-bottom" />
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
