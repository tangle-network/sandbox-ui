import { memo, useMemo } from "react";
import { Globe } from "lucide-react";
import type { ToolPart } from "../types/parts";
import { PreviewCard, PreviewEmpty, PreviewError, PreviewLoading } from "./preview-primitives";

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

function coerceString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function extractQuery(input: unknown, output: unknown): string | undefined {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const query = coerceString(record.query) ?? coerceString(record.url);
    if (query) return query;
  }

  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    return coerceString(record.query);
  }

  return undefined;
}

function parseResult(value: unknown): SearchResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = coerceString(record.title) ?? coerceString(record.name) ?? "Untitled result";
  const url = coerceString(record.url) ?? coerceString(record.link);

  if (!url) {
    return null;
  }

  return {
    title,
    url,
    snippet:
      coerceString(record.snippet) ??
      coerceString(record.description) ??
      coerceString(record.text),
  };
}

function extractResults(output: unknown): SearchResult[] {
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const candidate = record.results ?? record.items ?? record.output;

    if (Array.isArray(candidate)) {
      return candidate.map(parseResult).filter((value): value is SearchResult => value !== null);
    }
  }

  if (Array.isArray(output)) {
    return output.map(parseResult).filter((value): value is SearchResult => value !== null);
  }

  return [];
}

export interface WebSearchPreviewProps {
  part: ToolPart;
}

export const WebSearchPreview = memo(({ part }: WebSearchPreviewProps) => {
  const query = extractQuery(part.state.input, part.state.output);
  const results = useMemo(() => extractResults(part.state.output), [part.state.output]);

  return (
    <PreviewCard
      icon={<Globe className="h-4 w-4" />}
      title={query ? `Web results for ${query}` : "Web results"}
      description={results.length > 0 ? `${results.length} result${results.length === 1 ? "" : "s"}` : undefined}
    >
      {part.state.status === "running" ? <PreviewLoading label="Searching the web…" /> : null}
      {part.state.error ? <PreviewError error={part.state.error} /> : null}
      {part.state.status === "completed" && results.length === 0 ? (
        <PreviewEmpty label="No web results were returned." />
      ) : null}
      <div className="space-y-2">
        {results.map((result) => (
          <a
            key={result.url}
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-[var(--radius-md)] border border-border bg-muted/55 px-3 py-3 transition-colors hover:border-[var(--border-accent-hover)] hover:bg-accent/50"
          >
            <div className="text-sm font-medium text-foreground">
              {result.title}
            </div>
            <div className="mt-1 truncate text-xs text-primary">
              {result.url}
            </div>
            {result.snippet ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {result.snippet}
              </p>
            ) : null}
          </a>
        ))}
      </div>
    </PreviewCard>
  );
});

WebSearchPreview.displayName = "WebSearchPreview";
