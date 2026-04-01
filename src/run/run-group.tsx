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
  accentClass: "text-[var(--brand-cool)]",
  bgClass: "bg-[var(--accent-surface-soft)]",
  containerBgClass: "bg-[var(--bg-section)]",
  borderClass: "border-[var(--border-accent)]",
  iconClass: "",
  textClass: "text-[var(--brand-cool)]",
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
            className="flex h-5 w-5 items-center justify-center rounded border border-[var(--border-subtle)] text-[var(--text-muted)]"
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
        {/* Header */}
        <div className="flex items-start gap-3">
          <Collapsible.Trigger asChild>
            <button
              className={cn(
                "w-full rounded-[var(--radius-lg)] border px-3 py-2 text-left transition-colors",
                "bg-[var(--depth-2)] hover:bg-[var(--depth-3)]",
                collapsed ? branding.borderClass : "border-[var(--border-subtle)]",
                branding.bgClass,
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border bg-[var(--accent-surface-soft)]",
                    branding.borderClass,
                  )}
                >
                  <Bot className={cn("h-3.5 w-3.5", branding.accentClass)} />
                </div>

                <span className={cn("text-xs font-semibold", branding.textClass)}>
                  {branding.label}
                </span>

                {renderSummary(run) ? (
                  <span className="text-[11px] text-[var(--text-muted)]">{renderSummary(run)}</span>
                ) : null}
                {collapsed && run.summaryText ? (
                  <span className="min-w-0 truncate text-[11px] text-[var(--text-secondary)]">
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
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-2 py-px text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                      <Sparkles className="h-2.5 w-2.5" />
                      Done
                    </span>
                  )}

                  {!collapsed ? (
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
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
          <div className="px-4 py-2 text-sm leading-6 text-[var(--text-muted)] line-clamp-2">
            {run.summaryText}
          </div>
        )}

        {/* Expanded content */}
        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
          <div
            className={cn(
              "mt-1.5 space-y-1.5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-2 shadow-[var(--shadow-card)]",
              branding.containerBgClass,
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
                    className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2.5"
                  >
                    <Markdown>{part.text}</Markdown>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    );
  },
);
RunGroup.displayName = "RunGroup";
