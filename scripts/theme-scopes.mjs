/**
 * Every theme scope a consumer of this package can select, resolved from the
 * stylesheets the package ships: brand's `tokens.css` and `named-themes.css`,
 * then this package's `src/styles/tailwind.css` overrides, in cascade order.
 *
 * A scope is what `<html data-theme="name">` receives: every rule whose
 * selector list names `:root`, a bare `[data-theme]`, `[data-theme="name"]`, or
 * this package's `:is(.dark, .light, [data-theme], …)` rebinding. These all
 * carry one class's specificity, so source order decides, as it does in the
 * browser. Rules inside `@media` are skipped (brand's only one is the
 * reduced-motion block). `hospitality` and `website` take their mode from a
 * `.dark` class rather than a theme name, so they are not scopes here.
 *
 * Colours resolve through `var()` chains to sRGB bytes, with alpha where a
 * token carries one (`#rrggbbaa`) so a translucent tint can be composited over
 * the plane it sits on rather than scored as if it were opaque.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { contrast } from "./text-dim-surfaces.mjs";

export { contrast };

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

export const SOURCES = [
  readFileSync(require.resolve("@tangle-network/brand/styles/tokens.css"), "utf8"),
  readFileSync(require.resolve("@tangle-network/brand/styles/named-themes.css"), "utf8"),
  readFileSync(join(here, "..", "src", "styles", "tailwind.css"), "utf8"),
];

/** Top-level rules as `{ selectors, body }`, skipping anything inside `@media`. */
function rules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      const prelude = css.slice(start, i).split(/[;}]/).pop().trim();
      stack.push({ prelude, bodyStart: i + 1 });
      start = i + 1;
    } else if (ch === "}") {
      const open = stack.pop();
      if (!open) throw new Error("unbalanced braces");
      const insideMedia = stack.some((s) => s.prelude.startsWith("@media"));
      const body = css.slice(open.bodyStart, i);
      if (!open.prelude.startsWith("@") && !insideMedia && !/[{}]/.test(body)) {
        out.push({ selectors: open.prelude.split(",").map((s) => s.trim()), body });
      }
      start = i + 1;
    }
  }
  if (stack.length) throw new Error("unterminated rule");
  return out;
}

const ALL_RULES = SOURCES.flatMap(rules);

/** The `data-theme` names brand declares, minus the two that key on `.dark`. */
export const THEME_NAMES = [
  ...new Set(
    ALL_RULES.flatMap((r) => r.selectors)
      .map((s) => /^\[data-theme="([a-z-]+)"\]$/.exec(s)?.[1])
      .filter(Boolean),
  ),
].filter((name) => name !== "hospitality" && name !== "website");

/** `name` null is `<html>` with no `data-theme`: only `:root` rules apply. */
function appliesTo(selector, name) {
  if (selector === ":root") return true;
  if (name === null) return false;
  if (selector === "[data-theme]" || selector === `[data-theme="${name}"]`) return true;
  const is = /^:is\((.*)\)$/.exec(selector);
  return Boolean(is && is[1].split(",").some((s) => s.trim() === "[data-theme]"));
}

/** `--token` -> raw value for one theme scope (`null` for no `data-theme`). */
export function scope(name) {
  const tokens = new Map();
  for (const { selectors, body } of ALL_RULES) {
    if (!selectors.some((s) => appliesTo(s, name))) continue;
    for (const [, token, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) {
      tokens.set(token, value.trim());
    }
  }
  return tokens;
}

const hslToRgb = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
};

/** A colour value (or `--token`) as `[r, g, b, alpha]`. */
export function resolve(value, tokens, seen = new Set()) {
  const raw = value.startsWith("--") ? tokens.get(value) : value;
  if (raw === undefined) throw new Error(`token ${value} is not declared`);
  if (value.startsWith("--")) {
    if (seen.has(value)) throw new Error(`cyclic token reference at ${value}`);
    seen.add(value);
  }
  const v = raw.trim();
  const chained = /^var\((--[\w-]+)\)$/.exec(v);
  if (chained) return resolve(chained[1], tokens, seen);
  const wrapped = /^hsl\(\s*var\((--[\w-]+)\)\s*\)$/.exec(v);
  if (wrapped) return resolve(wrapped[1], tokens, seen);
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v);
  if (hex) {
    const d = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    const bytes = [0, 2, 4].map((i) => Number.parseInt(d.slice(i, i + 2), 16));
    return [...bytes, d.length === 8 ? Number.parseInt(d.slice(6, 8), 16) / 255 : 1];
  }
  const channels = /^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/.exec(v);
  if (channels) {
    return [...hslToRgb(Number(channels[1]), Number(channels[2]) / 100, Number(channels[3]) / 100), 1];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? Number.parseFloat(rgb[4]) / 100 : Number(rgb[4]);
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
  }
  if (v === "white") return [255, 255, 255, 1];
  throw new Error(`${value} is not a resolvable colour: "${v}"`);
}

/** Source-over: a colour with alpha onto an opaque plane, as opaque bytes. */
export const over = ([r, g, b, a], plane) => {
  const base = plane.slice(0, 3);
  return [r, g, b].map((c, i) => Math.round(a * c + (1 - a) * base[i])).concat(1);
};

/**
 * The colour a Tailwind utility paints, for the utility shapes this package's
 * components use: `bg-[var(--x)]`, `bg-<name>` (through `--color-<name>`),
 * `text-white`, each with an optional `/NN` opacity. Returns `[r, g, b, alpha]`.
 */
export function utilityColor(utility, prefix, tokens) {
  const m = new RegExp(`^${prefix}-(.+?)(?:/(\\d+))?$`).exec(utility);
  if (!m) throw new Error(`${utility} is not a ${prefix}- utility`);
  const [, body, opacity] = m;
  const arbitrary = /^\[var\((--[\w-]+)\)\]$/.exec(body);
  const base =
    body === "white" ? [255, 255, 255, 1]
    : body === "black" ? [0, 0, 0, 1]
    : arbitrary ? resolve(arbitrary[1], tokens)
    : resolve(`--color-${body}`, tokens);
  return opacity === undefined ? base : [...base.slice(0, 3), base[3] * (Number(opacity) / 100)];
}

/** The one unprefixed (no `hover:`/`focus:`) utility of a family on an element. */
export function restingUtility(className, prefix) {
  const colour = (c) =>
    c.startsWith(`${prefix}-`) &&
    !/^(text|ring)-(xs|sm|base|lg|xl|\d|\[\d)/.test(c) &&
    !/^ring-(inset|offset)/.test(c) &&
    !/^(bg|text|ring)-(left|right|center|clip|gradient|opacity)/.test(c) &&
    !/^text-(wrap|nowrap|balance|ellipsis|clip)/.test(c);
  const found = className.split(/\s+/).filter(colour);
  if (found.length !== 1) throw new Error(`expected one resting ${prefix}- colour in "${className}", found ${JSON.stringify(found)}`);
  return found[0];
}
