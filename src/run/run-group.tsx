import { memo, useMemo, type ComponentType } from "react";
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
  accentClass: "text-blue-500 dark:text-blue-400",
  bgClass: "bg-blue-500/5 dark:bg-blue-500/10",
  containerBgClass: "bg-neutral-50/40 dark:bg-neutral-900/40",
  borderClass: "border-blue-500/15 dark:border-blue-500/20",
  iconClass: "",
  textClass: "text-blue-500 dark:text-blue-400",
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
}

// ---------------------------------------------------------------------------
// Stat badges
// ---------------------------------------------------------------------------

function CategoryBadges({ categories }: { categories: Set<ToolCategory> }) {
  const sorted = useMemo(() => Array.from(categories).sort(), [categories]);
  if (sorted.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {sorted.map((cat) => {
        const Icon = CATEGORY_ICON_MAP[cat] ?? Settings;
        return (
          <span key={cat} title={cat}>
            <Icon className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
          </span>
        );
      })}
    </div>
  );
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

    return (
      <Collapsible.Root open={!collapsed} onOpenChange={() => onToggle()}>
        {/* Header */}
        <Collapsible.Trigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-left",
              "rounded-lg transition-colors",
              "hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60",
              branding.bgClass,
              collapsed &&
                branding.borderClass &&
                `border ${branding.borderClass}`,
              !collapsed && "border border-transparent",
            )}
          >
            {/* Agent icon */}
            <Bot
              className={cn("w-4 h-4 shrink-0", branding.accentClass)}
            />

            {/* Label */}
            <span
              className={cn("text-xs font-medium shrink-0", branding.textClass)}
            >
              {branding.label}
            </span>

            {/* Stats */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {stats.toolCount > 0 && (
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {stats.toolCount} tool{stats.toolCount !== 1 ? "s" : ""}
                </span>
              )}
              {stats.thinkingDurationMs > 0 && (
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {formatDuration(stats.thinkingDurationMs)} thinking
                </span>
              )}
              <CategoryBadges categories={stats.toolCategories} />
            </div>

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 text-blue-500 dark:text-blue-400 animate-spin" />
                <span className="text-xs text-blue-500 dark:text-blue-400">
                  Running
                </span>
              </div>
            )}

            {/* Collapse caret */}
            {!collapsed ? (
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
            )}
          </button>
        </Collapsible.Trigger>

        {/* Summary text when collapsed */}
        {collapsed && run.summaryText && (
          <div className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
            {run.summaryText}
          </div>
        )}

        {/* Expanded content */}
        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
          <div
            className={cn(
              "mt-1 space-y-0.5 rounded-lg p-2",
              branding.containerBgClass,
            )}
          >
            {allParts.map(({ part, msgId, index }) => {
              const key = `${msgId}-${index}`;

              if (part.type === "tool") {
                return (
                  <InlineToolItem
                    key={key}
                    part={part as ToolPart}
                    renderToolDetail={renderToolDetail}
                  />
                );
              }

              if (part.type === "reasoning") {
                return (
                  <InlineThinkingItem
                    key={key}
                    part={part as ReasoningPart}
                  />
                );
              }

              if (
                part.type === "text" &&
                !part.synthetic &&
                part.text.trim()
              ) {
                return (
                  <div key={key} className="px-3 py-2">
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
