from pathlib import Path
import json
assert __import__('subprocess').check_output(['git','hash-object','src/styles/globals.css'],text=True).strip() == 'd5a0390bbb3f792b740b6833824992cc574c41ec'
p=Path('package.json'); d=json.loads(p.read_text());
assert d['version'] == '0.117.0'
for group in ('peerDependencies','devDependencies'):
 d[group]['@tangle-network/ui']='^11.13.0'; d[group]['@tangle-network/brand']='^1.10.0'
d['scripts']['test:presentation']='node --test scripts/presentation-css-contract.test.mjs && vitest run src/primitives/heading.test.tsx src/primitives/presentation-compatibility.test.tsx src/__tests__/re-export-identity.test.ts src/__tests__/ui-export-parity.test.ts && node scripts/presentation-package-smoke.mjs'
p.write_text(json.dumps(d,indent=2)+'\n')
p=Path('src/index.ts');s=p.read_text();s=s.replace('  CardTitle,\n','  CardTitle,\n  type CardTitleProps,\n');s=s.replace('  FilterField,\n','  Heading,\n  type HeadingProps,\n  type HeadingVariant,\n  PageHeader,\n  type PageHeaderProps,\n  PageShell,\n  type PageShellProps,\n  SectionTitle,\n  type SectionTitleProps,\n  FilterField,\n');s=s.replace('  Table,\n','  Table,\n  type TableProps,\n');p.write_text(s)
p=Path('src/__tests__/ui-export-parity.test.ts');s=p.read_text();start=s.index(' * different component from the one');end=s.index('const INTENDED_SHADOWS:',start);s=s[:start]+''' * different component from the one the upstream docs describe. Only the
 * Sandbox wordmark and its strict legacy HeadingProps type remain local.
 * HeadingProps intentionally keeps required role/children and the six-value
 * visual role union. The Heading runtime binding itself is canonical UI.
 */
'''+s[end:];s=s.replace('["Logo", "LogoProps", "PageHeader", "PageHeaderProps", "TangleKnot"]','["HeadingProps", "Logo", "LogoProps", "TangleKnot"]');s='\n'.join(line for line in s.split('\n') if not line.strip().startswith(('PageHeader: "root carries','PageHeaderProps: "root carries')));p.write_text(s)
p=Path('src/__tests__/re-export-identity.test.ts');s=p.read_text();s=s.replace('import { describe, expect, test } from "vitest";','''import { describe, expect, test } from "vitest";
import * as SandboxPrimitives from "@tangle-network/sandbox-ui/primitives";
import * as SandboxRoot from "@tangle-network/sandbox-ui";
import * as UiPrimitives from "@tangle-network/ui/primitives";''');s+='''
const presentationBindings = [
  "Heading", "PageHeader", "PageShell", "Card", "CardHeader", "CardContent",
  "CardFooter", "CardTitle", "CardDescription", "Table", "TableHeader",
  "TableBody", "TableFooter", "TableHead", "TableRow", "TableCell", "TableCaption",
] as const;

describe("canonical presentation through built public imports", () => {
  for (const name of presentationBindings) {
    test(`${name} is the upstream binding at both public entries`, () => {
      expect(UiPrimitives[name]).toBeDefined();
      expect(SandboxPrimitives[name]).toBe(UiPrimitives[name]);
      expect(SandboxRoot[name]).toBe(UiPrimitives[name]);
    });
  }
});
''';p.write_text(s)
p=Path('src/styles/globals.css');s=p.read_text();s=s.replace('@import "tailwindcss" source(none);','''@import "tailwindcss" source(none);
/* Canonical generic presentation; local rules below are Sandbox compatibility
 * or agent-specific composition, not copies of Brand's base/theme/prose. */
@import "@tangle-network/brand/styles/theme.css";
@import "@tangle-network/brand/styles/globals.css";''');a=s.index('/* Tailwind v4 utility generation');b=s.index('/* ── Motion',a);s=s[:a]+'''/* Legacy surface aliases not exported by Brand's theme. Keep the public
 * utility names without duplicating the canonical semantic/container map. */
@theme {
  --color-surface: var(--md3-surface);
  --color-surface-dim: var(--md3-surface-dim);
  --color-surface-bright: var(--md3-surface-bright);
}

'''+s[b:];a=s.index('@layer base {');b=s.index('@layer utilities {',a);s=s[:a]+'''@layer base {
  :root {
    --sandbox: var(--primary);
    --sandbox-glow: var(--info);
  }

  /* Published Sandbox scrollbar treatment; all generic base/focus rules are
   * supplied by Brand's exported globals.css above. */
  ::-webkit-scrollbar-thumb {
    background: hsl(var(--border) / 0.6);
    border-radius: 9999px;
  }
  * {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--border) / 0.6) transparent;
  }
}

'''+s[b:];s=s.replace('  .text-gradient-sandbox,\n  .text-gradient-brand {','  .text-gradient-sandbox {');a=s.index('  /* Status dots — operational state indicators */');b=s.index('  .status-dot-creating',a);s=s[:a]+'''  /* Brand owns the dot anatomy. Sandbox keeps operational extensions below
   * and its published quiet running/error treatment (no status halos). */
  .status-dot-running,
  .status-dot-error {
    box-shadow: none;
  }

'''+s[b:];s=s.replace('  .status-dot-stopped {\n    background: var(--status-stopped);\n  }\n\n','');s=s.replace('  .status-dot-error {\n    background: var(--status-error);\n  }\n\n','');a=s.index('/* Markdown prose — styles the `tangle-prose`');s=s[:a]+'''/* Compatibility deltas only; Brand's exported globals owns prose/table
 * anatomy. Preserve Sandbox's scoped colors and the published paragraph-gap
 * fix: Brand 1.10's p/ul/ol reset outranks its own owl selector. The more
 * specific direct-child override restores that gap without copying a renderer
 * or a second prose stylesheet. Remove deltas only after equivalent upstream
 * behavior is available at the declared Brand floor. */
.tangle-prose { color: hsl(var(--foreground)); }
.tangle-prose > :is(p, ul, ol):not(:first-child) { margin-top: 0.85em; }
.tangle-prose :is(h1, h2, h3, h4, table, th) { color: inherit; }
.tangle-prose blockquote { color: hsl(var(--muted-foreground)); }
.tangle-prose :not(pre) > code { background: var(--md3-surface-container-high); }
''';p.write_text(s)

