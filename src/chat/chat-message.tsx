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
    <div
      className={cn(
        "flex gap-4 rounded-[calc(var(--radius-xl)+2px)] border px-4 py-4 shadow-[var(--shadow-card)] backdrop-blur-sm",
        isUser
          ? "border-[var(--border-accent)] bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.18),transparent_42%),linear-gradient(135deg,rgba(98,114,243,0.18),rgba(98,114,243,0.06)_55%,rgba(255,255,255,0.02))]"
          : "border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_32%),var(--bg-card)]",
        className,
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[calc(var(--radius-md)+2px)] border shadow-[var(--shadow-accent)]",
          isUser
            ? "border-[var(--border-accent)] bg-[linear-gradient(135deg,rgba(82,164,255,0.24),rgba(82,164,255,0.08))] text-[var(--brand-cool)]"
            : "border-[var(--border-subtle)] bg-[linear-gradient(135deg,rgba(77,203,255,0.24),rgba(77,203,255,0.08))] text-[var(--brand-glow)]",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Role label + timestamp */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {isUser ? "You" : "Agent"}
          </span>
          {timestamp && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {formatTime(timestamp)}
            </span>
          )}
        </div>

        {/* Message body */}
        {isUser ? (
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-[var(--text-primary)]">
            {content}
          </div>
        ) : (
          <>
            {content && <Markdown className="tangle-prose text-[15px] leading-7">{content}</Markdown>}
            {/* Streaming cursor */}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-[var(--brand-cool)] align-text-bottom" />
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
