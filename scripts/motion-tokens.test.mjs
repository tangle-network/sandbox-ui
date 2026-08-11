/**
 * The motion contract, asserted from the stylesheet and the sources that read it.
 *
 * Three defects this exists to stop, in the order they cost the most:
 *
 * 1. A duration that is not a token. `duration-150` on a rail button is
 *    invisible to the `prefers-reduced-motion` collapse at `:root` — "it writes
 *    its own timing" and "it ignores reduced motion" are the same defect, and it
 *    is undetectable by eye because the un-collapsed animation looks correct to
 *    whoever wrote it.
 * 2. A duration collapsed to `0` instead of `1ms`. A zero-duration transition
 *    fires no `transitionend`, so anything sequencing on one hangs forever for
 *    exactly the users who asked for less motion.
 * 3. Silent drift from `@tangle-network/agent-app`, which declares this same
 *    ladder in its own `theme/tokens.css`. Both stylesheets can load in one
 *    product; identical declarations are order-independent, divergent ones are a
 *    coin flip decided by import order. The values are pinned here so a retune on
 *    one side shows up as a failing test rather than as a rail that animates at
 *    two speeds depending on which app mounted it.
 *
 * Lives in `scripts/` (like `node-status-tokens.test.mjs`) because it reads files
 * off disk: the package tsconfig is DOM-only with no `@types/node`, and vitest's
 * `css: false` makes a `?raw` import of a stylesheet come back empty.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// `join` on a resolved dirname rather than `new URL(x, import.meta.url)`: Vite
// rewrites that form into an asset lookup when the first argument is not a
// literal, and the rewrite resolves to `undefined` at runtime.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(ROOT, relative), "utf8");

const CSS = read("src/styles/globals.css");

/** Brace-matched body of the rule/at-rule starting at `start`. */
function block(css, start) {
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  return "";
}

/**
 * The reduced-motion block that collapses the ladder.
 *
 * Selected by CONTENT, not by position: this file carries more than one
 * `prefers-reduced-motion` block (an older one silences `.shimmer-text`), and
 * matching the first one measured that instead — a check that passed while
 * asserting nothing about the ladder.
 */
const REDUCED_MOTION_BLOCK = (() => {
  const marker = "@media (prefers-reduced-motion: reduce)";
  for (let at = CSS.indexOf(marker); at !== -1; at = CSS.indexOf(marker, at + 1)) {
    const body = block(CSS, at);
    if (body.includes("--duration-")) return body;
  }
  return "";
})();

/** The stylesheet minus that block, so a collapsed 1ms cannot shadow the value
 *  actually declared at `:root`. */
const BASE_CSS = REDUCED_MOTION_BLOCK ? CSS.replace(REDUCED_MOTION_BLOCK, "") : CSS;

/** `--token: value` pairs in a chunk of CSS, comments stripped. */
function declarations(css) {
  const out = new Map();
  for (const [, token, value] of css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(token, value.trim());
  }
  return out;
}

const DECLARED = declarations(BASE_CSS);
const COLLAPSED = declarations(REDUCED_MOTION_BLOCK);

/**
 * The ladder, as agent-app declares it. Duplicated as literals on purpose: a
 * test that re-derives the expected value from the file under test asserts
 * nothing.
 */
const LADDER = {
  "--duration-instant": "90ms",
  "--duration-fast": "150ms",
  "--duration-base": "240ms",
  "--duration-slow": "360ms",
  "--duration-stream": "420ms",
  "--duration-arrive": "600ms",
  "--ease-standard": "cubic-bezier(0.2, 0.8, 0.2, 1)",
  "--ease-entrance": "cubic-bezier(0.22, 1, 0.36, 1)",
  "--ease-exit": "cubic-bezier(0.4, 0, 1, 1)",
  "--ease-expo": "cubic-bezier(0.23, 1, 0.32, 1)",
  "--motion-control": "var(--duration-fast) var(--ease-standard)",
  "--motion-surface": "var(--duration-base) var(--ease-entrance)",
  "--motion-dismiss": "var(--duration-instant) var(--ease-exit)",
  "--motion-stream": "var(--duration-stream) var(--ease-expo)",
  "--motion-arrive": "var(--duration-arrive) var(--ease-expo)",
  "--stagger-step": "50ms",
  "--stagger-index": "0",
  "--arrive-distance": "8px",
  "--stream-blur": "4px",
};

