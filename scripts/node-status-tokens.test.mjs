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
import { STATUS_COLOR, STATUS_PILL, statusBorder } from "../src/workflows/node-ui";

const STATUSES = ["queued", "running", "waiting", "succeeded", "failed"];

/** Every declaration brand makes, as `--token` → [values, across theme blocks]. */
const DECLARED = (() => {
  const require = createRequire(import.meta.url);
  const css = readFileSync(
    require.resolve("@tangle-network/brand/styles/tokens.css"),
    "utf8",
  );
  const out = new Map();
  for (const [, token, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const values = out.get(token) ?? [];
    values.push(value.trim());
    out.set(token, values);
  }
  return out;
})();

/** Every `var(--x)` a style value references. A status surface is a string
 *  (`STATUS_COLOR`) or a style object (`STATUS_PILL`, `statusBorder`), so walk
 *  both — a token hiding in one object field is exactly the one that rots. */
function tokensUsed(value) {
  const text =
    typeof value === "string" ? value : Object.values(value ?? {}).join(" ");
  return [...text.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
}

/**
 * A token whose value is a COMPLETE color (`#fbbf24`, `rgb(...)`) can be used bare
 * — `var(--x)`. One whose value is raw HSL CHANNELS (`38 92% 50%`, or an alias to
 * such) must be wrapped — `hsl(var(--x))`. Getting this backwards does not throw:
 * the declaration is simply dropped and the node quietly loses the colour.
 */
function isCompleteColor(value) {
  return /^(#|rgb|hsl|oklch|color-mix|transparent|currentColor)/i.test(value);
}

describe("workflow node status tokens", () => {
  it("brand declares the warning surface the `waiting` status is built on", () => {
    // `waiting` is the status a run is BLOCKED in. If these go missing the parked
    // node stops reading as "needs you" and quietly looks like any other card.
    expect(DECLARED.has("--surface-warning-text")).toBe(true);
    expect(DECLARED.has("--surface-warning-bg")).toBe(true);
    expect(DECLARED.has("--surface-warning-border")).toBe(true);
  });

  it("declares every token the status colour/pill/border maps reference", () => {
    const missing = [];
    for (const status of STATUSES) {
      for (const surface of [
        STATUS_COLOR[status],
        STATUS_PILL[status],
        statusBorder(status),
      ]) {
        for (const token of tokensUsed(surface)) {
          if (!DECLARED.has(token)) missing.push(`${status}: ${token}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps the bare-vs-hsl() distinction the warning and primary tokens sit on", () => {
    // The workflow node uses the warning surface BARE (`var(--surface-warning-text)`)
    // and the primary accent WRAPPED (`hsl(var(--primary))`). That asymmetry is not
    // a slip — it is what each token's value requires. If brand ever flips one of
    // them to the other form, the node silently loses that colour, so pin it here.
    for (const token of [
      "--surface-warning-text",
      "--surface-warning-bg",
      "--surface-warning-border",
    ]) {
      for (const value of DECLARED.get(token) ?? []) {
        expect(
          isCompleteColor(value),
          `${token} is used bare as var(${token}), so it must be a complete color — got "${value}"`,
        ).toBe(true);
      }
    }
    // Its counterpart: `--primary` resolves to raw channels, which is exactly why
    // every use of it in the node is `hsl(var(--primary))`.
    for (const value of DECLARED.get("--primary") ?? []) {
      const resolved = value.startsWith("var(")
        ? (DECLARED.get(value.slice(4, -1))?.[0] ?? value)
        : value;
      expect(
        isCompleteColor(resolved),
        `--primary is used as hsl(var(--primary)), so it must NOT already be a complete color — got "${resolved}"`,
      ).toBe(false);
    }
  });
});
