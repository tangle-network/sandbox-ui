/**
 * `--text-dim` must clear WCAG AA against every plane this package paints
 * content on — in both themes, as the cascade actually resolves it.
 *
 * The defect this exists to stop: `@tangle-network/ui` 11.2.4 moved the Input
 * hint, the StatCard subtitle and the TerminalLine timestamp off alpha-faded
 * foregrounds and onto a solid `text-[var(--text-dim)]`. That is the right
 * call — a translucent foreground renders composited over whatever plane is
 * behind it, so the same class measured a different ratio on a card than on the
 * canvas. But the token's VALUE was tuned against a later, lighter brand
 * surface ladder than the one this package resolves, so the correct class
 * landed the wrong colour and the dark input hint went 4.63:1 -> 3.73:1,
 * crossing below AA in three shipped products. Nothing failed; it just got
 * harder to read.
 *
 * Lives in `scripts/` alongside `node-status-tokens.test.mjs` and
 * `validate-built-css.test.mjs` for the same reason they do: it reads files off
 * disk, and the package tsconfig is DOM-only with no `@types/node` while
 * vitest's `css: false` makes a `?raw` stylesheet import come back empty.
 *
 * Ground truth is `scripts/text-dim-contrast.mjs`, which drives real Chromium,
 * resolves each plane through the real `bg-*` utility and RASTERISES the result
 * so `color-mix()` and alpha compositing are answered by the renderer rather
 * than by arithmetic. This file re-derives the same numbers from the token
 * files with no browser so the check can run on every commit — the browser
 * script is what proves the two agree.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  AA_NORMAL,
  DIM_SURFACES,
  contrast,
  parseThemeTokens,
  resolveColor,
  resolveSurface,
} from "./text-dim-surfaces.mjs";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const brandTokensCss = readFileSync(
  require.resolve("@tangle-network/brand/styles/tokens.css"),
  "utf8",
);
const globalsCss = readFileSync(
  join(here, "..", "src", "styles", "globals.css"),
  "utf8",
);

/** The cascade a consumer gets: brand's tokens, then this package's overrides. */
const SHIPPED = parseThemeTokens(brandTokensCss, globalsCss);
/** brand alone — what would ship if this package overrode nothing. */
const BRAND_ONLY = parseThemeTokens(brandTokensCss);

const THEMES = ["dark", "light"];
const GATED = DIM_SURFACES.filter((s) => s.gated);

const ratioOn = (surface, tokens) =>
  contrast(resolveColor("--text-dim", tokens), resolveSurface(surface, tokens));

describe("--text-dim contrast against the surfaces this package ships", () => {
  for (const theme of THEMES) {
    it(`clears AA on every gated ${theme} plane`, () => {
      const failures = GATED.map((surface) => ({
        surface: surface.key,
        ratio: Number(ratioOn(surface, SHIPPED[theme]).toFixed(2)),
      })).filter(({ ratio }) => ratio < AA_NORMAL);

      expect(
        failures,
        `--text-dim (${SHIPPED[theme].get("--text-dim")}) is below ${AA_NORMAL}:1 on ${theme} plane(s) a shipped component renders it on. ` +
          `Re-derive it with \`node scripts/text-dim-contrast.mjs --${theme} '#rrggbb'\` and correct the override in src/styles/globals.css.`,
      ).toEqual([]);
    });
  }

  it("resolves --text-dim to a complete colour in both themes", () => {
    // A token that resolves to nothing does not throw — the declaration is
    // dropped and the text silently falls back to the inherited colour, which
    // is the same end state as the un-emitted utility this package also guards
    // against. Both themes, because an override that names only one selector
    // list leaves the other theme on the stale value and nothing says so.
    for (const theme of THEMES) {
      expect(
        () => resolveColor("--text-dim", SHIPPED[theme]),
        `--text-dim does not resolve to a colour in ${theme}`,
      ).not.toThrow();
    }
  });

  it("keeps --text-dim quieter than --text-muted in both themes", () => {
    // The token is the QUIETEST text tier. Raising it until it clears AA on
    // every plane is only a fix while it stays visibly below the tier above it
    // — past that point the tier has been deleted rather than repaired, which
    // a pure contrast assertion would happily call a pass.
    for (const theme of THEMES) {
      const lum = (t) => {
        const [r, g, b] = resolveColor(t, SHIPPED[theme]);
        const lin = (c) =>
          c / 255 <= 0.04045
            ? c / 255 / 12.92
            : ((c / 255 + 0.055) / 1.055) ** 2.4;
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const dim = lum("--text-dim");
      const muted = lum("--text-muted");
      // Dark recedes by getting darker, light by getting lighter.
      const quieter = theme === "dark" ? dim < muted : dim > muted;
      expect(
        quieter,
        `--text-dim (${SHIPPED[theme].get("--text-dim")}) must read quieter than --text-muted (${SHIPPED[theme].get("--text-muted")}) in ${theme}`,
      ).toBe(true);
    }
  });

  it("still needs the override — delete it when brand's own pair clears AA", () => {
    // This is the retirement condition, asserted rather than written in a
    // comment nobody re-reads. The override in src/styles/globals.css exists
    // ONLY because brand's `--text-dim` does not clear AA against the ladder
    // brand ships in the version this package resolves. brand 1.3.0 already
    // moved the ladder and the token together as a matched pair; the day this
    // package resolves a brand whose own pair passes, this test goes red and
    // the fix is to delete the override, not to loosen this assertion.
    const brandFailures = THEMES.flatMap((theme) =>
      GATED.map((surface) => ratioOn(surface, BRAND_ONLY[theme])).filter(
        (ratio) => ratio < AA_NORMAL,
      ),
    );
    expect(
      brandFailures.length,
      "brand's own --text-dim now clears AA on every gated plane — remove the override block from src/styles/globals.css and this test.",
    ).toBeGreaterThan(0);
  });

  it("leaves brand's named themes on their own matched pair", () => {
    // Each named theme re-declares the surface ladder AND --text-dim together,
    // at the same specificity as `:root`. Source order alone would hand every
    // one of them this package's neutral value on their own surfaces, so the
    // override is guarded with `:not([data-theme])`. Assert the guard is on
    // every selector that could otherwise reach a named theme.
    const override = globalsCss.slice(globalsCss.indexOf("--text-dim: #"));
    const selectors = globalsCss
      .slice(0, globalsCss.indexOf("--text-dim: #"))
      .split("\n")
      .filter((line) => /^\s*(:root|\[data-|\.(dark|light))/.test(line));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      // `[data-theme="dark"]` / `[data-theme="light"]` are exact-value
      // selectors, so they can never match a named theme and need no guard.
      if (/\[data-theme="(dark|light)"\]/.test(selector)) continue;
      expect(
        selector,
        `${selector.trim()} can match a named theme — add :not([data-theme])`,
      ).toMatch(/:not\(\[data-theme\]\)/);
    }
    expect(override).toBeTruthy();
  });
});
