/**
 * One transcript scale: the person's and the agent's message bodies read at
 * Brand's `--transcript-font-size` / `--transcript-line-height`.
 *
 * ui's TRANSCRIPT_TEXT sets that leading with a layered Tailwind utility, and
 * this stylesheet's `.tangle-prose { line-height: 1.7 }` is unlayered, so it
 * wins over any layered rule whatever the specificity. Production Legal measured
 * the person's text at 1.6 and the agent's `.tangle-prose` at 1.7. The fix is an
 * unlayered rule that outranks `.tangle-prose`; this asserts it stays unlayered
 * and keeps the tokens.
 *
 * Reads the file off disk for the reason motion-tokens.test.mjs gives.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = readFileSync(join(ROOT, "src/styles/tailwind.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The selector's top-level rule body, or null when it is absent or nested. */
function topLevelRule(selector) {
  let depth = 0;
  let ruleStart = 0;
  for (let i = 0; i < CSS.length; i += 1) {
    const ch = CSS[i];
    if (ch === "{") {
      if (depth === 0) {
        const prelude = CSS.slice(ruleStart, i).trim();
        const names = prelude.split(",").map((s) => s.trim());
        if (names.includes(selector)) {
          const end = CSS.indexOf("}", i);
          return CSS.slice(i + 1, end);
        }
      }
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) ruleStart = i + 1;
    } else if (ch === ";" && depth === 0) {
      ruleStart = i + 1;
    }
  }
  return null;
}

describe("transcript text scale", () => {
  it("keeps .tangle-prose unlayered, which is why the override must be too", () => {
    expect(topLevelRule(".tangle-prose")).toMatch(/line-height:\s*1\.7/);
  });

  it("sets an agent message's prose to the transcript tokens, unlayered", () => {
    const body = topLevelRule(".tangle-prose.tangle-transcript-text");
    expect(body).not.toBeNull();
    expect(body).toMatch(/font-size:\s*var\(--transcript-font-size\)/);
    expect(body).toMatch(/line-height:\s*var\(--transcript-line-height\)/);
  });

  it("lets Markdown inside a transcript container inherit its leading", () => {
    const body = topLevelRule(".tangle-transcript-text .tangle-prose");
    expect(body).not.toBeNull();
    expect(body).toMatch(/line-height:\s*inherit/);
  });
});
