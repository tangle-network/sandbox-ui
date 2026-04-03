import { memo, useMemo, type ComponentType, type ReactNode } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  Bot,
  Loader2,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileEdit,
  FileSearch,
  Search,
  PencilLine,
  Globe,
  ClipboardList,
  Settings,
  Sparkles,
  type LucideProps,
} from "lucide-react";
import { cn } from "../lib/utils";
import { formatDuration } from "../utils/format";
import type { Run, ToolCategory } from "../types/run";
import type { SessionPart, ToolPart, ReasoningPart } from "../types/parts";
import type { AgentBranding } from "../types/branding";
import type { CustomToolRenderer } from "../types/tool-display";
import { InlineToolItem } from "./inline-tool-item";
import { InlineThinkingItem } from "./inline-thinking-item";
import { Markdown } from "../markdown/markdown";

// ---------------------------------------------------------------------------
// Default branding
// ---------------------------------------------------------------------------

const DEFAULT_BRANDING: AgentBranding = {
  label: "Agent",
  accentClass: "text-primary",
  bgClass: "bg-[var(--accent-surface-soft)]",
  containerBgClass: "bg-muted",
  borderClass: "border-border",
  iconClass: "",
  textClass: "text-primary",
};

// ---------------------------------------------------------------------------
// Category icon mapping
// ---------------------------------------------------------------------------

