import { type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  FileText,
  Info,
} from "lucide-react";
import { cn } from "../lib/utils";
import { type MessageRole } from "./chat-message";
import { Markdown } from "../markdown/markdown";
import { ThinkingIndicator } from "./thinking-indicator";
import { type ToolCallData } from "../run/tool-call-feed";
import { ToolCallGroup, ToolCallStep } from "../run/tool-call-step";

export type AgentTimelineTone = "default" | "info" | "success" | "warning" | "error";

export interface AgentTimelineMessageItem {
  id: string;
  kind: "message";
  role: MessageRole;
  content: string;
  toolCalls?: ReactNode;
  isStreaming?: boolean;
  timestamp?: Date;
  after?: ReactNode;
}

export interface AgentTimelineToolItem {
  id: string;
  kind: "tool";
  call: ToolCallData;
}

export interface AgentTimelineToolGroupItem {
  id: string;
  kind: "tool_group";
  title?: string;
  calls: ToolCallData[];
}

export interface AgentTimelineStatusItem {
  id: string;
  kind: "status";
  label: string;
  detail?: string;
  tone?: AgentTimelineTone;
}

export interface AgentTimelineArtifactItem {
  id: string;
  kind: "artifact";
  title: string;
  description?: string;
  meta?: ReactNode;
  icon?: ReactNode;
  tone?: AgentTimelineTone;
  action?: ReactNode;
  onClick?: () => void;
}

export interface AgentTimelineCustomItem {
  id: string;
  kind: "custom";
  content: ReactNode;
}

export type AgentTimelineItem =
  | AgentTimelineMessageItem
  | AgentTimelineToolItem
  | AgentTimelineToolGroupItem
  | AgentTimelineStatusItem
  | AgentTimelineArtifactItem
  | AgentTimelineCustomItem;

export interface AgentTimelineProps {
  items: AgentTimelineItem[];
  isThinking?: boolean;
  emptyState?: ReactNode;
  className?: string;
}

const TONE_STYLES: Record<AgentTimelineTone, { dot: string; card: string; text: string; icon: typeof Info }> = {
  default: {
    dot: "bg-[var(--border-hover)]",
    card: "border-border bg-card",
    text: "text-foreground",
    icon: CircleDot,
  },
  info: {
    dot: "bg-[var(--surface-info-text)]",
    card: "border-[var(--surface-info-border)] bg-[var(--surface-info-bg)]",
    text: "text-[var(--surface-info-text)]",
    icon: Info,
  },
  success: {
    dot: "bg-[var(--surface-success-text)]",
    card: "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)]",
    text: "text-[var(--surface-success-text)]",
    icon: CheckCircle2,
  },
  warning: {
    dot: "bg-[var(--surface-warning-text)]",
    card: "border-[var(--surface-warning-border)] bg-[var(--surface-warning-bg)]",
    text: "text-[var(--surface-warning-text)]",
    icon: AlertTriangle,
  },
  error: {
    dot: "bg-[var(--surface-danger-text)]",
    card: "border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)]",
    text: "text-[var(--surface-danger-text)]",
    icon: AlertTriangle,
  },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

interface AgentTimelineRowProps {
  isLast: boolean;
  accentClassName: string;
  children: ReactNode;
}

function AgentTimelineRow({ isLast, accentClassName, children }: AgentTimelineRowProps) {
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4">
      <div className="relative flex justify-center">
        {!isLast && (
          <span className="absolute top-4 bottom-[-0.75rem] left-1/2 w-px -translate-x-1/2 bg-border" />
        )}
        <span className={cn("relative mt-2 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--bg-root)]", accentClassName)} />
      </div>
      <div className="min-w-0 pb-3">{children}</div>
    </div>
  );
}

function UserMessage({ item }: { item: AgentTimelineMessageItem }) {
  return (
<<<<<<< HEAD
    <div className="mb-3 flex justify-end">
      <div className="max-w-[72%]">
        <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
=======
    <div className="mb-4 flex justify-end">
      <div className="max-w-[70%]">
        <div className="rounded-[26px] rounded-tr-[12px] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3.5 shadow-[var(--shadow-card)]">
>>>>>>> 80e3a9a (fix: show tool command detail inline, not hidden on mobile (0.8.3))
          {item.timestamp && (
            <div className="mb-1.5 text-right text-[11px] text-muted-foreground">
              {formatTime(item.timestamp)}
            </div>
          )}
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
            {item.content}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ item }: { item: AgentTimelineMessageItem }) {
  return (
<<<<<<< HEAD
    <div className="-mt-0.5">
      {item.timestamp && (
        <div className="mb-2 text-[11px] text-muted-foreground">
          {formatTime(item.timestamp)}
        </div>
      )}
      {item.content && (
        <Markdown className="tangle-prose text-[15px] leading-7">{item.content}</Markdown>
      )}
      {item.isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-primary align-text-bottom" />
      )}
      {item.toolCalls && <div className="mt-3">{item.toolCalls}</div>}
      {item.after && (
        <div className="mt-3 border-t border-border pt-3">
          {item.after}
        </div>
      )}
=======
    <div className="-mt-0.5 max-w-[min(100%,52rem)]">
      <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4 shadow-[var(--shadow-card)]">
        {item.timestamp && (
          <div className="mb-2 text-[11px] text-[var(--text-muted)]">
            {formatTime(item.timestamp)}
          </div>
        )}
        {item.content && (
          <Markdown className="tangle-prose text-[15px] leading-7 text-[var(--text-primary)]">
            {item.content}
          </Markdown>
        )}
        {item.isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-[var(--brand-cool)] align-text-bottom" />
        )}
        {item.toolCalls && <div className="mt-3">{item.toolCalls}</div>}
        {item.after && (
          <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
            {item.after}
          </div>
        )}
      </div>
