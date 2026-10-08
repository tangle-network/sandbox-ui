import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build, preview } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { chromium } from "playwright";
import { assertBuiltAgainstPeerFloor, peerFloor } from "./validate-built-css.mjs";

export function presentationConsumerSpecs(manifest) {
  return [
    ...["@tangle-network/ui", "@tangle-network/brand"].map((name) =>
      `${name}@${peerFloor(manifest.peerDependencies[name])}`,
    ),
    `tailwindcss@${peerFloor(manifest.devDependencies.tailwindcss)}`,
    `@types/react@${manifest.devDependencies["@types/react"]}`,
    `@types/react-dom@${manifest.devDependencies["@types/react-dom"]}`,
  ];
}

/** Reuse package-smoke's real tarball install; no source aliases or second install. */
export async function validatePresentationConsumer({ root, consumerDir, manifest }) {
  const versions = {};
  for (const name of ["@tangle-network/ui", "@tangle-network/brand"]) {
    const installed = JSON.parse(readFileSync(join(consumerDir, "node_modules", name, "package.json"), "utf8"));
    assertBuiltAgainstPeerFloor(installed.version, manifest.peerDependencies[name], { exact: true, packageName: name });
    versions[name] = installed.version;
  }
  const fixture = join(consumerDir, "presentation");
  mkdirSync(fixture);
  copyFileSync(join(root, "scripts/presentation-consumer.tsx"), join(fixture, "consumer.tsx"));
  execFileSync(join(root, "node_modules/.bin/tsc"), [
    "--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022", "--jsx", "react-jsx",
    "--module", "ESNext", "--moduleResolution", "bundler", "--lib", "ES2022,DOM",
    join(fixture, "consumer.tsx"),
  ], { cwd: consumerDir, stdio: "inherit" });

  // This host compiles only installed package sources, never a validator's list
  // of expected class names. The public Brand imports own the shared theme.
  writeFileSync(join(fixture, "host.css"), `
@import "tailwindcss" source(none);
@import "@tangle-network/brand/styles/tokens.css";
@import "@tangle-network/brand/styles/theme.css";
@import "@tangle-network/brand/styles/named-themes.css";
@import "@tangle-network/brand/styles/globals.css";
@source "../node_modules/@tangle-network/ui/src/**/*.tsx";
@source "../node_modules/@tangle-network/ui/src/**/*.ts";
@source "../node_modules/@tangle-network/sandbox-ui/dist/**/*.js";
`);
  // The published Tailwind source entry, written exactly as a consumer writes
  // it: no node_modules paths. Its own `@source` lines must reach this
  // package's dist and the installed ui peer.
  writeFileSync(join(fixture, "entry.css"), `
@import "tailwindcss" source(none);
@import "@tangle-network/sandbox-ui/tailwind.css";
`);
  const cssPath = join(consumerDir, "node_modules/@tangle-network/sandbox-ui/dist/globals.css");
  const cssSha256 = createHash("sha256").update(readFileSync(cssPath)).digest("hex");
  const browser = await chromium.launch({ headless: true });
  const states = [];
  try {
    for (const lane of ["compiled", "host", "entry"]) {
      writeFileSync(join(fixture, "main.tsx"), `
import React from "react";
import { createRoot } from "react-dom/client";
import { PresentationConsumer } from "./consumer";
import ${JSON.stringify(lane === "compiled" ? "@tangle-network/sandbox-ui/globals.css" : `./${lane}.css`)};
createRoot(document.getElementById("root")!).render(<PresentationConsumer />);
`);
      writeFileSync(join(fixture, "index.html"), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
      const outDir = join(fixture, `dist-${lane}`);
      await build({
        root: fixture, logLevel: "error",
        // In the compiled lane Vite consumes the published bytes without a
        // Tailwind compiler. Only the host and entry lanes emit utilities.
        css: { postcss: { plugins: lane === "compiled" ? [] : [tailwindcss()] } },
        build: { outDir, emptyOutDir: true },
      });
      if (lane === "entry") assertEntryUtilities({ consumerDir, outDir });
      const server = await preview({
        root: fixture, logLevel: "error", build: { outDir },
        preview: { host: "127.0.0.1", port: 0, strictPort: true },
      });
      try {
        const address = server.httpServer.address();
        assert(address && typeof address === "object", "preview must bind a local TCP port");
        for (const width of [390, 1280]) {
          for (const mode of ["light", "dark"]) {
            const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            try {
              await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: "networkidle" });
              await page.waitForFunction(() => document.documentElement.dataset.presentationReady === "true");
              await page.evaluate((value) => { document.documentElement.className = value; }, mode);
              // Even with reduced motion, body colors transition for 1 ms. Read
              // the settled theme after a paint rather than the previous frame.
              await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
              const measured = await page.evaluate(() => {
                const required = (selector) => {
                  const element = document.querySelector(selector);
                  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
                  return element;
                };
                const sheetSelectors = [];
                const visit = (rules) => {
                  for (const rule of rules) {
                    if ("selectorText" in rule) sheetSelectors.push(rule.selectorText);
                    if ("cssRules" in rule) visit(rule.cssRules);
                  }
                };
                for (const sheet of document.styleSheets) visit(sheet.cssRules);
                const classes = new Set([...document.querySelectorAll("[data-presentation] [class]")].flatMap((element) => [...element.classList]));
                const missing = [...classes].filter((name) => {
                  const marker = `.${CSS.escape(name)}`;
                  return !sheetSelectors.some((selector) => {
                    let start = selector.indexOf(marker);
                    while (start !== -1) {
                      const next = selector[start + marker.length];
                      if (!next || !/[\w\\-]/.test(next)) return true;
                      start = selector.indexOf(marker, start + marker.length);
                    }
                    return false;
                  });
                });
                const title = required("#page-title");
                const shell = required("[data-presentation] > div");
                const action = required("button");
                const card = required("[data-card]");
                const table = required('[role="region"]');
                const typeTokens = {
                  display: ["--font-size-display", "3rem"], hero: ["--font-size-hero", "2.5rem"],
                  page: ["--font-size-3xl", "1.875rem"], section: ["--font-size-xl", "1.25rem"],
                  subsection: ["--font-size-lg", "1rem"], eyebrow: ["--font-size-sm", "0.75rem"],
                };
                const typography = [...document.querySelectorAll("[data-type-role]")].map((element) => {
                  const role = element.dataset.typeRole;
                  const [token, fallback] = typeTokens[role];
                  const actual = getComputedStyle(element).fontSize;
                  const previous = element.style.fontSize;
                  element.style.fontSize = `var(${token},${fallback})`;
                  const expected = getComputedStyle(element).fontSize;
                  element.style.fontSize = previous;
                  return { role, actual, expected, tag: element.tagName, ariaRole: element.getAttribute("role") };
                });
                return {
                  missing, typography, classCount: classes.size,
                  h1Count: document.querySelectorAll("h1").length,
                  sectionTag: [...document.querySelectorAll("h2")].find((element) => element.textContent === "Resource limits")?.tagName,
                  padding: getComputedStyle(shell).paddingLeft,
                  shellWidth: shell.getBoundingClientRect().width,
                  bodyOverflow: document.documentElement.scrollWidth - innerWidth,
                  actionBelowTitle: action.getBoundingClientRect().top >= title.getBoundingClientRect().bottom,
                  cardRole: card.getAttribute("role"), cardTabIndex: card.tabIndex,
                  headerPadding: getComputedStyle(required("[data-card-header]")).paddingLeft,
                  contentPadding: getComputedStyle(required("[data-card-content]")).paddingLeft,
                  footerPadding: getComputedStyle(required("[data-card-footer]")).paddingLeft,
                  tableOverflow: table.scrollWidth > table.clientWidth,
                  bodyColor: getComputedStyle(document.body).color,
                  bodyBackground: getComputedStyle(document.body).backgroundColor,
                  cardBackground: getComputedStyle(card).backgroundColor,
                };
              });
              assert.deepEqual(measured.missing, [], `${lane}/${width}/${mode}: compiled utility rules are missing`);
              assert(measured.classCount > 25, "empty fixture cannot pass the utility gate");
              for (const type of measured.typography) {
                assert.equal(type.actual, type.expected, `${lane}: ${type.role} font size`);
                assert.equal(type.tag, type.role === "eyebrow" ? "P" : "H2");
                assert.equal(type.ariaRole, null, "legacy visual roles must not leak to ARIA");
              }
              assert.equal(measured.h1Count, 1);
              assert.equal(measured.sectionTag, "H2");
              assert.equal(measured.padding, width < 1024 ? "24px" : "32px");
              assert(measured.shellWidth <= Math.min(width, 1152) + 1);
              assert(measured.bodyOverflow <= 1, "table/title must not widen the document");
              if (width === 390) assert(measured.actionBelowTitle, "phone action must wrap");
              assert.equal(measured.cardRole, null);
              assert.equal(measured.cardTabIndex, -1, "decorative hover must not add a tab stop");
              assert.deepEqual([measured.headerPadding, measured.contentPadding, measured.footerPadding], ["16px", "16px", "16px"]);
              assert(measured.tableOverflow, "fixture must exercise real horizontal overflow");
              assert.notEqual(measured.cardBackground, "rgba(0, 0, 0, 0)", "card surface must be painted");
              assert.notEqual(measured.cardBackground, measured.bodyBackground, "card surface must separate from the page");
              await page.keyboard.press("Tab");
              assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Create sandbox");
              const focusVisible = await page.evaluate(() => {
                const style = getComputedStyle(document.activeElement);
                return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
              });
              assert(focusVisible, "keyboard focus must be visible");
              await page.keyboard.press("Enter");
              await page.waitForFunction(() => document.querySelector("[data-presentation]")?.getAttribute("data-action-count") === "1");
              await page.keyboard.press("Tab");
              assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Resource usage");
              await page.keyboard.press("ArrowRight");
              await page.waitForFunction(() => document.querySelector('[role="region"]').scrollLeft > 0);
              assert.deepEqual(errors, [], "packed browser consumer must not throw");
              states.push({ lane, width, mode, ...measured });
            } finally {
              await page.close();
            }
          }
        }
      } finally {
        await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
      }
    }
  } finally {
    await browser.close();
  }
  for (const lane of ["compiled", "host", "entry"]) {
    const light = states.find((state) => state.lane === lane && state.mode === "light");
    const dark = states.find((state) => state.lane === lane && state.mode === "dark");
    assert.notEqual(light.bodyColor, dark.bodyColor, `${lane}: mode switching did not resolve different colors`);
    assert.notEqual(light.cardBackground, dark.cardBackground, `${lane}: card surface did not follow the theme`);
  }
  console.log(JSON.stringify({ check: "packed-presentation", versions, cssSha256, states }, null, 2));
}

