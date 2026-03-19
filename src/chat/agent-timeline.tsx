import { type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  FileText,
  Info,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ChatMessage, type MessageRole } from "./chat-message";
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
    card: "border-[var(--border-subtle)] bg-[var(--bg-card)]",
    text: "text-[var(--text-secondary)]",
    icon: CircleDot,
  },
  info: {
    dot: "bg-sky-400",
    card: "border-sky-500/20 bg-sky-500/5",
    text: "text-sky-200",
    icon: Info,
  },
  success: {
    dot: "bg-[var(--code-success)]",
    card: "border-emerald-500/20 bg-emerald-500/5",
    text: "text-emerald-200",
    icon: CheckCircle2,
  },
  warning: {
    dot: "bg-amber-400",
    card: "border-amber-500/20 bg-amber-500/5",
    text: "text-amber-100",
    icon: AlertTriangle,
  },
  error: {
    dot: "bg-[var(--code-error)]",
    card: "border-red-500/20 bg-red-500/5",
    text: "text-red-200",
    icon: AlertTriangle,
  },
};

interface AgentTimelineRowProps {
  isLast: boolean;
  accentClassName: string;
  children: ReactNode;
}

function AgentTimelineRow({ isLast, accentClassName, children }: AgentTimelineRowProps) {
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-4">
      <div className="relative flex justify-center">
        {!isLast && (
          <span className="absolute top-4 bottom-[-1rem] left-1/2 w-px -translate-x-1/2 bg-[var(--border-subtle)]" />
        )}
        <span className={cn("relative mt-2 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--bg-root)]", accentClassName)} />
      </div>
      <div className="min-w-0 pb-4">{children}</div>
    </div>
  );
}

function StatusCard({ item }: { item: AgentTimelineStatusItem }) {
  const tone = TONE_STYLES[item.tone ?? "default"];
  const Icon = tone.icon;

  return (
    <div className={cn("rounded-[var(--radius-lg)] border px-4 py-3 shadow-[var(--shadow-card)]", tone.card)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.text)} />
        <div className="min-w-0">
          <div className={cn("text-sm font-medium", tone.text)}>{item.label}</div>
          {item.detail && (
            <div className="mt-1 text-sm text-[var(--text-muted)]">{item.detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArtifactCard({ item }: { item: AgentTimelineArtifactItem }) {
  const tone = TONE_STYLES[item.tone ?? "default"];
  const content = (
    <div className={cn("rounded-[var(--radius-lg)] border px-4 py-3 shadow-[var(--shadow-card)]", tone.card)}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]")}>
          {item.icon ?? <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--text-primary)]">{item.title}</div>
          {item.description && (
            <div className="mt-1 text-sm text-[var(--text-muted)]">{item.description}</div>
          )}
          {item.meta && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
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
      className="block w-full text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
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
      <div className={cn("flex h-full items-center justify-center p-8", className)}>
        {emptyState}
      </div>
    ) : null;
  }

  const renderedItems: AgentTimelineItem[] = isThinking
    ? [...items, { id: "__thinking__", kind: "custom", content: <ThinkingIndicator /> }]
    : items;

  return (
    <div className={cn("mx-auto w-full max-w-5xl px-4 py-4", className)}>
      {renderedItems.map((item, index) => {
        const isLast = index === renderedItems.length - 1;

        if (item.kind === "message") {
          const accentClassName =
            item.role === "user" ? "bg-[var(--brand-cool)]" : "bg-[var(--brand-glow)]";

          return (
            <AgentTimelineRow key={item.id} isLast={isLast} accentClassName={accentClassName}>
              <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
                <ChatMessage
                  role={item.role}
                  content={item.content}
                  toolCalls={item.toolCalls}
                  isStreaming={item.isStreaming}
                  timestamp={item.timestamp}
                />
                {item.after && (
                  <div className="border-t border-[var(--border-subtle)] px-4 py-3">
                    {item.after}
                  </div>
                )}
              </div>
            </AgentTimelineRow>
          );
        }

        if (item.kind === "tool") {
          return (
            <AgentTimelineRow
              key={item.id}
              isLast={isLast}
              accentClassName="bg-[var(--brand-cool)]/80"
            >
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
            <AgentTimelineRow
              key={item.id}
              isLast={isLast}
              accentClassName="bg-[var(--brand-cool)]/80"
            >
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

        return (
          <AgentTimelineRow
            key={item.id}
            isLast={isLast}
            accentClassName="bg-[var(--border-hover)]"
          >
            {item.content}
          </AgentTimelineRow>
        );
      })}
    </div>
  );
}
