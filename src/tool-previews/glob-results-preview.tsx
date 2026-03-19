import { memo, useMemo } from "react";
import { FileText, FolderOpen } from "lucide-react";
import type { ToolPart } from "../types/parts";
import { PreviewCard, PreviewEmpty, PreviewError, PreviewLoading } from "./preview-primitives";

function coerceString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function extractPattern(input: unknown): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  return coerceString(record.pattern) ?? coerceString(record.path);
}

function extractFiles(output: unknown): string[] {
  if (Array.isArray(output)) {
    return output.map((item) => String(item)).filter(Boolean);
  }

  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const candidate = record.files ?? record.matches ?? record.paths ?? record.results;

    if (Array.isArray(candidate)) {
      return candidate
        .map((item) =>
          typeof item === "string"
            ? item
            : item && typeof item === "object"
              ? String(
                  (item as Record<string, unknown>).path ??
                    (item as Record<string, unknown>).file ??
                    "",
                )
              : "",
        )
        .filter(Boolean);
    }
  }

  if (typeof output === "string") {
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

export interface GlobResultsPreviewProps {
  part: ToolPart;
}

export const GlobResultsPreview = memo(({ part }: GlobResultsPreviewProps) => {
  const pattern = extractPattern(part.state.input);
  const files = useMemo(() => extractFiles(part.state.output), [part.state.output]);

  return (
    <PreviewCard
      icon={<FolderOpen className="h-4 w-4" />}
      title={pattern ? `Files for ${pattern}` : "File results"}
      description={files.length > 0 ? `${files.length} path${files.length === 1 ? "" : "s"}` : undefined}
    >
      {part.state.status === "running" ? <PreviewLoading label="Collecting files…" /> : null}
      {part.state.error ? <PreviewError error={part.state.error} /> : null}
      {part.state.status === "completed" && files.length === 0 ? (
        <PreviewEmpty label="No matching files were returned." />
      ) : null}
      {files.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {files.map((file) => {
            const isDirectory = file.endsWith("/");
            const Icon = isDirectory ? FolderOpen : FileText;

            return (
              <div
                key={file}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-section)]/55 px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--brand-cool)]" />
                <span className="min-w-0 truncate text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">
                  {file}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </PreviewCard>
  );
});

GlobResultsPreview.displayName = "GlobResultsPreview";
