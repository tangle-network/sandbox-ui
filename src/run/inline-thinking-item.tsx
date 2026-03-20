import { memo, useEffect, useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { formatDuration, truncateText } from "../utils/format";
import type { ReasoningPart } from "../types/parts";
import { Markdown } from "../markdown/markdown";
import { LiveDuration } from "./run-item-primitives";

export interface InlineThinkingItemProps {
  part: ReasoningPart;
  defaultOpen?: boolean;
  autoCollapse?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * Minimal collapsible display for thinking/reasoning parts.
 * Shows "Thinking..." with optional preview text and duration.
 */
export const InlineThinkingItem = memo(
  ({
    part,
    defaultOpen = false,
    autoCollapse = true,
    className,
    contentClassName,
  }: InlineThinkingItemProps) => {
    const [open, setOpen] = useState(defaultOpen);
    const autoCollapsedRef = useRef(false);

    const startTime = part.time?.start;
    const endTime = part.time?.end;
    const durationMs = startTime && endTime ? endTime - startTime : undefined;
    const isActive = startTime != null && endTime == null;
    const preview = part.text ? truncateText(part.text, 120) : undefined;

    useEffect(() => {
      if (isActive) {
        autoCollapsedRef.current = false;
        setOpen(true);
        return;
      }

      if (autoCollapse && !autoCollapsedRef.current && durationMs != null) {
        const timer = window.setTimeout(() => {
          setOpen(false);
          autoCollapsedRef.current = true;
        }, 900);

        return () => window.clearTimeout(timer);
      }
    }, [autoCollapse, durationMs, isActive]);

    return (
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger asChild>
          <button
            className={cn(
              "w-full rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] text-left transition-colors",
              "hover:border-[var(--border-accent-hover)] hover:bg-[var(--bg-hover)]/35",
              open && "border-[var(--border-accent)] bg-[var(--bg-hover)]/30",
              className,
            )}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border",
                  isActive
                    ? "border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-[var(--accent-text)] shadow-[var(--shadow-glow)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-section)] text-[var(--text-muted)]",
                )}
              >
                <Brain className={cn("h-4 w-4", isActive && "animate-pulse")} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {isActive ? "Thinking…" : "Reasoning"}
                  </span>
                  {!isActive && durationMs != null ? (
                    <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-section)] px-2 py-0.5 text-[11px] font-[var(--font-mono)] text-[var(--text-muted)]">
                      {formatDuration(durationMs)}
                    </span>
                  ) : null}
                  {isActive && startTime ? <LiveDuration startTime={startTime} /> : null}
                </div>
                {preview && !open ? (
                  <div className="mt-1 truncate text-xs text-[var(--text-muted)]">
                    {preview}
                  </div>
                ) : null}
              </div>

              {open ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              )}
            </div>
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
          {part.text ? (
            <div
              className={cn(
                "border-t border-[var(--border-subtle)] px-4 py-4 text-sm text-[var(--text-secondary)]",
                contentClassName,
              )}
            >
              <Markdown>{part.text}</Markdown>
            </div>
          ) : (
            <div className="border-t border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-muted)]">
              No reasoning text was provided.
            </div>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
    );
  },
);
InlineThinkingItem.displayName = "InlineThinkingItem";
