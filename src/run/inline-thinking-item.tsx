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
              "w-full rounded-[var(--radius-lg)] border text-left transition-colors",
              isActive
                ? "border-primary/30 bg-primary/10"
                : "border-border bg-muted hover:bg-accent",
              open && !isActive && "bg-accent",
              className,
            )}
          >
            <div className="flex items-center gap-2.5 px-3 py-2">
              <Brain className={cn("h-4 w-4 shrink-0", isActive ? "text-primary animate-pulse" : "text-muted-foreground")} />

              <div className="min-w-0 flex-1">
                <span className="truncate text-xs text-foreground">
                  {preview ?? (isActive ? "Thinking…" : "Reasoning")}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
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

        <Collapsible.Content className="overflow-hidden rounded-b-[var(--radius-lg)] data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
          {part.text ? (
            <div
              className={cn(
                "max-h-60 overflow-y-auto border-t border-border bg-card px-3 py-3 text-sm leading-relaxed text-foreground",
                contentClassName,
              )}
            >
              <Markdown>{part.text}</Markdown>
            </div>
          ) : (
            <div className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
              No reasoning text provided.
            </div>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
    );
  },
);
InlineThinkingItem.displayName = "InlineThinkingItem";
