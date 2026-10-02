import { createRequire } from "node:module"
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postcss from "postcss"
import postcssImport from "postcss-import"
import tailwindcss from "@tailwindcss/postcss"
import {
  assertBuiltAgainstPeerFloor,
  assertTextRamp,
  collectForwardedTokenUtilities,
  validateBuiltCss,
} from "./validate-built-css.mjs"

import { assertPresentationUtilities, collectPresentationUtilities } from "./presentation-css-contract.mjs"

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const srcStylesDir = join(rootDir, "src", "styles")
const distDir = join(rootDir, "dist")

// Resolve brand's tokens.css via Node's package-exports so `dist/tokens.css`
// is byte-identical to whatever brand publishes — single source of truth.
// Touching the brand package is the only way to change tokens; sandbox-ui
// only re-ships them.
const require = createRequire(import.meta.url)
const brandTokensPath = require.resolve("@tangle-network/brand/styles/tokens.css")

await mkdir(distDir, { recursive: true })
await cp(brandTokensPath, join(distDir, "tokens.css"))

const globalsCss = await readFile(join(srcStylesDir, "globals.css"), "utf8")
const from = join(srcStylesDir, "globals.css")

// `postcss-import` runs before Tailwind so the bare-specifier
// `@import "@tangle-network/brand/styles/tokens.css"` is inlined and the
// resulting tokens are visible to Tailwind v4's utility scan.
//
//  - `filter`: skip `@import "tailwindcss"` (no `.css` suffix). Tailwind v4's
//    own PostCSS plugin handles that import; if postcss-import sees it first
//    it tries to parse `tailwindcss/dist/lib.js` as CSS and dies.
//  - `resolve`: postcss-import only walks relative paths out of the box.
//    Delegate bare specifiers to Node's package-exports resolver so brand's
//    `./styles/tokens.css` export is honoured.
const resolveBareSpecifier = (id, basedir) =>
  id.startsWith(".") || id.startsWith("/") ? id : require.resolve(id, { paths: [basedir] })

const result = await postcss([
  postcssImport({
    filter: (url) => url.endsWith(".css"),
    resolve: resolveBareSpecifier,
  }),
  tailwindcss(),
]).process(globalsCss, { from })

// Build-output sanity: no URL @imports leak into dist, and every token-backed
// utility the forwarded UI source uses actually emits a rule. The second check
// reads the SAME `src/` tree the `@source` globs scan, so the requirement and
// the scan can never disagree about which version of the peer is in play.
// Resolved as a PATH rather than through package-exports, because this must be
// the same tree the `@source` glob in globals.css walks
// (`../../node_modules/@tangle-network/ui/src/**`). Going through Node's
// resolver would also fail outright — `@tangle-network/ui` does not export
// `./package.json`.
const uiDir = join(rootDir, "node_modules", "@tangle-network", "ui")
const uiSrcDir = join(uiDir, "src")

assertBuiltAgainstPeerFloor(
  JSON.parse(await readFile(join(uiDir, "package.json"), "utf8")).version,
  JSON.parse(await readFile(join(rootDir, "package.json"), "utf8"))
    .peerDependencies["@tangle-network/ui"],
)
validateBuiltCss(result.css, {
  requiredUtilities: collectForwardedTokenUtilities(uiSrcDir),
})
assertTextRamp(result.css)
// Typography fallbacks and layout variants are outside the older simple-token
// regex. Derive their classes from the actual canonical peer, not this check's
// source (scripts are excluded by source(none)).
assertPresentationUtilities(result.css, await collectPresentationUtilities(), "dist/globals.css")

await writeFile(join(distDir, "globals.css"), result.css)
await writeFile(join(distDir, "styles.css"), result.css)

// Host Tailwind entry: compile the same owned CSS, but scan the PACKED JS and
// the installed canonical peer. Neither repo source nor test fixtures ship.
const hostInput = postcss.parse(globalsCss)
const sourcePaths = new Map([
  ['"../../src/**/*.tsx"', '"./**/*.js"'],
  ['"../../src/**/*.ts"', null],
  ['"../../node_modules/@tangle-network/ui/src/**/*.tsx"', '"../../ui/src/**/*.tsx"'],
  ['"../../node_modules/@tangle-network/ui/src/**/*.ts"', '"../../ui/src/**/*.ts"'],
])
const rewritten = new Set()
hostInput.walkAtRules("source", (rule) => {
  if (!sourcePaths.has(rule.params)) return
  rewritten.add(rule.params)
  const target = sourcePaths.get(rule.params)
  if (target === null) rule.remove()
  else rule.params = target
})
if (rewritten.size !== sourcePaths.size) throw new Error("Host Tailwind source paths drifted; update the packed source mapping")
await writeFile(join(distDir, "tailwind.css"), hostInput.toString())
