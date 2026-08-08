/**
 * The planes `--text-dim` lands on, and the arithmetic for scoring it against
 * them. Shared by the browser ground truth (`text-dim-contrast.mjs`) and the
 * gate that runs on every commit (`text-dim-contrast.test.mjs`) so the two can
 * never drift into measuring different things — the browser proves this
 * arithmetic matches a real render, and the gate then runs it with no browser.
 *
 * `--text-dim` is the quietest text tier: an Input/Textarea hint, a StatCard
 * subtitle, a TerminalLine timestamp (`@tangle-network/ui` 11.2.4). None of the
 * three declares a background of its own, so the plane behind it is whatever
 * surface the composition put it on — which is why the gated set below is
 * derived from the planes this package PAINTS CONTENT ON, not from the planes
 * those three components happen to sit on in a storybook.
 */

/** WCAG 2.1 minimum for normal-size body text. */
export const AA_NORMAL = 4.5;

/**
 * WCAG contrast between two [r, g, b] byte triples.
 * Lifted verbatim from agent-app's `playground/scripts/token-render.mjs` — the
 * same helper that scored the border tiers — so one formula serves both repos.
 */
export function contrast(a, b) {
  const lum = ([r, g, b]) => {
    const lin = (c) =>
      c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every plane in the shipped ladder, with the Tailwind utility that produces it
 * (what the browser renders) and the token it resolves through (what the gate
 * reads off disk). Both are given because they are different claims: the class
 * proves the utility EXISTS, the token proves the VALUE is what we think.
 *
 * `gated` marks a plane this package paints resting content on, which is the
 * set `--text-dim` has to clear AA against. The counts below are real usages in
 * `src/` plus `@tangle-network/ui`'s `src/`, because a plane's status is a fact
 * about the codebase rather than a preference:
 *
 *   L3 `surface-container-high`/`muted`/`accent`  — 132 + 45 + 33 usages
 *   L2 `surface-container`/`card`                 —  95 + 91
 *   L4 `surface-container-highest`/`popover`      —  14 + 2, and they are not
 *      decoration: an out-of-credits MODAL, a 24rem workspace DRAWER, a w-80
 *      dashboard panel, a w-72 informative-lock panel and four dropdown menus.
 *      A form or a stat inside any of them puts a hint on this plane.
 *   L1 `surface-container-low`                    —  45
 *   L0 `background`                               —  37 + 19, and it is what
 *      `TerminalDisplay` fills its own frame with, so the timestamp lands here.
 *
 * The ungated planes are still MEASURED and printed — leaving a surface out of
 * the table is how the current value shipped — but they carry no `--text-dim`
 * text in any shipped component:
 *
 *   `surface-dim`     — 2 usages: a mono system-log view (`text-foreground`)
 *                       and a textarea fill (`placeholder:text-muted-foreground`).
 *   `surface-container-lowest` — the terminal/code well; darker than the canvas
 *                       in dark, so it is never the binding constraint there.
 *   `surface-bright`  — 0 usages as a content plane.
 */
export const DIM_SURFACES = [
  {
    key: "background (L0 canvas)",
    className: "bg-background",
    token: "--background",
    gated: true,
    renders: "TerminalLine timestamp; page-level forms",
  },
  {
    key: "surface-container-low (L1)",
    className: "bg-surface-container-low",
    token: "--md3-surface-container-low",
    gated: true,
    renders: "chrome + field wells",
  },
  {
    key: "card (L2)",
    className: "bg-card",
    token: "--card",
    gated: true,
    renders: 'StatCard subtitle, Card variant="default"',
  },
  {
    key: "surface-container (L2)",
    className: "bg-surface-container",
    token: "--md3-surface-container",
    gated: true,
    renders: "glass-card / glass-panel resting surface",
  },
  {
    key: "muted (L3)",
    className: "bg-muted",
    token: "--muted",
    gated: true,
    renders: "nested panels, hover wells",
  },
  {
    key: "surface-container-high (L3)",
    className: "bg-surface-container-high",
    token: "--md3-surface-container-high",
    gated: true,
    renders: "most-used plane in this package (132 usages)",
  },
  {
    key: "popover (L4)",
    className: "bg-popover",
    token: "--popover",
    gated: true,
    renders: "overlays",
  },
  {
    key: "surface-container-highest (L4)",
    className: "bg-surface-container-highest",
    token: "--md3-surface-container-highest",
    gated: true,
    renders: "out-of-credits modal, workspace drawer, dropdown panels",
  },
  {
    key: "card/80 on canvas",
    className: "bg-card/80",
    base: "bg-background",
    token: "--card",
    over: "--background",
    alpha: 0.8,
    gated: true,
    renders: 'Card variant="glass"',
  },
  {
    key: "muted/50 on card",
    className: "bg-muted/50",
    base: "bg-card",
    token: "--muted",
    over: "--card",
    alpha: 0.5,
    gated: true,
    renders: 'Card variant="elevated"/"sandbox", nested',
  },
  {
    key: "muted/50 on canvas",
    className: "bg-muted/50",
    base: "bg-background",
    token: "--muted",
    over: "--background",
    alpha: 0.5,
    gated: true,
    renders: 'Card variant="elevated"/"sandbox", on page',
  },
  {
    key: "surface-dim",
    className: "bg-surface-dim",
    token: "--md3-surface-dim",
    gated: false,
    renders: "system-log view, dock textarea fill — no --text-dim text",
  },
  {
    key: "surface-container-lowest",
    className: "bg-surface-container-lowest",
    token: "--md3-surface-container-lowest",
    gated: false,
    renders: "terminal / code well",
  },
  {
    key: "surface-bright",
    className: "bg-surface-bright",
    token: "--md3-surface-bright",
    gated: false,
    renders: "unused as a content plane",
  },
];

/** The gated plane a token is closest to failing on. */
export function worstSurface(rows, field) {
  return rows
    .filter((r) => r.gated)
    .map((r) => ({ surface: r.surface, ratio: r[field] ?? r.shipped }))
    .filter((r) => r.ratio !== null && r.ratio !== undefined)
    .sort((a, b) => a.ratio - b.ratio)[0];
}

/* ------------------------------------------------------------------------ *
 * Static resolution — the same numbers with no browser, for the CI gate.
 * ------------------------------------------------------------------------ */

/**
 * The two theme blocks brand declares, as `--token` -> value.
 *
 * Selectors are matched rather than assumed: dark is the block that opens on
 * `:root` and light is the `[data-theme="light"]` one. `named-themes.css`
 * re-declares several of these tokens for its opt-in re-skins and is a separate
 * file — deliberately out of scope here, since a named theme moves the surface
 * ladder and the text ramp together and has to be scored as its own pair.
 */
export function parseThemeTokens(...sources) {
  const themes = { dark: new Map(), light: new Map() };
  for (const source of sources) {
    // Comments are stripped FIRST. A selector match otherwise starts at the end
    // of the previous block, swallowing any comment in between — and the
    // comment above this package's own override discusses `[data-theme]`, which
    // is exactly the text the light/dark discrimination keys on. Left in, a
    // prose paragraph decides which theme a block belongs to.
    const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, raw, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // The capture runs from the end of the previous block, so it picks up any
      // statement in between — `@import "tailwindcss";` sits directly above this
      // package's own override. Keeping it would push `:root` into the middle of
      // the string, where the anchored test below cannot see it, and the block
      // would be silently classified as neither theme.
      const selector = raw.split(/[;}]/).pop();
      const target = /(^|,)\s*:root\b/.test(selector)
        ? "dark"
        : /\[data-theme="light"\]|\.light\b|\[data-sandbox-theme="vault"\]/.test(
              selector,
            )
          ? "light"
          : null;
      if (!target) continue;
      for (const [, token, value] of body.matchAll(
        /(--[\w-]+)\s*:\s*([^;]+);/g,
      )) {
        // Last declaration wins — the cascade for equal specificity — and
        // sources are passed in cascade order, so this package's override of a
        // brand token resolves the way a browser resolves it.
        themes[target].set(token, value.trim());
      }
    }
  }
  // Light INHERITS from the root block rather than replacing it. brand declares
  // the shadcn aliases (`--background: var(--hsl-background)`, `--card`, …)
  // exactly once, at `:root`, and the light block re-points only the `--hsl-*`
  // channels underneath them. Read as two independent maps, light is missing
  // every alias and a plane resolves to "not declared" — which is a parser bug
  // that would read as a token bug.
  return { dark: themes.dark, light: new Map([...themes.dark, ...themes.light]) };
}

