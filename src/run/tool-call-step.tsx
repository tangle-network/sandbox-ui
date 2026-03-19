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
        "group overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--bg-card)] transition-colors",
        status === "running" && "border-[var(--border-accent)]",
        status === "success" && "border-[var(--border-subtle)] hover:border-[var(--border-accent)]",
        status === "error" && "border-red-500/30",
        className,
      )}
    >
      <button
        onClick={() => hasExpandable && setExpanded(!expanded)}
        disabled={!hasExpandable}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-3 text-left text-sm",
          hasExpandable && "cursor-pointer",
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border",
            status === "running" && "border-[var(--border-accent)] bg-[var(--brand-cool)]/12 text-[var(--brand-cool)]",
            status === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
            status === "error" && "border-red-500/30 bg-red-500/10 text-red-200",
          )}
        >
          {status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : (
            <Icon className={cn("h-4 w-4 shrink-0", STATUS_COLORS[status])} />
          )}
        </div>

        {/* Label */}
        <span className="truncate flex-1 font-[var(--font-sans)] text-[var(--text-secondary)]">
          {label}
        </span>

        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
            status === "running" &&
              "border-[var(--border-accent)] bg-[var(--brand-cool)]/10 text-[var(--brand-cool)]",
            status === "success" &&
              "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
            status === "error" && "border-red-500/30 bg-red-500/10 text-red-200",
          )}
        >
          {status}
        </span>

        {/* Duration */}
        {duration !== undefined && status !== "running" && (
          <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
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
        <div className="space-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-section)]/50 px-4 py-4">
          {detail && (
            <div className="text-xs font-[var(--font-mono)] text-[var(--text-muted)]">
              {detail}
            </div>
          )}
          {output && (
            <pre className="max-h-48 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3 text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">
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
    <div className={cn("my-2 space-y-2", className)}>
      {title && (
        <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