describe("motion tokens", () => {
  it("declares the shared ladder at the values agent-app declares", () => {
    for (const [token, value] of Object.entries(LADDER)) {
      expect(`${token}: ${DECLARED.get(token)}`).toBe(`${token}: ${value}`);
    }
  });

  it("collapses EVERY duration under reduced motion — derived, not listed", () => {
    // Derived from the file so a seventh duration added later without a
    // collapse entry fails here instead of shipping as the one animation that
    // ignores the preference.
    const durations = [...DECLARED.keys()].filter((t) => t.startsWith("--duration-"));
    expect(durations.length).toBeGreaterThan(0);
    for (const token of durations) {
      expect(`${token}: ${COLLAPSED.get(token)}`).toBe(`${token}: 1ms`);
    }
  });

  it("collapses to 1ms and never to 0", () => {
    // 0 fires no `transitionend`; anything awaiting one hangs forever, and it
    // hangs only for the users who asked for less motion.
    for (const [token, value] of COLLAPSED) {
      if (!token.startsWith("--duration-")) continue;
      expect(value).not.toMatch(/^0m?s?$/);
    }
    // The stagger is a DELAY, not a duration: collapsed animations with a live
    // delay still arrive as a visible cascade, so it goes to zero, not to 1ms.
    expect(COLLAPSED.get("--stagger-step")).toBe("0ms");
  });

  it("exempts motion that carries meaning, and only via data-motion", () => {
    expect(REDUCED_MOTION_BLOCK).toContain(
      '*:where(:not([data-motion="essential"], [data-motion="essential"] *))',
    );
    expect(REDUCED_MOTION_BLOCK).toContain("animation-iteration-count: 1 !important");
    expect(REDUCED_MOTION_BLOCK).toContain("transition-duration: 1ms !important");
  });

  it("ships the entrance primitives the rail and session chrome ride on", () => {
    for (const rule of [
      "@keyframes agent-arrive",
      "@keyframes agent-pop-in",
      "@keyframes agent-shimmer",
      "@keyframes agent-stream-in",
      "@keyframes agent-caret",
      ".agent-disclose",
    ]) {
      expect(CSS).toContain(rule);
    }
    // The disclosure animates its REAL height. A `max-height` in any of its
    // rules is the guess it exists to replace.
    const rules = [...BASE_CSS.matchAll(/^\.agent-disclose[^{]*\{[^}]*\}/gm)].map((m) => m[0]);
    expect(rules.length).toBe(3);
    for (const rule of rules) expect(rule).not.toContain("max-height");
    expect(rules.join("\n")).toContain("grid-template-rows: 0fr");
    expect(rules.join("\n")).toContain("grid-template-rows: 1fr");
  });
});

describe("motion tokens — no literal timings in the rail and session chrome", () => {
  /** The surfaces this package choreographs. */
  const CHOREOGRAPHED = [
    "src/dashboard/app-sidebar.tsx",
    "src/dashboard/sidebar-layout.tsx",
    "src/dashboard/dashboard-layout.tsx",
    "src/dashboard/rail-tooltip.tsx",
    "src/workspace/session-sidebar.tsx",
    "src/lib/motion.ts",
  ];

  it.each(CHOREOGRAPHED)("%s times everything from a token", (file) => {
    const source = read(file)
      // Prose about the tokens is not a timing.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // `duration-150`, `ease-in-out`, `transition: opacity 200ms` — each one a
    // timing the reduced-motion collapse cannot reach.
    expect(source).not.toMatch(/\bduration-\d/);
    expect(source).not.toMatch(/\bease-(in|out|linear|in-out)\b/);
    expect(source).not.toMatch(/\b\d+(\.\d+)?m?s\b/);
  });
});
