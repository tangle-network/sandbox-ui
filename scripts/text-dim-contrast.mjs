/**
 * Ground truth for `--text-dim`: what the token ACTUALLY measures against every
 * plane this package ships, in a real browser, in both themes.
 *
 * `--text-dim` is the quietest text tier — an Input/Textarea hint, a StatCard
 * subtitle, a TerminalLine timestamp. `@tangle-network/ui` 11.2.4 moved those
 * three from alpha-faded foregrounds (`text-muted-foreground/70`, `opacity-70`)
 * to the solid token, which is the right call: a translucent foreground renders
 * as its colour COMPOSITED over whatever plane sits behind it, so one class
 * measured a different ratio on a card than on the canvas. But a solid token is
 * only correct if its value was tuned against the surface ladder it lands on,
 * and this package ships brand 1.1.0's ladder while the token value was chosen
 * against a later, lighter one.
 *
 * Two things a static file cannot settle, and one browser can:
 *
 *  1. Does the utility EMIT? `text-[var(--text-dim)]` is an arbitrary-value
 *     utility, so it exists in the built CSS only if Tailwind scanned a source
 *     that used it. The `@source` glob points at the INSTALLED
 *     `@tangle-network/ui/src`, so a package pinned behind the components a
 *     consumer actually renders emits no rule at all and the text silently
 *     inherits body colour — 15:1 where 4.5:1 was intended, which is a lost
 *     hierarchy rather than a contrast failure and therefore invisible to a
 *     contrast audit. Reading the class off a rendered element answers it.
 *  2. What does a plane composite to? Half the Card variants are alpha fills
 *     (`bg-card/80`, `bg-muted/50`), so their effective colour depends on the
 *     plane behind them. Only the render composites that.
 *
 * Reads `dist/globals.css`, so it measures the bytes consumers install rather
 * than a re-implementation of them. Run `pnpm build` first.
 *
 *   node scripts/text-dim-contrast.mjs                    # table + PASS/FAIL
 *   node scripts/text-dim-contrast.mjs --out /tmp/dir     # also writes PNGs
 *   node scripts/text-dim-contrast.mjs --dark '#818189' --light '#6b6b75'
 *                                                        # score a candidate
 *
 * Needs Chromium: `pnpm exec playwright install chromium`. Deliberately NOT in
 * CI — `scripts/text-dim-contrast.test.mjs` is the gate that runs on every
 * commit, and it re-derives these same numbers from the token files with no
 * browser. This script is what proves that arithmetic matches a real render.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { createRequire } from "node:module";

import {
  AA_NORMAL,
  DIM_SURFACES,
  contrast,
  parseThemeTokens,
  resolveColor,
  resolveSurface,
  worstSurface,
} from "./text-dim-surfaces.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const builtCss = resolve(here, "..", "dist", "globals.css");

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
};
const outDir = arg("--out");
const override = { dark: arg("--dark"), light: arg("--light") };

let css;
try {
  css = readFileSync(builtCss, "utf8");
} catch {
  console.error(`dist/globals.css not found — run \`pnpm build\` first.`);
  process.exit(1);
}

/**
 * The page is the BUILT stylesheet plus one element per plane, each labelled
 * with the real Tailwind utility rather than a literal colour, so the whole
 * `bg-card` -> `--color-card` -> `hsl(var(--card))` -> `var(--hsl-card)` chain
 * is exercised. A literal would measure a number this package never paints.
 */
const page = () => `<!doctype html><meta charset="utf-8">
<style>${css}</style>
<style>body { margin: 0; font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; }</style>`;

const browser = await chromium.launch();
const tab = await browser.newPage({
  viewportSize: { width: 900, height: 700 },
  deviceScaleFactor: 1,
});
await tab.setContent(page());

