import { memo, useEffect, useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Brain, ChevronRight } from "lucide-react";
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
        <div
          className={cn(
            "overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--bg-card)] transition-colors",
            isActive
              ? "border-[var(--border-accent)]"
              : "border-[var(--border-subtle)] hover:border-[var(--border-accent)]",
            className,
          )}
        >
          <Collapsible.Trigger asChild>
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm cursor-pointer"
            >
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
                  isActive
                    ? "border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-[var(--brand-cool)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-section)] text-[var(--text-muted)]",
                )}
              >
                <Brain className={cn("h-3 w-3 shrink-0", isActive && "animate-pulse")} />
              </div>

              <p className="min-w-0 flex-1 truncate font-[var(--font-sans)] text-[var(--text-secondary)]">
                {preview ?? (isActive ? "Thinking…" : "Reasoning")}
              </p>

              <div className="flex shrink-0 items-center gap-2">
                {isActive && startTime ? <LiveDuration startTime={startTime} /> : null}
                {!isActive && durationMs != null ? (
                  <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                    {formatDuration(durationMs)}
                  </span>
                ) : null}
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-[var(--text-muted)] transition-transform shrink-0",
                    open && "rotate-90",
                  )}
                />
              </div>
            </button>
          </Collapsible.Trigger>

          <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
            {part.text ? (
              <div
                className={cn(
                  "max-h-60 overflow-y-auto border-t border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-3 text-sm leading-relaxed text-[var(--text-muted)]",
                  contentClassName,
                )}
              >
                <Markdown>{part.text}</Markdown>
              </div>
            ) : (
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-2.5 text-xs text-[var(--text-muted)]">
                No reasoning text provided.
              </div>
            )}
          </Collapsible.Content>
        </div>
      </Collapsible.Root>
    );
  },
);
InlineThinkingItem.displayName = "InlineThinkingItem";
