import { memo } from "react";
import { GitCompareArrows } from "lucide-react";
import type { ToolPart } from "../types/parts";
import { CodeBlock } from "../markdown/code-block";
import { PreviewCard, PreviewEmpty, PreviewError, PreviewLoading } from "./preview-primitives";

function extractString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function extractDiffPayload(part: ToolPart): {
  path?: string;
  diff?: string;
  before?: string;
  after?: string;
} {
  const sources = [part.state.input, part.state.output, part.state.metadata];

  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }

    const record = source as Record<string, unknown>;
    const diff = extractString(record, "diff", "patch", "unifiedDiff", "unified_diff");
    const before = extractString(record, "oldString", "old_string", "before", "previous");
    const after = extractString(record, "newString", "new_string", "after", "updated");
    const path = extractString(record, "file_path", "filePath", "path");

    if (diff || before || after) {
      return { path, diff, before, after };
    }
  }

  return {};
}

export interface DiffPreviewProps {
  part: ToolPart;
}

export const DiffPreview = memo(({ part }: DiffPreviewProps) => {
  const payload = extractDiffPayload(part);

  return (
    <PreviewCard
      icon={<GitCompareArrows className="h-4 w-4" />}
      title={payload.path ? `Changes for ${payload.path}` : "File changes"}
    >
      {part.state.status === "running" ? <PreviewLoading label="Computing changes…" /> : null}
      {part.state.error ? <PreviewError error={part.state.error} /> : null}
      {!payload.diff && !payload.before && !payload.after ? (
        <PreviewEmpty label="No structured diff payload was provided." />
      ) : null}
      {payload.diff ? (
        <CodeBlock code={payload.diff} language="diff" className="rounded-[var(--radius-md)]" />
      ) : null}
      {!payload.diff && payload.before ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Before
          </div>
          <CodeBlock code={payload.before} language="text" className="rounded-[var(--radius-md)]" />
        </div>
      ) : null}
      {!payload.diff && payload.after ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            After
          </div>
          <CodeBlock code={payload.after} language="text" className="rounded-[var(--radius-md)]" />
        </div>
      ) : null}
    </PreviewCard>
  );
});

DiffPreview.displayName = "DiffPreview";
