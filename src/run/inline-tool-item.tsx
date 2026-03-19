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
  groupPosition?: "single" | "first" | "middle" | "last";
  className?: string;
  contentClassName?: string;
}

/**
 * Compact single-line tool call display (32px height).
 * Shows icon, title, description, duration, and status indicator.
 * Expands on click to show ExpandedToolDetail.
 */
export const InlineToolItem = memo(
  ({
    part,
    renderToolDetail,
    groupPosition = "single",
    className,
    contentClassName,
  }: InlineToolItemProps) => {
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
    const shapeClass = {
      single: "rounded-[var(--radius-lg)]",
      first: "rounded-t-[var(--radius-lg)] rounded-b-[var(--radius-sm)]",
      middle: "rounded-[var(--radius-sm)]",
      last: "rounded-t-[var(--radius-sm)] rounded-b-[var(--radius-lg)]",
    }[groupPosition];

    return (
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger asChild>
          <button
            className={cn(
              "w-full border text-left transition-colors",
              "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-accent-hover)] hover:bg-[var(--bg-hover)]/35",
              open && "border-[var(--border-accent)] bg-[var(--bg-hover)]/30",
              shapeClass,
              className,
            )}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border",
                  isRunning &&
                    "border-[var(--border-accent)] bg-[var(--brand-cool)]/12 text-[var(--brand-cool)]",
                  isComplete &&
                    "border-emerald-500/30 bg-emerald-500/12 text-emerald-200",
                  isError && "border-red-500/30 bg-red-500/10 text-red-200",
                  !isRunning &&
                    !isComplete &&
                    !isError &&
                    "border-[var(--border-subtle)] bg-[var(--bg-section)] text-[var(--text-muted)]",
                )}
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isComplete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isError ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <DefaultIcon className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {meta.title}
                  </span>
                  {isError ? (
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-red-200">
                      Failed
                    </span>
                  ) : null}
                  {isRunning ? (
                    <span className="rounded-full border border-[var(--border-accent)] bg-[var(--brand-cool)]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--brand-cool)]">
                      Running
                    </span>
                  ) : null}
                </div>
                {meta.description ? (
                  <div className="mt-1 truncate text-xs font-[var(--font-mono)] text-[var(--text-muted)]">
                    {meta.description}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {isRunning && startTime ? <LiveDuration startTime={startTime} /> : null}
                {!isRunning && durationMs != null ? (
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-section)] px-2 py-0.5 text-[11px] font-[var(--font-mono)] text-[var(--text-muted)]">
                    {formatDuration(durationMs)}
                  </span>
                ) : null}

                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                )}
              </div>
            </div>

            {errorText && !open ? (
              <div className="border-t border-[var(--border-subtle)] px-3 py-2 text-xs text-red-200">
                {errorText}
              </div>
            ) : null}
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
          <div className={cn("mt-2 pl-4", contentClassName)}>
            {renderToolDetail?.(part) ?? <ExpandedToolDetail part={part} />}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    );
  },
);
InlineToolItem.displayName = "InlineToolItem";
