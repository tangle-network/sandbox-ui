import { memo, useState, type ComponentType } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileEdit,
  FileSearch,
  Search,
  PencilLine,
  Bot,
  Globe,
  ClipboardList,
  Settings,
  type LucideProps,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  getToolDisplayMetadata,
  getToolErrorText,
  getToolCategory,
} from "../utils/tool-display";
import { formatDuration } from "../utils/format";
import type { ToolPart } from "../types/parts";
import type { ToolCategory } from "../types/run";
import type { CustomToolRenderer } from "../types/tool-display";
import { ExpandedToolDetail } from "./expanded-tool-detail";
import { LiveDuration } from "./run-item-primitives";

/** Map tool category to a lucide-react icon component. */
const TOOL_CATEGORY_ICON_MAP: Record<
  ToolCategory,
  ComponentType<LucideProps>
> = {
  command: Terminal,
  write: FileEdit,
  read: FileSearch,
  search: Search,
  edit: PencilLine,
  task: Bot,
  web: Globe,
  todo: ClipboardList,
  other: Settings,
};

export interface InlineToolItemProps {
  part: ToolPart;
  renderToolDetail?: CustomToolRenderer;
}

/**
 * Compact single-line tool call display (32px height).
 * Shows icon, title, description, duration, and status indicator.
 * Expands on click to show ExpandedToolDetail.
 */
export const InlineToolItem = memo(
  ({ part, renderToolDetail }: InlineToolItemProps) => {
    const [open, setOpen] = useState(false);
    const meta = getToolDisplayMetadata(part);
    const { status } = part.state;
    const errorText = getToolErrorText(part);

    const isRunning = status === "pending" || status === "running";
    const isError = status === "error";
    const isComplete = status === "completed";

    // Duration
    const startTime = part.state.time?.start;
    const endTime = part.state.time?.end;
    const durationMs =
      startTime && endTime ? endTime - startTime : undefined;

    // Determine the default icon based on tool category
    const category = getToolCategory(part.tool);
    const DefaultIcon = TOOL_CATEGORY_ICON_MAP[category] ?? Settings;

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
            {/* Status / Icon */}
            {isRunning ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-500 dark:text-blue-400" />
            ) : isComplete ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500 dark:text-green-400" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
            ) : (
              <DefaultIcon className="w-4 h-4 shrink-0 text-neutral-400 dark:text-neutral-400" />
            )}

            {/* Title + description */}
            <span className="font-medium text-neutral-800 dark:text-neutral-200 shrink-0">
              {meta.title}
            </span>
            {meta.description && (
              <span className="text-neutral-400 dark:text-neutral-500 truncate flex-1 font-mono">
                {meta.description}
              </span>
            )}
            {!meta.description && <span className="flex-1" />}

            {/* Duration or streaming timer */}
            {isRunning && startTime && (
              <LiveDuration startTime={startTime} />
            )}
            {!isRunning && durationMs != null && (
              <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 tabular-nums">
                {formatDuration(durationMs)}
              </span>
            )}

            {/* Error indicator */}
            {errorText && (
              <span className="text-xs text-red-500 dark:text-red-400 truncate max-w-32">
                {errorText}
              </span>
            )}

            {/* Caret */}
            {open ? (
              <ChevronDown className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
            )}
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
          <div className="ml-6 mt-1 mb-2">
            {renderToolDetail?.(part) ?? <ExpandedToolDetail part={part} />}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    );
  },
);
InlineToolItem.displayName = "InlineToolItem";
