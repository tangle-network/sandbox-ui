import { type ReactNode } from "react";
import { Bot, User } from "lucide-react";
import { Markdown } from "@tangle-network/ui/markdown";
import { cn } from "@tangle-network/ui/utils";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessageProps {
  role: MessageRole;
  content: string;
  toolCalls?: ReactNode;
  isStreaming?: boolean;
  timestamp?: Date;
  className?: string;
  userLabel?: string;
  assistantLabel?: string;
  hideRoleLabel?: boolean;
  hideAvatar?: boolean;
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
      {!hideAvatar && (
        avatar ? (
          <div className="mt-0.5 shrink-0">{avatar}</div>
        ) : (
          <div
            className={cn(
              "mt-0.5 flex h-[var(--avatar-size,1.75rem)] w-[var(--avatar-size,1.75rem)] shrink-0 items-center justify-center rounded-[calc(var(--radius-md,0.625rem)+2px)] border border-border bg-muted text-[var(--brand-cool,hsl(var(--primary,252_55%_63%)))]",
              isUser &&
                "bg-[var(--accent-surface-soft,hsl(var(--accent,252_55%_63%)/0.08))] text-[var(--accent-text,hsl(var(--primary,252_55%_63%)))]",
            )}
            aria-hidden="true"
          >
            {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
          </div>
        )
      )}

      <div
        className={cn(
          "min-w-0 max-w-[85%] space-y-1 rounded-[var(--radius-lg,0.875rem)] border border-border bg-card px-[var(--chat-message-px,1rem)] py-[var(--chat-message-py,0.875rem)]",
          isUser && "bg-muted/50",
        )}
      >
        {!hideRoleLabel && (
          <div
            className={cn(
              "flex items-center gap-2 text-[length:var(--font-size-xs,0.75rem)] font-[var(--chat-label-weight,600)] tracking-[var(--chat-label-tracking,0.14em)] text-foreground uppercase",
              isUser && "flex-row-reverse",
            )}
          >
            <span>{isUser ? userLabel : assistantLabel}</span>
            {timestamp && <span className="text-muted-foreground">{formatTime(timestamp)}</span>}
          </div>
        )}

        {isUser ? (
          <div className="whitespace-pre-wrap text-[length:var(--font-size-base,1rem)] leading-[var(--line-height-base,1.5)] text-foreground">
            {content}
          </div>
        ) : (
          <>
            {content && (
              <Markdown className="tangle-prose text-[length:var(--font-size-base,1rem)] leading-[var(--line-height-base,1.5)]">
                {content}
              </Markdown>
            )}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-[var(--brand-cool,hsl(var(--primary,252_55%_63%)))] align-text-bottom" />
            )}
          </>
        )}

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
