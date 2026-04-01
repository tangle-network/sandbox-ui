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
    const preview = part.text ? truncateText(part.text, 80) : undefined;

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
              "w-full rounded-[var(--radius-lg)] border text-left transition-colors",
              "border-border bg-card hover:bg-accent/50",
              open && "border-primary/30 bg-accent/30",
              className,
            )}
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <Brain className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary animate-pulse" : "text-muted-foreground")} />

              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {preview ?? (isActive ? "…" : "Reasoning")}
              </span>

              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {isActive && startTime ? <LiveDuration startTime={startTime} /> : null}
                {!isActive && durationMs != null ? (
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                    {formatDuration(durationMs)}
                  </span>
                ) : null}
                {open ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
          {part.text ? (
            <div
              className={cn(
                "border-t border-border px-3 py-2.5 text-sm text-foreground",
                contentClassName,
              )}
            >
              <Markdown>{part.text}</Markdown>
            </div>
          ) : (
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              No reasoning text provided.
            </div>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
    );
  },
);
InlineThinkingItem.displayName = "InlineThinkingItem";
