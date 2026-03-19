import { memo } from "react";
import type { SessionMessage } from "../types/message";
import type { SessionPart } from "../types/parts";
import { Markdown } from "../markdown/markdown";

export interface UserMessageProps {
  message: SessionMessage;
  parts: SessionPart[];
}

/**
 * Simple user message bubble.
 * Renders text parts from the user's message.
 */
export const UserMessage = memo(({ message, parts }: UserMessageProps) => {
  const textContent = parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");

  if (!textContent.trim()) return null;

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[var(--radius-xl)] rounded-br-[var(--radius-sm)] border border-[var(--border-accent)] bg-[linear-gradient(135deg,rgba(98,114,243,0.16),rgba(98,114,243,0.06))] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-cool)]">
          You
        </div>
        <div className="text-sm text-[var(--text-primary)]">
          <Markdown>{textContent}</Markdown>
        </div>
      </div>
    </div>
  );
});
UserMessage.displayName = "UserMessage";
