import { memo, useState } from "react";
import {
  Terminal,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { ToolPart } from "../types/parts";
import { PreviewCard, PreviewError, PreviewLoading } from "./preview-primitives";

export interface CommandPreviewProps {
  part: ToolPart;
}

/** Extract stdout/stderr/exitCode from tool output. */
function extractCommandOutput(output: unknown): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  if (!output) return { stdout: "", stderr: "", exitCode: 0 };

  if (typeof output === "string") return { stdout: output, stderr: "", exitCode: 0 };

  if (typeof output === "object" && output !== null) {
    const obj = output as Record<string, unknown>;
    return {
      stdout: String(obj.stdout ?? obj.output ?? ""),
      stderr: String(obj.stderr ?? ""),
      exitCode: Number(obj.exitCode ?? obj.exit_code ?? obj.code ?? 0),
    };
  }

  return { stdout: String(output), stderr: "", exitCode: 0 };
}

/**
 * Terminal-style command output preview.
 * Shows the command, exit code, and stdout/stderr with expand/collapse.
 */
export const CommandPreview = memo(({ part }: CommandPreviewProps) => {
  const [expanded, setExpanded] = useState(true);
  const input = part.state.input as Record<string, unknown> | undefined;
  const command =
    typeof input?.command === "string" ? input.command : String(input ?? "");

  const output =
    part.state.status === "completed"
      ? extractCommandOutput(part.state.output)
      : null;

  const isError = output ? output.exitCode !== 0 : part.state.status === "error";
  const errorText = part.state.error;
  const lineCount = output?.stdout ? output.stdout.split("\n").length : 0;

  return (
    <PreviewCard
      icon={<Terminal className="h-4 w-4" />}
      title="Command"
      description={command}
      meta={
        output ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-[var(--font-mono)]",
              isError
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
            )}
          >
            exit {output.exitCode}
          </span>
        ) : null
      }
    >
      <button
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-section)]/60 px-3 py-2 text-left transition-colors hover:border-[var(--border-accent-hover)] hover:bg-[var(--bg-hover)]/45"
      >
        <code className="min-w-0 flex-1 truncate text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">
          {command}
        </code>
        {lineCount > 0 ? (
          <span className="shrink-0 text-xs text-[var(--text-muted)]">
            {lineCount} line{lineCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        )}
      </button>

      {part.state.status === "running" ? <PreviewLoading /> : null}
      {errorText ? <PreviewError error={errorText} /> : null}

      {expanded && output ? (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-section)]/55">
          {output.stdout ? (
            <pre className="max-h-80 overflow-auto px-3 py-3 text-xs font-[var(--font-mono)] whitespace-pre-wrap break-all text-[var(--text-secondary)]">
              {output.stdout}
            </pre>
          ) : null}
          {output.stderr ? (
            <pre className="max-h-80 overflow-auto border-t border-[var(--border-subtle)] px-3 py-3 text-xs font-[var(--font-mono)] whitespace-pre-wrap break-all text-red-200">
              {output.stderr}
            </pre>
          ) : null}
        </div>
      ) : null}
    </PreviewCard>
  );
});
CommandPreview.displayName = "CommandPreview";