>>>>>>> 80e3a9a (fix: show tool command detail inline, not hidden on mobile (0.8.3))
    </div>
  );
}

function StatusCard({ item }: { item: AgentTimelineStatusItem }) {
  const tone = TONE_STYLES[item.tone ?? "default"];
  const Icon = tone.icon;

  return (
    <div className={cn("rounded-[var(--radius-lg)] border px-4 py-3", tone.card)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.text)} />
        <div className="min-w-0">
          <div className={cn("text-sm font-medium", tone.text)}>{item.label}</div>
          {item.detail && (
            <div className="mt-0.5 text-sm text-muted-foreground">{item.detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArtifactCard({ item }: { item: AgentTimelineArtifactItem }) {
  const tone = TONE_STYLES[item.tone ?? "default"];
  const content = (
    <div className={cn("rounded-[var(--radius-lg)] border px-4 py-3", tone.card)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted/50 text-foreground">
          {item.icon ?? <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{item.title}</div>
          {item.description && (
            <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
          )}
          {item.meta && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {item.meta}
            </div>
          )}
        </div>
        {item.action && <div className="shrink-0">{item.action}</div>}
      </div>
    </div>
  );

  if (!item.onClick) return content;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={item.onClick}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          item.onClick?.();
        }
      }}
      className="block w-full text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      {content}
    </div>
  );
}

/**
 * AgentTimeline — unified mixed-content timeline for agent-backed sandbox
 * sessions. Renders messages, tool steps, status cards, and artifact handoffs in
 * a single execution narrative.
 */
export function AgentTimeline({
  items,
  isThinking,
  emptyState,
  className,
}: AgentTimelineProps) {
  if (items.length === 0 && !isThinking) {
    return emptyState ? (
      <div className={cn("flex h-full items-center justify-center p-4", className)}>
        {emptyState}
      </div>
    ) : null;
  }

  const renderedItems: AgentTimelineItem[] = isThinking
    ? [...items, { id: "__thinking__", kind: "custom", content: <ThinkingIndicator /> }]
    : items;

  // Determine which items participate in the timeline connector (non-user-message items)
  // User messages are rendered outside the timeline grid
  const timelineItems = renderedItems.filter((item) => !(item.kind === "message" && item.role === "user"));

  return (
    <div className={cn("mx-auto w-full max-w-3xl px-2 py-4 md:px-4", className)}>
      {renderedItems.map((item, index) => {
        // User messages: right-aligned bubble, no connector
        if (item.kind === "message" && item.role === "user") {
          return <UserMessage key={item.id} item={item} />;
        }

        const timelineIndex = timelineItems.indexOf(item);
        const isLast = timelineIndex === timelineItems.length - 1;

        if (item.kind === "message") {
          return (
            <AgentTimelineRow key={item.id} isLast={isLast} accentClassName="bg-[var(--brand-glow)]">
              <AssistantMessage item={item} />
            </AgentTimelineRow>
          );
        }

        if (item.kind === "tool") {
          return (
            <AgentTimelineRow key={item.id} isLast={isLast} accentClassName="bg-[var(--border-hover)]">
              <ToolCallStep
                type={item.call.type}
                label={item.call.label}
                status={item.call.status}
                detail={item.call.detail}
                output={item.call.output}
                duration={item.call.duration}
              />
            </AgentTimelineRow>
          );
        }

        if (item.kind === "tool_group") {
          return (
            <AgentTimelineRow key={item.id} isLast={isLast} accentClassName="bg-[var(--border-hover)]">
              <ToolCallGroup title={item.title}>
                {item.calls.map((call) => (
                  <ToolCallStep
                    key={call.id}
                    type={call.type}
                    label={call.label}
                    status={call.status}
                    detail={call.detail}
                    output={call.output}
                    duration={call.duration}
                  />
                ))}
              </ToolCallGroup>
            </AgentTimelineRow>
          );
        }

        if (item.kind === "status") {
          return (
            <AgentTimelineRow
              key={item.id}
              isLast={isLast}
              accentClassName={TONE_STYLES[item.tone ?? "default"].dot}
            >
              <StatusCard item={item} />
            </AgentTimelineRow>
          );
        }

        if (item.kind === "artifact") {
          return (
            <AgentTimelineRow
              key={item.id}
              isLast={isLast}
              accentClassName={TONE_STYLES[item.tone ?? "default"].dot}
            >
              <ArtifactCard item={item} />
            </AgentTimelineRow>
          );
        }

        // custom
        return (
          <AgentTimelineRow key={item.id} isLast={isLast} accentClassName="bg-[var(--border-hover)]">
            {(item as AgentTimelineCustomItem).content}
          </AgentTimelineRow>
        );
      })}
    </div>
  );
}
