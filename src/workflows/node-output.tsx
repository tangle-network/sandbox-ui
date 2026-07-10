/**
 * Content-aware rendering of a node's output preview. The host hands the graph a
 * single `outputPreview` STRING (already length-bounded) — but that string is one
 * of several shapes: agent prose, a stringified JSON object (`{"status":200}`),
 * an array, or a truncated fragment of one. Rendering every shape as the same
 * gray paragraph reads as noise. {@link classifyOutput} recovers the shape so the
 * card can render JSON as key/value rows, structured fragments in monospace, and
 * prose as prose — "output" that reads like output.
 *
 * Pure + dependency-free classification (unit-tested without rendering); the
 * body component is presentational and container-agnostic so each node design
 * wraps it in its own frame.
 */

import type { ReactNode } from "react";

/** The recovered shape of an output preview. */
export type OutputShape =
  | { kind: "empty" }
  /** A shallow JSON object, flattened to top-level key/value pairs for a
   *  key-value render. `truncated` when more pairs exist than we kept. */
  | { kind: "json"; entries: [string, string][]; truncated: boolean }
  /** Structured-looking text we won't key/value render — a JSON array, a nested
   *  object, or a fragment the host clamped mid-token so it won't parse. Shown in
   *  monospace so it still reads as data, not prose. */
  | { kind: "code"; text: string }
  /** Free-form prose (agent output, a status line, an error message). */
  | { kind: "text"; text: string };

/** Max key/value pairs a shallow-object output renders before it reports
 *  `truncated` — the card only has room for a couple rows anyway. */
const MAX_JSON_ENTRIES = 6;

/** A single JSON value as a compact one-line string for the key/value render.
 *  Scalars render verbatim; a nested object/array collapses to a shape marker so
 *  one row never balloons into a wall of text. */
function scalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  }
  if (typeof value === "object") return "{…}";
  return "";
}

/**
 * Recover the shape of an output preview string. Only text that *begins* like
 * JSON (`{`/`[`) is parse-attempted, so ordinary prose starting with a brace-free
 * sentence is never mis-parsed. A begins-like-JSON string that fails to parse
 * (the host clamped it mid-value) still renders as `code`, not prose, so it keeps
 * its monospace/data affordance.
 */
export function classifyOutput(preview: string | undefined): OutputShape {
  const trimmed = preview?.trim() ?? "";
  if (trimmed === "") return { kind: "empty" };

  const structured = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (structured) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const all = Object.entries(parsed as Record<string, unknown>);
        const entries = all
          .slice(0, MAX_JSON_ENTRIES)
          .map(([k, v]): [string, string] => [k, scalar(v)]);
        // An object with no keys carries nothing to render as rows — fall through
        // to the raw `{}` in monospace rather than an empty key/value block.
        if (entries.length > 0) {
          return { kind: "json", entries, truncated: all.length > entries.length };
        }
      }
      // A parsed array (or empty object) reads best as its compact literal.
      return { kind: "code", text: trimmed };
    } catch {
      // Clamped mid-token / not actually JSON — keep the data affordance.
      return { kind: "code", text: trimmed };
    }
  }
  return { kind: "text", text: trimmed };
}

/**
 * Render a classified output preview's CONTENT (no surrounding frame — each node
 * design supplies its own container/label). `rows` caps the visible lines so the
 * body stays within a card's reserved output space; `tone="error"` colors it for
 * a failure message.
 */
export function NodeOutputBody({
  shape,
  rows = 2,
  tone = "default",
}: {
  shape: OutputShape;
  rows?: number;
  tone?: "default" | "error";
}): ReactNode {
  const clampClass = rows === 1 ? "truncate" : "line-clamp-2";

  if (shape.kind === "empty") return null;

  if (shape.kind === "json") {
    return (
      <dl className="space-y-0.5 font-mono text-[10px] leading-tight">
        {shape.entries.slice(0, rows).map(([key, value]) => (
          <div key={key} className="flex gap-1.5">
            <dt className="shrink-0 text-muted-foreground">{key}</dt>
            <dd
              className="min-w-0 flex-1 truncate text-foreground"
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
        {(shape.truncated || shape.entries.length > rows) && (
          <div className="text-[9px] text-muted-foreground">…</div>
        )}
      </dl>
    );
  }

  if (shape.kind === "code") {
    return (
      <pre
        className={`${clampClass} whitespace-pre-wrap break-all font-mono text-[10px] leading-tight ${
          tone === "error" ? "text-red-400" : "text-foreground/80"
        }`}
        title={shape.text}
      >
        {shape.text}
      </pre>
    );
  }

  return (
    <p
      className={`${clampClass} text-[10px] leading-snug ${
        tone === "error" ? "text-red-400" : "text-muted-foreground"
      }`}
      title={shape.text}
    >
      {shape.text}
    </p>
  );
}
