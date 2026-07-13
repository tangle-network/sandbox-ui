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

import type { ReactElement } from "react";

/** Failure text, in the semantic danger token — which carries a light AND a dark
 *  value. A palette shade (`text-red-400`) only ever reads well in one theme. */
const ERROR_TEXT = { color: "var(--surface-danger-text)" } as const;

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

/**
 * A line that is pure structure — a code fence (with or without a language tag), a
 * table's rule row, a thematic break — and so carries no words to keep.
 *
 * Every test is a SINGLE quantified character class: unambiguous, and linear in the
 * length of the line. Written as one pattern (`[\s|:-]+\|[\s|:-]*`) the two
 * quantifiers would compete for the same `|`, which is the shape that backtracks.
 * Recognize the charset in one pass instead, then ask the cheap questions — is
 * there a pipe? a dash? — with plain string checks.
 */
function isStructureOnly(line: string): boolean {
  if (/^(```|~~~)/.test(line)) return true;
  const isBreak = /^([-*_])\1{2,}$/.test(line);
  // A table rule is made only of pipes, dashes, colons and spaces — and needs at
  // least one pipe AND one dash to be a rule rather than a stray divider.
  if (/^[\s|:-]+$/.test(line) && line.includes("|")) return line.includes("-");
  return isBreak;
}

/**
 * Flatten an agent's markdown answer into the sentence a person would read out
 * of it. On a two-line card preview the syntax IS the noise: a `## Heading` mid
 * paragraph, a `**bold**` run and a bullet's `-` all survive the clamp while the
 * words that carry the meaning get pushed past it. Stripping the markup (never
 * the words) is what turns the preview back into prose — the full text, markup
 * and all, is still rendered by the node's detail view.
 *
 * Structure-only lines (a fence, a table rule) are dropped; everything else keeps
 * its text and is joined into one flowing line.
 */
export function condenseText(text: string): string {
  const isListItem = (line: string) =>
    /^\s*([-*+]\s|\d+[.)]\s)/.test(line);
  const lines = text
    .split("\n")
    .map((line) => ({
      // A list item keeps its boundary when the lines are joined: run three
      // bullets together with plain spaces and they read as one long sentence,
      // which is the "word dump" all over again.
      item: isListItem(line),
      text: line
        // Leading block markers: heading hashes, quote carets, list bullets,
        // ordered-list numerals, and task-list checkboxes.
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s{0,3}>\s?/, "")
        .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/, "")
        .replace(/^\s*\d+[.)]\s+/, "")
        .trim(),
    }))
    // Structure-only lines carry no words at all: a code fence (with or without a
    // language tag), a table's rule row, a thematic break.
    .filter(({ text: line }) => line !== "" && !isStructureOnly(line));

  return lines
    .map(({ item, text: line }, i) =>
      i > 0 && item ? `· ${line}` : line,
    )
    .join(" ")
    // Inline emphasis/code/strikethrough markers, unwrapped in place.
    //
    // NOT `__underscore__` emphasis: an agent writes bold as `**bold**`, while
    // `__` is what real text puts around a Python dunder — unwrapping it rewrites
    // `File "/app/pkg/__init__.py"` (a traceback we are quite likely to be showing
    // as a node's ERROR) into `.../init.py`. Silently corrupting a failure message
    // is far worse than leaving two underscores in a preview.
    .replace(/(\*\*|~~)(.*?)\1/g, "$2")
    // Single-asterisk italics, only where the asterisk is a real delimiter: not
    // glued to a word (`*ngFor`), not doubled (a `**bold**` remnant), and not
    // wrapping whitespace — so a glob (`src/**/*.test.ts`) and a literal `2 * 3`
    // survive intact.
    .replace(/(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    // Links/images → their text (an image with no alt text leaves nothing).
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

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
 *
 * `condenseMarkdown` says the prose IS markdown and may be flattened for the
 * preview ({@link condenseText}). It is OFF by default, and the caller must only
 * turn it on for text an agent actually authored as markdown. Applied to anything
 * else it does not merely look wrong — it silently REWRITES the text: a stack
 * trace's `__init__.py` loses its underscores, and a shell glob `src/**` pairs
 * with a later `**` and both vanish. An error message is the one string a person
 * reads to find out what broke; it must reach them exactly as it was thrown.
 */
export function classifyOutput(
  preview: string | undefined,
  condenseMarkdown = false,
): OutputShape {
  let trimmed = preview?.trim() ?? "";
  // Strip every lone surrogate — a high surrogate not followed by a low, or a low
  // not preceded by a high — anywhere in the string, since it renders as the
  // replacement character. An upstream slice (the host's preview cap or
  // `clampPreview`) can leave one at the end or right before a truncation ellipsis,
  // and concatenated streamed token fragments can split a pair mid-string. Valid
  // pairs are preserved. This is the common choke point every shape renders
  // through; re-trim in case stripping exposed trailing whitespace.
  trimmed = trimmed
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .trimEnd();
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
  // Prose the caller did NOT vouch for as markdown reaches the reader verbatim.
  if (!condenseMarkdown) return { kind: "text", text: trimmed };
  // Markdown prose: condense it, so the two visible lines are two lines of WORDS.
  // Text that condenses to nothing (markup only) is empty, not a blank block.
  const condensed = condenseText(trimmed);
  return condensed === ""
    ? { kind: "empty" }
    : { kind: "text", text: condensed };
}

/** Line-clamp utility per row budget, so `code`/`text` shapes honor `rows` the
 *  same way the JSON branch does (rather than always clamping to two). Capped at
 *  a realistic card budget; an unsupported count falls back to the two-line clamp.
 *  Class names are literal so the Tailwind scanner emits each utility. */
const CLAMP_BY_ROWS: Record<number, string> = {
  1: "truncate",
  2: "line-clamp-2",
  3: "line-clamp-3",
};

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
}): ReactElement | null {
  const clampClass = CLAMP_BY_ROWS[rows] ?? "line-clamp-2";
  // Wrapping is only for a multi-line code budget; at `rows === 1` it would fight
  // `truncate`'s `white-space: nowrap` and could re-wrap the single line.
  const codeWrap = rows === 1 ? "" : "whitespace-pre-wrap break-all";

  if (shape.kind === "empty") return null;

  if (shape.kind === "json") {
    // Keep entries + the truncation marker within the `rows` line budget the
    // fixed-height card reserves: when a marker is shown it takes the last line,
    // so at most `rows - 1` entries render. (More entries exist than fit, or
    // `classifyOutput` already capped a wide object — either way, overflow.)
    const overflow = shape.truncated || shape.entries.length > rows;
    const visible = shape.entries.slice(0, overflow ? Math.max(0, rows - 1) : rows);
    // A JSON-shaped error must still read as red, like the code/text branches —
    // otherwise a failure with a structured message is indistinguishable from
    // normal output but for the label.
    const isError = tone === "error";
    const keyStyle = isError ? ERROR_TEXT : undefined;
    const keyClass = isError ? "" : "text-muted-foreground";
    const valueClass = isError ? "" : "text-foreground";
    return (
      <dl className="space-y-0.5 font-mono text-[10.5px] leading-snug">
        {visible.map(([key, value]) => (
          <div key={key} className="flex gap-1.5">
            {/* Bound the key column so a long host-supplied key can't push the
                value out of a fixed-width card; the value keeps the flex remainder. */}
            <dt
              className={`max-w-[45%] shrink-0 truncate ${keyClass}`}
              style={keyStyle}
              title={key}
            >
              {key}
            </dt>
            <dd
              className={`min-w-0 flex-1 truncate ${valueClass}`}
              style={isError ? ERROR_TEXT : undefined}
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
        {overflow && (
          <div className={`text-[10px] ${keyClass}`} style={keyStyle}>
            …
          </div>
        )}
      </dl>
    );
  }

  if (shape.kind === "code") {
    return (
      <pre
        className={`${clampClass} ${codeWrap} font-mono text-[10.5px] leading-snug ${
          tone === "error" ? "" : "text-foreground"
        }`}
        style={tone === "error" ? ERROR_TEXT : undefined}
        title={shape.text}
      >
        {shape.text}
      </pre>
    );
  }

  return (
    <p
      className={`${clampClass} text-[11px] leading-snug ${
        tone === "error" ? "" : "text-foreground"
      }`}
      style={tone === "error" ? ERROR_TEXT : undefined}
      title={shape.text}
    >
      {shape.text}
    </p>
  );
}
