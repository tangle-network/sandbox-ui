/**
 * ToolCallStep — renders a single agent tool invocation as a collapsible activity step.
 *
 * Inspired by Conductor's workspace activity feed.
 * Each step shows: icon, label, optional output, expandable detail.
 */

import { useState, type ReactNode } from "react";
import {
  Terminal,
  FileText,
  FileCode,
  Search,
  CheckCircle,
  XCircle,
  ChevronRight,
  Loader2,
  FolderOpen,
  Download,
  Pencil,
  Eye,
} from "lucide-react";
import { cn } from "../lib/utils";

export type ToolCallType =
  | "bash"
  | "read"
  | "write"
  | "edit"
  | "glob"
  | "grep"
  | "list"
  | "download"
  | "inspect"
  | "audit"
  | "unknown";

export type ToolCallStatus = "running" | "success" | "error";

export interface ToolCallStepProps {
  type: ToolCallType;
  label: string;
  status: ToolCallStatus;
  detail?: string;
  output?: string;
  duration?: number;
  className?: string;
}

const ICONS: Record<ToolCallType, typeof Terminal> = {
  bash: Terminal,
  read: Eye,
  write: FileText,
  edit: Pencil,
  glob: FolderOpen,
  grep: Search,
  list: FolderOpen,
  download: Download,
  inspect: Search,
  audit: CheckCircle,
  unknown: FileCode,
};

const STATUS_COLORS: Record<ToolCallStatus, string> = {
  running: "text-[var(--brand-cool)]",
  success: "text-[var(--code-success)]",
  error: "text-[var(--code-error)]",
};

export function ToolCallStep({
  type,
  label,
  status,
  detail,
  output,
  duration,
  className,
}: ToolCallStepProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[type] || ICONS.unknown;
  const hasExpandable = !!(detail || output);

  return (
    <div
      className={cn(
        "group border-l-2 pl-3 py-1.5 transition-colors",
        status === "running" && "border-[var(--brand-cool)] bg-[var(--brand-cool)]/5",
        status === "success" && "border-[var(--border-subtle)] hover:border-[var(--border-accent)]",
        status === "error" && "border-[var(--code-error)]/40",
        className,
      )}
    >
      <button
        onClick={() => hasExpandable && setExpanded(!expanded)}
        disabled={!hasExpandable}
        className={cn(
          "flex items-center gap-2 w-full text-left text-sm",
          hasExpandable && "cursor-pointer",
        )}
      >
        {/* Status indicator */}
        {status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--brand-cool)] shrink-0" />
        ) : (
          <Icon className={cn("h-3.5 w-3.5 shrink-0", STATUS_COLORS[status])} />
        )}

        {/* Label */}
        <span className="text-[var(--text-secondary)] truncate flex-1 font-[var(--font-sans)]">
          {label}
        </span>

        {/* Duration */}
        {duration !== undefined && status !== "running" && (
          <span className="text-[var(--text-muted)] text-xs tabular-nums shrink-0">
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
          </span>
        )}

        {/* Expand chevron */}
        {hasExpandable && (
          <ChevronRight
            className={cn(
              "h-3 w-3 text-[var(--text-muted)] transition-transform shrink-0",
              expanded && "rotate-90",
            )}
          />
        )}
      </button>

      {/* Expandable content */}
      {expanded && (detail || output) && (
        <div className="mt-1.5 ml-5.5 space-y-1">
          {detail && (
            <div className="text-xs text-[var(--text-muted)] font-[var(--font-mono)]">
              {detail}
            </div>
          )}
          {output && (
            <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] p-2 overflow-x-auto max-h-48 font-[var(--font-mono)]">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ToolCallGroup — groups multiple tool calls under a heading.
 */
export interface ToolCallGroupProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function ToolCallGroup({ title, children, className }: ToolCallGroupProps) {
  return (
    <div className={cn("space-y-0.5 my-2", className)}>
      {title && (
        <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1 px-1">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