/**
 * The fixture page renders a handful of components, so the browser check above
 * cannot see whether the entry compiles what the REST of the packages write.
 * Each marker is a class written by exactly one package's shipped JS, checked
 * here before the emitted CSS is, so a marker that stops being unique fails
 * loudly instead of passing for the wrong reason.
 */
function assertEntryUtilities({ consumerDir, outDir }) {
  const assetsDir = join(outDir, "assets");
  const css = readdirSync(assetsDir).filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(assetsDir, name), "utf8")).join("\n");
  const shippedJs = (pkg) => readdirSync(join(consumerDir, "node_modules", pkg, "dist"), { recursive: true })
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(join(consumerDir, "node_modules", pkg, "dist", name), "utf8")).join("\n");
  const owners = { "@tangle-network/sandbox-ui": shippedJs("@tangle-network/sandbox-ui"), "@tangle-network/ui": shippedJs("@tangle-network/ui") };
  const markers = [
    // sandbox-ui's own components.
    { owner: "@tangle-network/sandbox-ui", candidate: "w-[268px]", selector: ".w-\\[268px\\]" },
    // ui's Dialog panel: the class that went missing when apps scanned only sandbox-ui.
    { owner: "@tangle-network/ui", candidate: "translate-x-[-50%]", selector: ".translate-x-\\[-50\\%\\]" },
  ];
  for (const { owner, candidate, selector } of markers) {
    for (const [pkg, js] of Object.entries(owners)) {
      assert.equal(js.includes(candidate), pkg === owner, `marker ${candidate} must appear only in ${owner}'s shipped JS; pick another marker`);
    }
    assert(css.includes(selector), `entry did not compile ${candidate} from ${owner}`);
  }
  // Classes no scanned file writes: the inline safelist and Brand's registrations.
  for (const selector of [".text-\\[var\\(--text-dim\\)\\]", ".bg-\\[var\\(--run-mix-failed\\)\\]", ".tangle-prose", "--md3-surface-container-low"]) {
    assert(css.includes(selector), `entry is missing ${selector}`);
  }
  // Prose lists keep their markers through Tailwind's preflight, and a long URL
  // wraps inside the column instead of running past the card edge.
  for (const [rule, pattern] of [
    ["ordered-list numbers", /\.tangle-prose ol\s*\{[^}]*list-style-type:\s*decimal/],
    ["bullet markers", /\.tangle-prose ul\s*\{[^}]*list-style-type:\s*disc/],
    ["long-word wrapping", /\.tangle-prose\s*\{[^}]*overflow-wrap:\s*break-word/],
  ]) {
    assert(pattern.test(css), `entry compiled no ${rule} for .tangle-prose`);
  }
}