import subprocess
PATCH = r'''diff --git a/CHANGELOG.md b/CHANGELOG.md
index dc93e2d..90c8f7e 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,5 +1,11 @@
 # Changelog
 
+## Unreleased
+
+- Consume canonical UI Heading, PageHeader and PageShell while preserving legacy imports and props; compose SectionTitle through the canonical header. Card/table remain upstream bindings.
+- Consolidate generic theme, base, focus and prose CSS through Brand exports, retaining explicit Sandbox compatibility deltas and agent motion.
+- Add an opt-in host `tailwind.css` source entry and packed peer-floor type/CSS/browser validation. This future migration requires UI ^11.13.0 and Brand ^1.10.0; it does not change the frozen 0.117.0 publication cut.
+
 ## 0.117.0
 
 - Add `AgentMessagingConnection` through the package root and `/connections` subpath.
diff --git a/README.md b/README.md
index 5aefba4..253b885 100644
--- a/README.md
+++ b/README.md
@@ -18,7 +18,7 @@ React component library for [Tangle Sandbox](https://sandbox.tangle.tools) — a
 npm install @tangle-network/sandbox-ui
 ```
 
-**Required peers:** `react` and `react-dom` 18 or 19, `@tangle-network/agent-interface ^1.0.0 || ^2.0.0`, `@tangle-network/brand ^1.6.0`, and `@tangle-network/ui ^11.10.0`.
+**Required peers:** `react` and `react-dom` 18 or 19, `@tangle-network/agent-interface ^1.0.0 || ^2.0.0`, `@tangle-network/brand ^1.10.0`, and `@tangle-network/ui ^11.13.0`.
 Optional peers are required only by the subpaths that use them; see [package.json](./package.json). `/editor` needs its tiptap, `yjs` and `@hocuspocus/provider` peers only when it renders an editor, and the `@tangle-network/ui` README holds the table of which surface needs which.
 
 ## Usage
@@ -38,6 +38,38 @@ Import styles in your app root:
 import "@tangle-network/sandbox-ui/styles";
 ```
 
+### Canonical presentation and Tailwind
+
+`Heading`, `PageHeader`, `PageShell`, Card parts, and Table parts are exact
+`@tangle-network/ui/primitives` bindings, available through `/primitives` and
+additively through the package root. Existing `role`, `action`, `eyebrow`,
+`titleAs`, semantic levels, native attributes and refs remain supported.
+`SectionTitle` adapts its legacy API to canonical `PageHeader level={2}`; it no
+longer maintains heading markup. The named Sandbox `HeadingProps` type retains
+its required six-value visual `role` and `children` contract.
+
+Use **one** stylesheet path. `styles` and `globals.css` are identical precompiled
+CSS for the declared peer floors. Applications resolving newer UI versions
+should compile the installed sources so new peer utilities are included.
+For Tailwind v4 hosts, the opt-in `tailwind.css` entry composes the same Brand
+CSS and Sandbox compatibility rules, scanning packed Sandbox JS and the
+installed UI source without needing this repository:
+
+```css
+/* app.css, processed by @tailwindcss/postcss */
+@import "@tangle-network/sandbox-ui/tailwind.css";
+@source "./**/*.{ts,tsx}";
+/* Add application-specific @theme overrides here, after the canonical theme. */
+```
+
+Do not also import the precompiled bundle or another Tailwind reset in this
+mode. The source entry deliberately contains Tailwind directives; it is not a
+ready-to-link browser stylesheet. The existing `./tailwind` CommonJS config
+remains available for legacy consumers; this migration does not rewrite it.
+`PageShell` is optional width/gutters/rhythm, not routing, navigation, auth, or
+an application shell. Existing workspace and agent compositions stay separate.
+See [migration decisions and caller inventory](docs/presentation-migration.md).
+
 ### Workspace integration access
 
 Use `IntegrationsPanel` from `/integrations` for the provider catalog, logos, search, connection status, and account actions.
@@ -142,34 +174,29 @@ sandbox-ui references the following font families in its design tokens but does
 
 | Family       | Role                                | Used as CSS variable |
 | ------------ | ----------------------------------- | -------------------- |
-| Geist        | UI body text                        | `--font-sans`        |
-| Geist Mono   | Code, terminal                      | `--font-mono`        |
-| Outfit       | Display / headings (default theme)  | `--font-display`     |
-| Manrope      | Display / headings (vault theme)    | `--font-display`     |
-| Inter        | UI body (vault theme)               | `--font-sans`        |
+| Inter        | Canonical body and generic headings | `--font-sans`, `--font-display` |
+| Geist        | Body/display fallback               | `--font-sans`, `--font-display` |
+| Geist Mono   | Code and terminal                   | `--font-mono` |
+
+Legacy host overrides may still select Outfit or Manrope; load those only when
+the host explicitly selects them. Brand owns the default family chain.
 
 Pick one loading strategy that fits your app:
 
 **1. Self-hosted via `@fontsource/*`** (recommended — no external network request):
 
 ```bash
-npm install @fontsource/geist-sans @fontsource/geist-mono @fontsource/outfit @fontsource/manrope @fontsource/inter
+npm install @fontsource/geist-mono @fontsource/inter
 ```
 
 ```tsx
 // app entry
-import "@fontsource/geist-sans/400.css";
-import "@fontsource/geist-sans/500.css";
-import "@fontsource/geist-sans/600.css";
-import "@fontsource/geist-sans/700.css";
 import "@fontsource/geist-mono/400.css";
 import "@fontsource/geist-mono/500.css";
-import "@fontsource/outfit/500.css";
-import "@fontsource/outfit/700.css";
-import "@fontsource/manrope/500.css";
-import "@fontsource/manrope/700.css";
 import "@fontsource/inter/400.css";
+import "@fontsource/inter/500.css";
 import "@fontsource/inter/600.css";
+import "@fontsource/inter/700.css";
 ```
 
 **2. Google Fonts via HTML `<link>`:**
@@ -180,7 +207,7 @@ import "@fontsource/inter/600.css";
 <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" />
 ```
 
-Any family you omit falls back per the `--font-*` token chain (e.g. `--font-sans` falls back to `"DM Sans", ui-sans-serif, system-ui, sans-serif`).
+Any family you omit falls back per the `--font-*` token chain (e.g. `--font-sans` falls back to the system sans-serif stack).
 
 If you are building on the sandbox SDK directly, use `useSdkSession` to turn raw SDK/session-gateway events into the `messages + partMap` model that `ChatContainer` and `SandboxWorkbench` expect:
 
diff --git a/scripts/copy-styles.mjs b/scripts/copy-styles.mjs
index 8360774..4215928 100644
--- a/scripts/copy-styles.mjs
+++ b/scripts/copy-styles.mjs
@@ -12,6 +12,8 @@ import {
   validateBuiltCss,
 } from "./validate-built-css.mjs"
 
+import { assertPresentationUtilities, collectPresentationUtilities } from "./presentation-css-contract.mjs"
+
 const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
 const srcStylesDir = join(rootDir, "src", "styles")
 const distDir = join(rootDir, "dist")
@@ -71,6 +73,30 @@ validateBuiltCss(result.css, {
   requiredUtilities: collectForwardedTokenUtilities(uiSrcDir),
 })
 assertTextRamp(result.css)
+// Typography fallbacks and layout variants are outside the older simple-token
+// regex. Derive their classes from the actual canonical peer, not this check's
+// source (scripts are excluded by source(none)).
+assertPresentationUtilities(result.css, await collectPresentationUtilities(), "dist/globals.css")
 
 await writeFile(join(distDir, "globals.css"), result.css)
 await writeFile(join(distDir, "styles.css"), result.css)
+
+// Host Tailwind entry: compile the same owned CSS, but scan the PACKED JS and
+// the installed canonical peer. Neither repo source nor test fixtures ship.
+const hostInput = postcss.parse(globalsCss)
+const sourcePaths = new Map([
+  ['"../../src/**/*.tsx"', '"./**/*.js"'],
+  ['"../../src/**/*.ts"', null],
+  ['"../../node_modules/@tangle-network/ui/src/**/*.tsx"', '"../../ui/src/**/*.tsx"'],
+  ['"../../node_modules/@tangle-network/ui/src/**/*.ts"', '"../../ui/src/**/*.ts"'],
+])
+const rewritten = new Set()
+hostInput.walkAtRules("source", (rule) => {
+  if (!sourcePaths.has(rule.params)) return
+  rewritten.add(rule.params)
+  const target = sourcePaths.get(rule.params)
+  if (target === null) rule.remove()
+  else rule.params = target
+})
+if (rewritten.size !== sourcePaths.size) throw new Error("Host Tailwind source paths drifted; update the packed source mapping")
+await writeFile(join(distDir, "tailwind.css"), hostInput.toString())
diff --git a/scripts/package-smoke.mjs b/scripts/package-smoke.mjs
index dbec867..f030785 100644
--- a/scripts/package-smoke.mjs
+++ b/scripts/package-smoke.mjs
@@ -258,7 +258,9 @@ try {
     const target = exportTarget(value);
     if (target?.endsWith(".js")) {
       jsSpecifiers.push(packageSpecifier(manifest.name, subpath));
-    } else if (target?.endsWith(".css")) {
+    } else if (target?.endsWith(".css") && subpath !== "./tailwind.css") {
+      // The opt-in Tailwind source entry is compiled independently by
+      // presentation-package-smoke.mjs, not treated as precompiled CSS.
       cssSpecifiers.push(packageSpecifier(manifest.name, subpath));
     }
   }
'''
subprocess.run(['git','apply','--check','-'], input=PATCH,text=True,check=True)
subprocess.run(['git','apply','-'],input=PATCH,text=True,check=True)
p=Path('package.json');d=json.loads(p.read_text());d['exports']['./tailwind.css']='./dist/tailwind.css';d['scripts']['test:presentation']=d['scripts']['test:presentation'].replace('presentation-css-contract.test.mjs','presentation-css-contract.spec.mjs');p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
