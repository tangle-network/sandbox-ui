import { memo } from "react";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import type { ToolPart } from "../types/parts";
import { getToolDisplayMetadata } from "../utils/tool-display";
import { CommandPreview } from "../tool-previews/command-preview";
import { WriteFilePreview } from "../tool-previews/write-file-preview";
import { CodeBlock } from "../markdown/code-block";
import { GrepResultsPreview } from "../tool-previews/grep-results-preview";
import { GlobResultsPreview } from "../tool-previews/glob-results-preview";
import { WebSearchPreview } from "../tool-previews/web-search-preview";
import { QuestionPreview } from "../tool-previews/question-preview";
import { DiffPreview } from "../tool-previews/diff-preview";
import { cn } from "../lib/utils";

export interface ExpandedToolDetailProps {
  part: ToolPart;
}

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  rs: "rust", py: "python", go: "go", rb: "ruby",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  md: "markdown", css: "css", scss: "scss", html: "html",
  sh: "bash", bash: "bash", zsh: "bash", sql: "sql",
  sol: "solidity", proto: "protobuf",
};

function langFromPath(path?: string): string | undefined {
  if (!path) return undefined;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? EXT_LANG[ext] : undefined;
}

/** Format an unknown value as a displayable string. */
function formatOutput(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Renders full tool details when a tool item is expanded.
 * Dispatches to specialised previews (CommandPreview, WriteFilePreview)
 * or falls back to a generic input/output code view.
 */
export const ExpandedToolDetail = memo(({ part }: ExpandedToolDetailProps) => {
  const meta = getToolDisplayMetadata(part);
  const { status, input, output, error } = part.state;

  // Specialised previews
  if (meta.displayVariant === "command") {
    return <CommandPreview part={part} />;
  }

  if (meta.displayVariant === "write-file") {
    return <WriteFilePreview part={part} />;
  }

  if (meta.displayVariant === "grep") {
    return <GrepResultsPreview part={part} />;
  }

  if (meta.displayVariant === "glob") {
    return <GlobResultsPreview part={part} />;
  }

  if (meta.displayVariant === "web-search") {
    return <WebSearchPreview part={part} />;
  }

  if (meta.displayVariant === "question") {
    return <QuestionPreview part={part} />;
  }

  if (meta.displayVariant === "diff") {
    return <DiffPreview part={part} />;
  }

  if (meta.displayVariant === "read-file") {
    return (
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--depth-1)] px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-accent)] bg-[var(--bg-section)] text-[var(--brand-cool)]">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Read file</div>
            {meta.targetPath ? (
              <div className="mt-1 text-xs text-[var(--text-muted)]">{meta.targetPath}</div>
            ) : null}
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          {typeof output === "string" ? (
            <CodeBlock code={output} language={langFromPath(meta.targetPath) ?? "text"} className="rounded-[var(--radius-md)]" />
          ) : (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-4 text-sm text-[var(--text-muted)]">
              No readable file content was returned.
            </div>
          )}
          {error ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] px-3 py-3 text-sm text-[var(--surface-danger-text)]">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Generic fallback — show input/output/error
  const inputStr = formatOutput(input);
  const outputStr = formatOutput(output);

  return (
    <div className="space-y-3">
      {/* Input */}
      {inputStr && (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--depth-1)] px-3 py-2">
            <ArrowRight className="h-3 w-3 text-[var(--brand-cool)]" />
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Input
            </span>
          </div>
          <CodeBlock code={inputStr} language="json" className="rounded-none border-0" />
        </div>
      )}

      {/* Output */}
      {status === "completed" && outputStr && (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--depth-1)] px-3 py-2">
            <ArrowLeft className="h-3 w-3 text-[var(--brand-cool)]" />
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Output
            </span>
          </div>
          <CodeBlock
            code={
              outputStr.length > 2000
                ? outputStr.slice(0, 2000) + "\n...(truncated)"
                : outputStr
            }
            language="json"
            className="rounded-none border-0"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--surface-danger-border)]">
          <div className="flex items-center gap-2 border-b border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] px-3 py-2">
            <AlertCircle className="h-3 w-3 text-[var(--surface-danger-text)]" />
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--surface-danger-text)]">
              Error
            </span>
          </div>
          <pre className="bg-[var(--surface-danger-bg)] p-3 text-xs font-[var(--font-mono)] whitespace-pre-wrap break-all text-[var(--surface-danger-text)]">
            {error}
          </pre>
        </div>
      )}

      {/* Running state */}
      {(status === "pending" || status === "running") && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-3 text-xs text-[var(--text-muted)]">
          <Loader2 className={cn("h-3 w-3 animate-spin text-[var(--brand-cool)]")} />
          Running…
        </div>
      )}
    </div>
  );
});
ExpandedToolDetail.displayName = "ExpandedToolDetail";
