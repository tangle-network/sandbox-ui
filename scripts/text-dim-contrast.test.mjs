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
      const failures = GATED
        .map((surface) => ({
          surface: surface.key,
          ratio: Number(ratioOn(surface, SHIPPED[theme]).toFixed(2)),
        }))
        .filter(({ ratio }) => ratio < AA_NORMAL);

      expect(
        failures,
        `--text-dim (${SHIPPED[theme].get("--text-dim")}) is below ${AA_NORMAL}:1 on ${theme} plane(s) a shipped component renders it on. ` +
          `Re-derive it with \`node scripts/text-dim-contrast.mjs --${theme} '#rrggbb'\` and correct the value in brand's tokens.css.`,
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

  it("ships brand's value unmodified", () => {
    // The token and the surface ladder it is scored against have to come from
    // one place. A local override decouples them: the ladder keeps arriving
    // from brand while the text tier stops tracking it, so the next ladder
    // change moves every ratio here and nothing says so. This asserts the
    // decoupling cannot come back — the value a consumer resolves is the value
    // brand declares, in both themes.
    expect(
      globalsCss,
      "src/styles/globals.css declares --text-dim — correct the value in brand's tokens.css instead",
    ).not.toMatch(/--text-dim\s*:/);
    for (const theme of THEMES) {
      expect(SHIPPED[theme].get("--text-dim")).toBe(
        BRAND_ONLY[theme].get("--text-dim"),
      );
    }
  });
});

describe("--accent-text is an INK tier, on the planes this package renders it", () => {
  // The connector catalog's action is accent-coloured text on a card. It has to
  // use the ink tier rather than `--primary`, which is a FILL: primary carries
  // white on a solid button and measures 1.79:1 as text on the dark card.
  //
  // The failure mode this guards is silent. A `text-[var(--accent-text)]` whose
  // token does not resolve is not an error — the declaration is dropped and the
  // text falls back to the inherited colour, which is the same low-contrast
  // state the class was written to fix. So resolution is asserted before the
  // ratio, in both themes.
  // Resolved here so a rename fails with the reason. `resolveSurface` on a
  // missing surface throws `Cannot read properties of undefined (reading
  // 'token')`, which names neither the surface nor the gate that wanted it.
  const CARD_KEY = "card (L2)";
  const CARD = DIM_SURFACES.find((s) => s.key === CARD_KEY);
  if (!CARD) {
    throw new Error(
      `no "${CARD_KEY}" surface in DIM_SURFACES — the --accent-text gate scores against it`,
    );
  }

  for (const theme of THEMES) {
    it(`resolves to a complete colour in ${theme}`, () => {
      expect(
        () => resolveColor("--accent-text", SHIPPED[theme]),
        `--accent-text does not resolve in ${theme} — a dropped declaration leaves the action at the inherited colour`,
      ).not.toThrow();
    });

    it(`clears AA on the ${theme} card`, () => {
      const ratio = Number(
        contrast(
          resolveColor("--accent-text", SHIPPED[theme]),
          resolveSurface(CARD, SHIPPED[theme]),
        ).toFixed(2),
      );
      expect(
        ratio,
        `--accent-text (${SHIPPED[theme].get("--accent-text")}) is ${ratio}:1 on the ${theme} card, below ${AA_NORMAL}:1`,
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }

  it("is not the primary FILL token in either theme", () => {
    // The two are different roles and must not converge: if --accent-text ever
    // resolves to --primary, this file stops guarding anything and the catalog
    // action is back to 1.79:1 with every test still green.
    for (const theme of THEMES) {
      expect(
        resolveColor("--accent-text", SHIPPED[theme]),
        `--accent-text equals --primary in ${theme}: the ink tier has collapsed onto the fill`,
      ).not.toEqual(resolveColor("--primary", SHIPPED[theme]));
    }
  });
});