/**
 * Measure one text-colour/plane pair as the screen receives it.
 *
 * Two traps are encoded here because both produced a wrong number first.
 *
 * The theme attribute goes on `<html>`, never on a wrapper div. Tailwind's
 * `@theme` block declares `--color-card` (and every sibling) on `:root`, so a
 * nested `.dark`/`[data-theme]` cannot move them — the plane keeps resolving
 * through the root's value and every dark surface measures as its light
 * counterpart. Theming a nested node fails SILENTLY; it does not error.
 *
 * The colours are RASTERISED on a canvas rather than parsed out of
 * `getComputedStyle`. A `color-mix(in oklab, …)` — which is what a `/70` alpha
 * modifier compiles to in Tailwind v4 — computes to an `oklch(…)` string, and
 * reading its three components as if they were RGB bytes is how a contrast
 * script reports a pale grey as 20:1 against white. The canvas also does the
 * alpha compositing for the `bg-card/80` and `bg-muted/50` planes while it is
 * at it, which is the other thing a string cannot answer.
 */
const measure = (theme, surface, textColor) =>
  tab.evaluate(
    ([mode, s, colorOverride]) => {
      document.documentElement.setAttribute("data-theme", mode);

      const base = document.createElement("div");
      base.className = s.base ?? "";
      const plane = document.createElement("div");
      plane.className = s.className;
      const text = document.createElement("span");
      // The REAL utility, so a missing rule shows up as an unstyled element
      // rather than as a colour this script supplied on its behalf.
      text.className = "text-[var(--text-dim)]";
      if (colorOverride) text.style.color = colorOverride;
      text.textContent = "hint";
      plane.append(text);
      base.append(plane);
      document.body.append(base);

      const planeFill = getComputedStyle(plane).backgroundColor;
      const baseFill = getComputedStyle(base).backgroundColor;
      const inkColor = getComputedStyle(text).color;
      base.remove();

      const raster = (fills) => {
        const canvas = new OffscreenCanvas(1, 1);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, 1, 1);
        // White under the stack: the page body is opaque, so an alpha plane
        // composites over something. Starting from transparent would let a
        // premultiplied read come back darker than anything ever painted.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 1, 1);
        for (const value of fills) {
          ctx.fillStyle = value;
          ctx.fillRect(0, 0, 1, 1);
        }
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      };

      const transparent = (v) => !v || v === "rgba(0, 0, 0, 0)";
      const planeRgb = raster([baseFill, planeFill].filter(Boolean));
      return {
        plane: planeRgb,
        // A plane whose utility Tailwind never emitted paints nothing, and
        // "nothing" rasterises as the base fill — a real number for a surface
        // that was never on screen. Report it rather than scoring it; a bogus
        // ratio in the table is worse than an absent one.
        planePainted: !transparent(planeFill),
        // Ink is composited over the plane it sits on, so a token that ever
        // grows an alpha is measured as delivered rather than as declared.
        ink: raster([...[baseFill, planeFill].filter(Boolean), inkColor]),
        rawInk: inkColor,
        emitted: inkColor !== "" && inkColor !== "rgba(0, 0, 0, 0)",
      };
    },
    [theme, surface, textColor],
  );

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

const results = {};
let failures = 0;
let unstyled = 0;