const hslToRgb = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
};

/**
 * A token's value as sRGB bytes, following `var()` chains.
 *
 * Both value shapes brand ships are handled because the ladder uses both and
 * the difference is invisible until it paints: the MD3 tokens are complete
 * hexes (`#191826`) while the shadcn bridge holds raw HSL CHANNELS
 * (`244 23% 12%`) that only become a colour once an `hsl()` wraps them.
 */
export function resolveColor(token, tokens, seen = new Set()) {
  if (seen.has(token)) throw new Error(`cyclic token reference at ${token}`);
  seen.add(token);
  const raw = tokens.get(token);
  if (!raw) throw new Error(`token ${token} is not declared`);

  const chained = raw.match(/^var\((--[\w-]+)\)$/);
  if (chained) return resolveColor(chained[1], tokens, seen);

  const wrapped = raw.match(/^hsl\(\s*var\((--[\w-]+)\)\s*\)$/);
  if (wrapped) return resolveColor(wrapped[1], tokens, seen);

  const hex = raw.match(/^#([0-9a-f]{6})$/i);
  if (hex)
    return [0, 2, 4].map((i) => Number.parseInt(hex[1].slice(i, i + 2), 16));

  const channels = raw.match(
    /^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/,
  );
  if (channels)
    return hslToRgb(
      Number(channels[1]),
      Number(channels[2]) / 100,
      Number(channels[3]) / 100,
    );

  throw new Error(`token ${token} is not a resolvable colour: "${raw}"`);
}

/** Source-over compositing of an alpha fill onto an opaque plane. */
export const composite = (fg, alpha, bg) =>
  fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]));

/** The effective sRGB of one plane in one theme. */
export function resolveSurface(surface, tokens) {
  const fill = resolveColor(surface.token, tokens);
  if (surface.alpha === undefined) return fill;
  return composite(fill, surface.alpha, resolveColor(surface.over, tokens));
}
