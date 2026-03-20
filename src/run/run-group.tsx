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
  bgClass: "bg-[var(--brand-cool)]/8",
  containerBgClass: "bg-[var(--bg-section)]/60",
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
    <div className="flex items-center gap-1.5">
      {sorted.map((cat) => {
        const Icon = CATEGORY_ICON_MAP[cat] ?? Settings;
        return (
          <span
            key={cat}
            title={cat}
            className="flex h-7 items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]"
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{cat}</span>
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
                "w-full rounded-[calc(var(--radius-xl)+2px)] border px-4 py-3.5 text-left transition-colors shadow-[var(--shadow-card)] backdrop-blur-sm",
                "bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%),var(--bg-card)] hover:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_30%),var(--bg-card)]",
                collapsed ? branding.borderClass : "border-[var(--border-subtle)]",
                branding.bgClass,
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[calc(var(--radius-lg)+2px)] border bg-[linear-gradient(135deg,rgba(82,164,255,0.22),rgba(82,164,255,0.06))] shadow-[var(--shadow-accent)]",
                    branding.borderClass,
                  )}
                >
                  <Bot className={cn("h-4 w-4", branding.accentClass)} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-sm font-semibold tracking-[0.01em]", branding.textClass)}>
                      {branding.label}
                    </span>
                    {isStreaming ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-accent)] bg-[linear-gradient(135deg,rgba(82,164,255,0.22),rgba(82,164,255,0.08))] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-cool)]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Running
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        <Sparkles className="h-3 w-3" />
                        Complete
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    {renderSummary(run) ? <span>{renderSummary(run)}</span> : null}
                    {collapsed && run.summaryText ? (
                      <span className="min-w-0 truncate text-[var(--text-secondary)]">
                        {run.summaryText}
                      </span>
                    ) : null}
                  </div>
                </div>

                <CategoryBadges categories={stats.toolCategories} />

                {!collapsed ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                )}
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
              "mt-2 space-y-3 rounded-[calc(var(--radius-xl)+2px)] border border-[var(--border-subtle)] p-3.5 shadow-[var(--shadow-card)]",
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
                    className="rounded-[calc(var(--radius-lg)+2px)] border border-[var(--border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%),var(--bg-card)] px-4 py-4"
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
