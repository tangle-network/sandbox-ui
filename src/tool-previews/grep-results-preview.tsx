import { memo, useMemo } from "react";
import { Search } from "lucide-react";
import type { ToolPart } from "../types/parts";
import { PreviewCard, PreviewEmpty, PreviewError, PreviewLoading } from "./preview-primitives";

interface GrepMatch {
  path: string;
  line?: number;
  text: string;
}

function coerceString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseMatch(value: unknown): GrepMatch | null {
  if (typeof value === "string") {
    const [path, maybeLine, ...rest] = value.split(":");
    const line = Number(maybeLine);

    if (rest.length > 0 && Number.isFinite(line)) {
      return {
        path,
        line,
        text: rest.join(":").trim(),
      };
    }

    return {
      path: "match",
      text: value,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const path =
    coerceString(record.path) ??
    coerceString(record.file) ??
    coerceString(record.filePath) ??
    "match";
  const lineValue = record.line ?? record.lineNumber ?? record.line_number;
  const line = typeof lineValue === "number" ? lineValue : Number(lineValue);
  const text =
    coerceString(record.text) ??
    coerceString(record.content) ??
    coerceString(record.lineText) ??
    coerceString(record.preview);

  if (!text) {
    return null;
  }

  return {
    path,
    line: Number.isFinite(line) ? line : undefined,
    text,
  };
}

function extractPattern(input: unknown): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  return coerceString(record.pattern) ?? coerceString(record.query);
}

function extractMatches(output: unknown): GrepMatch[] {
  if (Array.isArray(output)) {
    return output.map(parseMatch).filter((value): value is GrepMatch => value !== null);
  }

  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const candidates = [record.matches, record.results, record.output];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(parseMatch).filter((value): value is GrepMatch => value !== null);
      }
    }
  }

  if (typeof output === "string") {
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseMatch)
      .filter((value): value is GrepMatch => value !== null);
  }

  return [];
}

export interface GrepResultsPreviewProps {
  part: ToolPart;
}

export const GrepResultsPreview = memo(({ part }: GrepResultsPreviewProps) => {
  const pattern = extractPattern(part.state.input);
  const matches = useMemo(() => extractMatches(part.state.output), [part.state.output]);
  const groupedMatches = useMemo(() => {
    const groups = new Map<string, GrepMatch[]>();

    for (const match of matches) {
      const list = groups.get(match.path) ?? [];
      list.push(match);
      groups.set(match.path, list);
    }

    return [...groups.entries()];
  }, [matches]);

  return (
    <PreviewCard
      icon={<Search className="h-4 w-4" />}
      title={pattern ? `Search results for "${pattern}"` : "Search results"}
      description={matches.length > 0 ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : undefined}
    >
      {part.state.status === "running" ? <PreviewLoading label="Searching files…" /> : null}
      {part.state.error ? <PreviewError error={part.state.error} /> : null}
      {part.state.status === "completed" && matches.length === 0 ? (
        <PreviewEmpty label="No matching files or lines were returned." />
      ) : null}
      {groupedMatches.map(([path, pathMatches]) => (
        <div
          key={path}
          className="rounded-[var(--radius-md)] border border-border bg-muted/55"
        >
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-foreground">
            {path}
          </div>
          <div className="divide-y divide-border">
            {pathMatches.map((match, index) => (
              <div key={`${path}-${match.line ?? index}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3 py-2">
                <div className="pt-0.5 text-xs font-mono text-muted-foreground">
                  {match.line ?? "·"}
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs font-[var(--font-mono)] text-foreground">
                  {match.text}
                </pre>
              </div>
            ))}
          </div>
        </div>
      ))}
    </PreviewCard>
  );
});

GrepResultsPreview.displayName = "GrepResultsPreview";
