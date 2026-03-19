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
}

export function ChatMessage({
  role,
  content,
  toolCalls,
  isStreaming,
  timestamp,
  className,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-3", className)}>
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5",
          isUser
            ? "bg-[var(--brand-cool)]/15 text-[var(--brand-cool)]"
            : "bg-[var(--brand-glow)]/15 text-[var(--brand-glow)]",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Role label + timestamp */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {isUser ? "You" : "Agent"}
          </span>
          {timestamp && (
            <span className="text-xs text-[var(--text-muted)]">
              {formatTime(timestamp)}
            </span>
          )}
        </div>

        {/* Message body */}
        {isUser ? (
          <div className="text-[var(--text-primary)] text-sm whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        ) : (
          <>
            {content && <Markdown>{content}</Markdown>}
            {/* Streaming cursor */}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-[var(--brand-cool)] animate-pulse rounded-sm ml-0.5 align-text-bottom" />
            )}
          </>
        )}

        {/* Inline tool calls (rendered between text sections) */}
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