for (const theme of ["dark", "light"]) {
  const shipped = await measure(theme, DIM_SURFACES[0], null);
  const candidate = override[theme]
    ? await measure(theme, DIM_SURFACES[0], override[theme])
    : null;

  console.log(`\n=== ${theme.toUpperCase()} — --text-dim against every plane it can land on ===`);
  console.log(
    `token as shipped: ${hex(shipped.ink)}${
      candidate ? `   candidate: ${hex(candidate.ink)}` : ""
    }`,
  );
  console.log(
    ["surface".padEnd(30), "plane".padEnd(9), "shipped".padStart(8)]
      .concat(candidate ? ["candidate".padStart(10)] : [])
      .concat(["renders"])
      .join("  "),
  );

  results[theme] = [];
  for (const surface of DIM_SURFACES) {
    const now = await measure(theme, surface, null);
    const next = override[theme]
      ? await measure(theme, surface, override[theme])
      : null;

    if (!now.emitted) unstyled++;

    if (!now.planePainted) {
      // Only ever true for a plane nothing paints content on — a gated plane
      // that stopped emitting is a defect, so it still counts as a failure.
      if (surface.gated) failures++;
      results[theme].push({
        surface: surface.key,
        gated: surface.gated,
        plane: null,
        shipped: null,
        candidate: null,
      });
      console.log(
        [
          `${surface.gated ? "*" : " "}${surface.key}`.padEnd(30),
          "—".padEnd(9),
          "not emitted".padStart(8),
        ]
          .concat(override[theme] ? ["".padStart(10)] : [])
          .concat([surface.renders])
          .join("  "),
      );
      continue;
    }

    const nowRatio = contrast(now.ink, now.plane);
    const nextRatio = next ? contrast(next.ink, next.plane) : null;
    const judged = nextRatio ?? nowRatio;
    // Only the planes the shipped components genuinely render on are gated.
    // `--text-dim` is a deliberately quiet tier and brand's own value does not
    // clear AA on the overlay plane in ANY version; holding the token to a
    // surface nothing renders it on would collapse it into `--text-muted` and
    // delete the tier rather than fix it. The ungated planes are still measured
    // and printed — an unmeasured surface is how this defect shipped.
    const bad = surface.gated && judged < AA_NORMAL;
    if (bad) failures++;

    results[theme].push({
      surface: surface.key,
      gated: surface.gated,
      plane: hex(now.plane),
      shipped: Number(nowRatio.toFixed(2)),
      candidate: nextRatio ? Number(nextRatio.toFixed(2)) : null,
    });

    console.log(
      [
        `${surface.gated ? "*" : " "}${surface.key}`.padEnd(30),
        hex(now.plane).padEnd(9),
        nowRatio.toFixed(2).padStart(8),
      ]
        .concat(nextRatio ? [nextRatio.toFixed(2).padStart(10)] : [])
        .concat([surface.renders])
        .join("  "),
    );
  }
}

console.log(`\n* = gated at AA ${AA_NORMAL}:1 (a plane a shipped component renders --text-dim on)`);

console.log("\n=== does the built bundle emit the utility? ===");
// The whole point of measuring through the class: an un-emitted arbitrary
// utility leaves the element with the inherited body colour, which reads as a
// perfectly fine contrast ratio and a completely lost hierarchy.
const emits = /\.text-\\\[var\(--text-dim\)\\\]|color:\s*var\(--text-dim\)/.test(css);
console.log(
  `${emits ? "PASS" : "FAIL"}  dist/globals.css emits a text-[var(--text-dim)] rule`,
);
if (!emits) failures++;
if (unstyled) {
  console.log(`FAIL  ${unstyled} position(s) rendered with no colour at all`);
  failures++;
}

/**
 * The gate that runs on every commit re-derives these numbers from the token
 * files with no browser. That is only trustworthy if the arithmetic agrees with
 * what a renderer actually paints, so prove it here rather than asserting it in
 * a comment. The tolerance is one sRGB byte of alpha-compositing rounding —
 * Chromium truncates where `Math.round` rounds up — which moves a ratio by at
 * most ~0.01 and always toward the stricter side.
 */
console.log("\n=== static gate vs this render ===");
const nodeRequire = createRequire(import.meta.url);
const staticTokens = parseThemeTokens(
  readFileSync(
    nodeRequire.resolve("@tangle-network/brand/styles/tokens.css"),
    "utf8",
  ),
  readFileSync(resolve(here, "..", "src", "styles", "globals.css"), "utf8"),
);
let drift = 0;
for (const theme of ["dark", "light"]) {
  for (const row of results[theme]) {
    if (row.shipped === null) continue;
    const surface = DIM_SURFACES.find((s) => s.key === row.surface);
    const expected = contrast(
      resolveColor("--text-dim", staticTokens[theme]),
      resolveSurface(surface, staticTokens[theme]),
    );
    const delta = Math.abs(expected - (row.candidate ?? row.shipped));
    if (delta > 0.02) {
      drift++;
      console.log(
        `FAIL  ${theme} ${row.surface}: gate says ${expected.toFixed(2)}, render says ${(row.candidate ?? row.shipped).toFixed(2)}`,
      );
    }
  }
}
if (drift) failures += drift;
else
  console.log(
    "PASS  every plane agrees with scripts/text-dim-contrast.test.mjs within rounding",
  );

