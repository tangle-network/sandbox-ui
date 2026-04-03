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
  ChevronRight,
  Loader2,
  FolderOpen,
  Download,
  Pencil,
  Eye,
} from "lucide-react";
import { cn } from "../lib/utils";
import { CodeBlock } from "../markdown/code-block";

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
  /** Override syntax highlighting language; inferred from detail path if omitted */
  language?: string;
  duration?: number;
  className?: string;
}

const EXT_LANGUAGE: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  css: "css", scss: "scss",
  json: "json", jsonc: "json",
  md: "markdown", mdx: "markdown",
  py: "python",
  sh: "bash", bash: "bash", zsh: "bash",
  html: "html", htm: "html",
  yaml: "yaml", yml: "yaml",
  toml: "toml",
  rs: "rust",
  go: "go",
  sql: "sql",
  xml: "xml",
}

function inferLanguage(detail?: string, language?: string): string | undefined {
  if (language) return language
  if (!detail) return undefined
  const ext = detail.split(".").pop()?.toLowerCase()
  return ext ? EXT_LANGUAGE[ext] : undefined
}

function isFilePath(detail: string): boolean {
  return /[/\\]/.test(detail) || /\.\w{1,6}$/.test(detail)
}

function FilePathChip({ path }: { path: string }) {
  const parts = path.replace(/\\/g, "/").split("/")
  const filename = parts.pop() ?? path
  const dir = parts.length > 0 ? parts.join("/") + "/" : ""
  return (
    <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-background px-2.5 py-1.5 font-mono text-xs min-w-0">
      <FileCode className="h-3.5 w-3.5 shrink-0 text-primary" />
      {dir && (
        <span className="truncate text-muted-foreground">{dir}</span>
      )}
      <span className="shrink-0 font-semibold text-foreground">{filename}</span>
    </div>
  )
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
  running: "text-primary",
  success: "text-[var(--code-success)]",
  error: "text-[var(--code-error)]",
};

export function ToolCallStep({
  type,
  label,
  status,
  detail,
  output,
  language,
  duration,
  className,
}: ToolCallStepProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[type] || ICONS.unknown;
  const hasExpandable = !!(detail || output);
  const lang = inferLanguage(detail, language);

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-[var(--radius-lg)] border bg-card transition-colors",
        status === "running" && "border-border",
        status === "success" && "border-border hover:border-primary/20",
        status === "error" && "border-[var(--surface-danger-border)]",
        className,
      )}
    >
      <button
        onClick={() => hasExpandable && setExpanded(!expanded)}
        disabled={!hasExpandable}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
          hasExpandable && "cursor-pointer",
        )}
      >
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
            status === "running" && "border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-primary",
            status === "success" && "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]",
            status === "error" && "border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] text-[var(--surface-danger-text)]",
          )}
        >
          {status === "running" ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          ) : (
            <Icon className={cn("h-3 w-3 shrink-0", STATUS_COLORS[status])} />
          )}
        </div>

        {/* Label */}
        <span className="truncate flex-1 font-sans text-foreground">
          {label}
        </span>

        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
            status === "running" &&
              "border-border bg-[var(--accent-surface-soft)] text-primary",
            status === "success" &&
              "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]",
            status === "error" && "border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] text-[var(--surface-danger-text)]",
          )}
        >
          {status}
        </span>

        {/* Duration */}
        {duration !== undefined && status !== "running" && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
          </span>
        )}

        {/* Expand chevron */}
        {hasExpandable && (
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform shrink-0",
              expanded && "rotate-90",
            )}
          />
        )}
      </button>

      {/* Expandable content */}
      {expanded && (detail || output) && (
        <div className="space-y-2 border-t border-border bg-muted px-3 py-2.5">
          {detail && (
            isFilePath(detail)
              ? <FilePathChip path={detail} />
              : <div className="text-xs font-mono text-muted-foreground">{detail}</div>
          )}
          {output && (
            <CodeBlock
              code={output}
              language={lang}
              className="max-h-72 overflow-auto text-xs"
            />
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
        <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
