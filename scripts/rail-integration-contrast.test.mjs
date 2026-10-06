/**
 * Non-text contrast (WCAG 1.4.11, 3:1) for marks whose colour alone carries
 * their meaning, plus 4.5:1 for the digit a numbered badge draws, in every theme
 * scope a consumer can select (`theme-scopes.mjs`).
 *
 * Each colour is read off the RENDERED component's class, so a component that
 * goes back to a weaker utility fails here, and each utility is resolved through
 * the token cascade this package ships, so a token change that weakens a pair
 * fails here too. The pairs:
 *
 *  - The rail badge's fill (the 1-9 pill and the 10+ dot) against the rail, and
 *    against the hover and active row tints composited over it. `bg-primary`
 *    measured 2.09:1 on the dark rail and 2.36:1 on the agents rail.
 *  - The pill's digit against its fill.
 *  - The connected integration tile's "More actions" icon against the tile.
 *    `text-muted-foreground/70` composited to 2.89:1 on the dark success tile.
 *  - The connected tile's check glyph against its circle. White on the mint
 *    circle measured 1.79:1 in dark.
 *
 * Lives in `scripts/` with the other token gates because it reads stylesheets
 * off disk, which the DOM-only package tsconfig does not type.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement as h } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RailButton } from "../src/dashboard/app-sidebar";
import { SidebarLayout } from "../src/dashboard/sidebar-layout";
import { IntegrationsCatalog } from "../src/integrations/integrations-catalog";
import { THEME_NAMES, contrast, over, restingUtility, scope, utilityColor } from "./theme-scopes.mjs";

afterEach(cleanup);

const NON_TEXT = 3;
const TEXT = 4.5;
const Icon = () => h("svg", { "data-testid": "icon" });

/** The nearest ancestor (or self) that paints a resting background. */
function paintedPlane(el) {
  for (let node = el; node; node = node.parentElement) {
    const cls = typeof node.className === "string" ? node.className : "";
    const bgs = cls.split(/\s+/).filter((c) => /^bg-/.test(c) && !/^bg-(transparent|clip|gradient|none)/.test(c));
    if (bgs.length) return restingUtility(cls, "bg");
  }
  throw new Error("no painted plane above the element");
}

function hoverUtility(className, prefix) {
  const found = className.split(/\s+/).filter((c) => c.startsWith(`hover:${prefix}-`));
  if (found.length !== 1) throw new Error(`expected one hover:${prefix}- in "${className}"`);
  return found[0].slice("hover:".length);
}

/** Classes as rendered, read once; each theme then resolves them. */
function renderedClasses() {
  // Rail plane and row tints: a SidebarLayout with an active and an idle item.
  render(
    h(SidebarLayout, {
      navItems: [
        { id: "idle", label: "idle", icon: Icon, href: "/idle", badge: 3 },
        { id: "here", label: "here", icon: Icon, href: "/here", badge: 3 },
      ],
      activeId: "here",
      hideBelow: "lg",
    }, h("div", null, "content")),
  );
  const idle = screen.getAllByRole("link", { name: "idle, 3 new" })[0];
  const here = screen.getAllByRole("link", { name: "here, 3 new" })[0];
  const rail = paintedPlane(idle.parentElement);
  const hoverTint = hoverUtility(idle.className, "bg");
  const activeTint = restingUtility(here.className, "bg");
  cleanup();

  // The marks, in the icon-only rail where the dot is drawn.
  render(h("div", null, h(RailButton, { icon: Icon, label: "Pill", badge: 3 }), h(RailButton, { icon: Icon, label: "Dot", badge: 12 })));
  const pill = screen.getByRole("button", { name: "Pill, 3 new" }).querySelector('[data-badge="count"]');
  const dot = screen.getByRole("button", { name: "Dot, 12 new" }).querySelector('[data-badge="dot"]');
  const marks = {
    pillFill: restingUtility(pill.className, "bg"),
    pillDigit: restingUtility(pill.className, "text"),
    dotFill: restingUtility(dot.className, "bg"),
  };
  cleanup();

  // A connected integration tile with its menu and check mark.
  const connection = {
    id: "c1", accountDisplay: "ops@example.com", statusLabel: "Connected",
    capabilities: { manage: true, disconnect: true, test: true, editPermissions: true, resetPermissions: true },
  };
  render(
    h(IntegrationsCatalog, {
      rows: [{ kind: "provider", providerId: "slack", title: "Slack", connections: [connection], selectedConnectionId: "c1", canConnect: true }],
      query: "", onQueryChange: () => {}, onSelectConnection: () => {}, onDisconnect: () => {}, layout: "tiles",
    }),
  );
  const tile = screen.getByTestId("integration-slack");
  const menu = screen.getByRole("button", { name: "More actions for Slack" });
  const check = tile.querySelector("span.pointer-events-none.rounded-full");
  if (!check) throw new Error("connected tile renders no check mark");
  const tiles = {
    tile: restingUtility(tile.className, "bg"),
    menuIcon: restingUtility(menu.className, "text"),
    checkCircle: restingUtility(check.className, "bg"),
    checkGlyph: restingUtility(check.className, "text"),
  };
  cleanup();
  return { rail, hoverTint, activeTint, ...marks, ...tiles };
}

const scopes = [null, ...THEME_NAMES];

describe("rail badge and connected-tile marks clear contrast in every theme scope", () => {
  const classes = renderedClasses();

  it("covers the default scope and every named theme, dark and light", () => {
    expect(THEME_NAMES).toEqual(expect.arrayContaining(["dark", "light", "agents", "agents-light"]));
  });

  for (const name of scopes) {
    it(name ?? "no data-theme (:root)", () => {
      const t = scope(name);
      const opaque = (u, prefix, plane) => over(utilityColor(u, prefix, t), plane);
      const rail = utilityColor(classes.rail, "bg", t);
      expect(rail[3], `${classes.rail} is opaque`).toBe(1);
      const rows = {
        rail,
        "hover row": opaque(classes.hoverTint, "bg", rail),
        "active row": opaque(classes.activeTint, "bg", rail),
      };
      const ratios = {};
      for (const [row, plane] of Object.entries(rows)) {
        const pill = opaque(classes.pillFill, "bg", plane);
        ratios[`pill fill (${classes.pillFill}) on ${row}`] = [contrast(pill, plane), NON_TEXT];
        ratios[`dot fill (${classes.dotFill}) on ${row}`] = [contrast(opaque(classes.dotFill, "bg", plane), plane), NON_TEXT];
        ratios[`pill digit (${classes.pillDigit}) on its fill`] = [contrast(opaque(classes.pillDigit, "text", pill), pill), TEXT];
      }
      const tile = utilityColor(classes.tile, "bg", t);
      expect(tile[3], `${classes.tile} is opaque`).toBe(1);
      ratios[`menu icon (${classes.menuIcon}) on connected tile`] = [contrast(opaque(classes.menuIcon, "text", tile), tile), NON_TEXT];
      const circle = opaque(classes.checkCircle, "bg", tile);
      ratios[`check glyph (${classes.checkGlyph}) on its circle`] = [contrast(opaque(classes.checkGlyph, "text", circle), circle), NON_TEXT];

      const failures = Object.entries(ratios)
        .filter(([, [ratio, min]]) => ratio < min)
        .map(([pair, [ratio, min]]) => `${pair}: ${ratio.toFixed(2)} < ${min}`);
      expect(failures, `${name ?? ":root"}`).toEqual([]);
    });
  }
});
