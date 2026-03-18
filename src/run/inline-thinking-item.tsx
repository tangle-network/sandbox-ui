import { memo, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { formatDuration, truncateText } from "../utils/format";
import type { ReasoningPart } from "../types/parts";
import { Markdown } from "../markdown/markdown";
import { LiveDuration } from "./run-item-primitives";

export interface InlineThinkingItemProps {
  part: ReasoningPart;
}

/**
 * Minimal collapsible display for thinking/reasoning parts.
 * Shows "Thinking..." with optional preview text and duration.
 */
export const InlineThinkingItem = memo(({ part }: InlineThinkingItemProps) => {
  const [open, setOpen] = useState(false);

  const startTime = part.time?.start;
  const endTime = part.time?.end;
  const durationMs =
    startTime && endTime ? endTime - startTime : undefined;
  const isActive = startTime != null && endTime == null;
  const preview = part.text ? truncateText(part.text, 100) : undefined;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 text-left",
            "rounded-md transition-colors text-xs",
            "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60",
            open && "bg-neutral-100/40 dark:bg-neutral-800/40",
          )}
        >
          <Brain
            className={cn(
              "w-4 h-4 shrink-0",
              isActive
                ? "text-purple-500 dark:text-purple-400 animate-pulse"
                : "text-neutral-400 dark:text-neutral-400",
            )}
          />

          <span className="font-medium text-neutral-800 dark:text-neutral-200 shrink-0">
            {isActive ? "Thinking..." : "Thought"}
          </span>

          {preview && !open && (
            <span className="text-neutral-400 dark:text-neutral-500 truncate flex-1">
              {preview}
            </span>
          )}
          {!preview && <span className="flex-1" />}

          {isActive && startTime && <LiveDuration startTime={startTime} />}
          {!isActive && durationMs != null && (
            <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 tabular-nums">
              {formatDuration(durationMs)}
            </span>
          )}

          {open ? (
            <ChevronDown className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
          )}
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
        {part.text && (
          <div className="ml-6 mt-1 mb-2 p-3 rounded-md bg-neutral-100/40 dark:bg-neutral-800/40 text-xs text-neutral-600 dark:text-neutral-300">
            <Markdown>{part.text}</Markdown>
          </div>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
});
InlineThinkingItem.displayName = "InlineThinkingItem";