const worst = {
  dark: worstSurface(results.dark, override.dark ? "candidate" : "shipped"),
  light: worstSurface(results.light, override.light ? "candidate" : "shipped"),
};
console.log(
  `\nworst gated plane — dark ${worst.dark.surface} ${worst.dark.ratio}:1` +
    `, light ${worst.light.surface} ${worst.light.ratio}:1`,
);

if (outDir) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "text-dim-contrast.json"),
    JSON.stringify(results, null, 2),
  );

  // The numbers say it passes; a screenshot says what it looks like. Both are
  // needed — a token can clear AA and still have collapsed into the tier above
  // it, which no ratio in this file would catch.
  const BEFORE = { dark: "#6b6b73", light: "#8e8e98" };
  const sample = (theme, color) =>
    DIM_SURFACES.filter((s) => s.gated)
      .map(
        (s) => `<div class="cell">
          <div class="${s.base ?? ""}"><div class="${s.className} pane">
            <div class="tiers">
              <span style="color:var(--text-primary)">Primary</span>
              <span style="color:var(--text-secondary)">Secondary</span>
              <span style="color:var(--text-muted)">Muted</span>
              <span style="color:${color}">Dim</span>
            </div>
            <div class="hint" style="color:${color}">Must be a valid email address</div>
            <div class="log"><span style="color:${color}">[12:04:19]</span> build finished in 2.1s</div>
          </div></div>
          <div class="lbl">${s.key}</div>
        </div>`,
      )
      .join("");

  const shot = async (theme) => {
    const p = await browser.newPage({
      viewportSize: { width: 1180, height: 900 },
      deviceScaleFactor: 2,
    });
    await p.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>
      <style>
        html { background: ${theme === "dark" ? "#0a0a14" : "#eceef3"}; }
        body { margin: 0; padding: 20px; font: 13px/1.5 ui-sans-serif, system-ui, sans-serif;
               color: ${theme === "dark" ? "#ececee" : "#191c24"}; }
        h2 { font-size: 13px; margin: 0 0 4px; letter-spacing: .04em; text-transform: uppercase; opacity: .6; }
        h3 { font-size: 15px; margin: 0 0 10px; }
        .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        .grid { display: grid; gap: 8px; }
        .pane { padding: 9px 11px; border-radius: 8px; border: 1px solid var(--md3-outline-variant); }
        .tiers { display: flex; gap: 10px; font-size: 12px; margin-bottom: 5px; }
        .hint { font-size: 13px; }
        .log { font-family: ui-monospace, monospace; font-size: 12px; margin-top: 3px; }
        .lbl { font-size: 10px; opacity: .5; margin: 3px 0 0 2px; }
        .cell { margin-bottom: 2px; }
      </style>
      <h2>${theme} — --text-dim on every gated plane</h2>
      <div class="cols">
        <div><h3>before — ${BEFORE[theme]}</h3><div class="grid">${sample(theme, BEFORE[theme])}</div></div>
        <div><h3>after — ${theme === "dark" ? "#92929a" : "#6b6b75"}</h3><div class="grid">${sample(theme, theme === "dark" ? "#92929a" : "#6b6b75")}</div></div>
      </div>`);
    await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await p.waitForTimeout(120);
    const file = join(outDir, `text-dim-${theme}.png`);
    await p.screenshot({ path: file, fullPage: true });
    await p.close();
    return file;
  };
  console.log(`\nmeasurements → ${join(outDir, "text-dim-contrast.json")}`);
  for (const theme of ["dark", "light"]) console.log(`screenshot   → ${await shot(theme)}`);
}

await browser.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall gated planes clear AA");
