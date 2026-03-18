/**
 * ChatMessageList — scrolling conversation container.
 *
 * Auto-scrolls to bottom on new messages (unless user has scrolled up).
 * Renders messages with an optional render prop for custom content per message.
 */

import { useRef, useEffect, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { ChatMessage, type MessageRole } from "./chat-message";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ReactNode;
  isStreaming?: boolean;
  timestamp?: Date;
}

export interface ChatMessageListProps {
  messages: Message[];
  /** Render additional content after a message (e.g., tool call feed) */
  renderAfter?: (message: Message, index: number) => ReactNode;
  /** Content shown when no messages */
  emptyState?: ReactNode;
  /** Show thinking indicator at bottom */
  isThinking?: boolean;
  className?: string;
}

export function ChatMessageList({
  messages,
  renderAfter,
  emptyState,
  isThinking,
  className,
}: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Track if user is near bottom
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsNearBottom(nearBottom);
  };

  // Auto-scroll when new content arrives (only if user hasn't scrolled up)
  useEffect(() => {
    if (isNearBottom) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, isNearBottom]);

  if (messages.length === 0 && emptyState) {
    return (
      <div className={cn("flex-1 flex items-center justify-center p-8", className)}>
        {emptyState}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn("flex-1 overflow-y-auto", className)}
    >
      <div className="max-w-3xl mx-auto py-4">
        {messages.map((msg, i) => (
          <div key={msg.id}>
            <ChatMessage
              role={msg.role}
              content={msg.content}
              toolCalls={msg.toolCalls}
              isStreaming={msg.isStreaming}
              timestamp={msg.timestamp}
            />
            {renderAfter?.(msg, i)}
          </div>
        ))}

        {/* Thinking indicator */}
        {isThinking && <ThinkingIndicator />}

        <div ref={endRef} />
      </div>
    </div>
  );
}

// --- Thinking Indicator ---

export function ThinkingIndicator({ className }: { className?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("flex gap-3 px-4 py-3", className)}>
      <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5 bg-[var(--brand-glow)]/15 text-[var(--brand-glow)]">
        <div className="flex gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--text-muted)]">
          {elapsed < 10 ? "Thinking..." : elapsed < 60 ? "Thinking deeply..." : "Still working..."}
        </span>
        {elapsed > 5 && (
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {elapsed}s
          </span>
        )}
      </div>
    </div>
  );
}
