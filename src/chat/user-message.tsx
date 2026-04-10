import { memo, type ReactNode } from "react";
import type { SessionMessage } from "../types/message";
import type { SessionPart } from "../types/parts";

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
      <div className="flex max-w-[78%] flex-col items-end gap-2">
        <div className="w-full rounded-[26px] rounded-br-[12px] bg-[var(--brand-primary)] px-4 py-3 text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
            You
          </div>
          <div className="whitespace-pre-wrap text-[15px] leading-6.5 text-white">
            {textContent}
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
