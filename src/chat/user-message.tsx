import { memo, type ReactNode } from "react";
import type { SessionMessage } from "../types/message";
import type { SessionPart } from "../types/parts";
import { Markdown } from "../markdown/markdown";

export interface UserMessageProps {
  message: SessionMessage;
  parts: SessionPart[];
  actions?: ReactNode;
}

/**
 * Simple user message bubble.
 * Renders text parts from the user's message.
 */
export const UserMessage = memo(({ message, parts, actions }: UserMessageProps) => {
  const textContent = parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");

  if (!textContent.trim()) return null;

  return (
    <div className="flex justify-end">
<<<<<<< HEAD
      <div className="flex max-w-[82%] flex-col items-end gap-2">
        <div className="w-full rounded-[var(--radius-xl)] rounded-br-[var(--radius-sm)] border border-border bg-muted/50 px-4 py-3.5">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            You
          </div>
          <div className="text-[15px] leading-7 text-foreground">
=======
      <div className="flex max-w-[70%] flex-col items-end gap-2">
        <div className="w-full rounded-[26px] rounded-tr-[12px] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3.5 shadow-[var(--shadow-card)]">
          <div className="text-[15px] leading-7 text-[var(--text-primary)]">
>>>>>>> 80e3a9a (fix: show tool command detail inline, not hidden on mobile (0.8.3))
            <Markdown className="tangle-prose">{textContent}</Markdown>
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs text-muted-foreground">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
});
UserMessage.displayName = "UserMessage";
