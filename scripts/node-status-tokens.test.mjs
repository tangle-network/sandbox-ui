/**
 * Every design token the workflow node's status styling references must actually
 * be DECLARED by `@tangle-network/brand`. A `var(--typo)` does not throw — it
 * silently resolves to nothing, so a node quietly loses its border, its status
 * colour, or its ring and nobody finds out until someone looks at a screenshot.
 * The status-map tests assert the class string CONTAINS the token name, which
 * proves we wrote the name we meant to; only this proves the name exists.
 *
 * Lives in `scripts/` (like `validate-built-css.test.mjs`) because it reads a file
 * off disk: the package's tsconfig is DOM-only with no `@types/node`, and vitest's
 * `css: false` makes a `?raw` import of a stylesheet come back empty.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { STATUS_BADGE, STATUS_COLOR, statusBorder } from "../src/workflows/node-ui";

const STATUSES = ["queued", "running", "waiting", "succeeded", "failed"];

/** The custom properties brand declares, across every theme block. */
const DECLARED = (() => {
  const require = createRequire(import.meta.url);
  const css = readFileSync(
    require.resolve("@tangle-network/brand/styles/tokens.css"),
    "utf8",
  );
  return new Set(css.match(/--[\w-]+(?=\s*:)/g) ?? []);
})();

/** Every `var(--x)` a style string references. */
function tokensUsed(value) {
  return [...value.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
}

describe("workflow node status tokens", () => {
  it("brand declares the warning surface the `waiting` status is built on", () => {
    // `waiting` is the status a run is BLOCKED in. If these go missing the parked
    // node stops reading as "needs you" and quietly looks like any other card.
    expect(DECLARED.has("--surface-warning-text")).toBe(true);
    expect(DECLARED.has("--surface-warning-bg")).toBe(true);
    expect(DECLARED.has("--surface-warning-border")).toBe(true);
  });

  it("declares every token the status colour/badge/border maps reference", () => {
    const missing = [];
    for (const status of STATUSES) {
      for (const surface of [
        STATUS_COLOR[status],
        STATUS_BADGE[status],
        statusBorder(status),
      ]) {
        for (const token of tokensUsed(surface)) {
          if (!DECLARED.has(token)) missing.push(`${status}: ${token}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