const CATEGORY_ICON_MAP: Record<ToolCategory, ComponentType<LucideProps>> = {
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

const CATEGORY_ORDER: ToolCategory[] = [
  "command",
  "write",
  "edit",
  "read",
  "search",
  "web",
  "task",
  "todo",
  "other",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RunGroupProps {
  run: Run;
  partMap: Record<string, SessionPart[]>;
  collapsed: boolean;
  onToggle: () => void;
  branding?: AgentBranding;
  renderToolDetail?: CustomToolRenderer;
  headerActions?: ReactNode;
  renderToolActions?: (
    part: ToolPart,
    options: {
      run: Run;
      messageId: string;
      partIndex: number;
    },
  ) => ReactNode;
}

// ---------------------------------------------------------------------------
// Stat badges
// ---------------------------------------------------------------------------

function CategoryBadges({ categories }: { categories: Set<ToolCategory> }) {
  const sorted = useMemo(
    () => CATEGORY_ORDER.filter((category) => categories.has(category)),
    [categories],
  );
  if (sorted.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {sorted.map((cat) => {
        const Icon = CATEGORY_ICON_MAP[cat] ?? Settings;
        return (
          <span
            key={cat}
            title={cat}
            className="flex h-5 w-5 items-center justify-center rounded border border-border text-muted-foreground"
          >
            <Icon className="h-3 w-3" />
          </span>
        );
      })}
    </div>
  );
}

function renderSummary(run: Run) {
  const parts: string[] = [];

  if (run.stats.toolCount > 0) {
    parts.push(`${run.stats.toolCount} tool${run.stats.toolCount === 1 ? "" : "s"}`);
  }

  if (run.stats.textPartCount > 0) {
    parts.push(`${run.stats.textPartCount} response${run.stats.textPartCount === 1 ? "" : "s"}`);
  }

  if (run.stats.thinkingDurationMs > 0) {
    parts.push(`${formatDuration(run.stats.thinkingDurationMs)} thinking`);
  }

  return parts.join(", ");
}

function getToolGroupPosition(
  currentIndex: number,
  parts: Array<{ part: SessionPart; msgId: string; index: number }>,
) {
  const previous = parts[currentIndex - 1]?.part;
  const next = parts[currentIndex + 1]?.part;
  const previousIsTool = previous?.type === "tool";
  const nextIsTool = next?.type === "tool";

  if (previousIsTool && nextIsTool) return "middle" as const;
  if (previousIsTool) return "last" as const;
  if (nextIsTool) return "first" as const;
  return "single" as const;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Collapsible container for a consecutive group of assistant messages (a "run").
 * Shows a summary header with stats and renders tool/thinking/text parts.
 */
export const RunGroup = memo(
  ({
    run,
    partMap,
    collapsed,
    onToggle,
    branding = DEFAULT_BRANDING,
    renderToolDetail,
    headerActions,
    renderToolActions,
  }: RunGroupProps) => {
    // Flatten all parts from all messages in this run
    const allParts = useMemo(() => {
      const parts: Array<{
        part: SessionPart;
        msgId: string;
        index: number;
      }> = [];
      for (const msg of run.messages) {
        const msgParts = partMap[msg.id] ?? [];
        msgParts.forEach((part, index) => {
          parts.push({ part, msgId: msg.id, index });
        });
      }
      return parts;
    }, [run.messages, partMap]);

    const { stats, isStreaming } = run;
    const hasRenderableParts = allParts.some(({ part }) => {
      if (part.type === "tool" || part.type === "reasoning") {
        return true;
      }

      return part.type === "text" && !part.synthetic && part.text.trim().length > 0;
    });

    if (!hasRenderableParts) {
      return null;
    }

    return (
      <Collapsible.Root open={!collapsed} onOpenChange={() => onToggle()}>
        <div className="rounded-[var(--radius-xl)] border border-border bg-card shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-4">
          <Collapsible.Trigger asChild>
            <button
              className={cn(
                "w-full rounded-[20px] px-0 py-0 text-left transition-colors",
                "bg-transparent hover:bg-transparent",
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white",
                  )}
                >
                  <Bot className="h-4 w-4" />
                </div>

                <span className={cn("text-sm font-semibold", branding.textClass)}>
                  {branding.label}
                </span>

                {renderSummary(run) ? (
                  <span className="text-[11px] text-muted-foreground">{renderSummary(run)}</span>
                ) : null}
                {collapsed && run.summaryText ? (
                  <span className="min-w-0 truncate text-[11px] text-foreground/70">
                    {run.summaryText}
                  </span>
                ) : null}

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <CategoryBadges categories={stats.toolCategories} />

                  {isStreaming ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-accent)] bg-[var(--accent-surface-soft)] px-2 py-px text-[10px] font-semibold uppercase text-[var(--accent-text)]">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Running
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-px text-[10px] font-semibold uppercase text-muted-foreground">
                      <Sparkles className="h-2.5 w-2.5" />
                      Done
                    </span>
                  )}

                  {!collapsed ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>
          </Collapsible.Trigger>

          {headerActions ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-1">
              {headerActions}
            </div>
          ) : null}
        </div>

        {/* Summary text when collapsed */}
        {collapsed && run.summaryText && (
          <div className="px-4 pb-4 text-sm leading-6 text-muted-foreground line-clamp-2">
            {run.summaryText}
          </div>
        )}

        {/* Expanded content */}
        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
          <div
            className={cn(
              "space-y-3 border-t border-border px-4 pb-4 pt-3",
            )}
          >
            {allParts.map(({ part, msgId, index }, partIndex) => {
              const key = `${msgId}-${index}`;

              if (part.type === "tool") {
                return (
                  <InlineToolItem
                    key={key}
                    part={part as ToolPart}
                    renderToolDetail={renderToolDetail}
                    groupPosition={getToolGroupPosition(partIndex, allParts)}
                    actions={renderToolActions?.(part as ToolPart, {
                      run,
                      messageId: msgId,
                      partIndex: index,
                    })}
                  />
                );
              }

              if (part.type === "reasoning") {
                return (
                  <InlineThinkingItem
                    key={key}
                    part={part as ReasoningPart}
                    defaultOpen={isStreaming}
                  />
                );
              }

              if (
                part.type === "text" &&
                !part.synthetic &&
                part.text.trim()
              ) {
                return (
                  <div
                    key={key}
                    className="px-1 py-1"
                  >
                    <Markdown className="tangle-prose text-[15px] leading-7">{part.text}</Markdown>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </Collapsible.Content>
        </div>
      </Collapsible.Root>
    );
  },
);
RunGroup.displayName = "RunGroup";
