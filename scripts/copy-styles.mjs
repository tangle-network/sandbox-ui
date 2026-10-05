import { createRequire } from "node:module"
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postcss from "postcss"
import tailwindcss from "@tailwindcss/postcss"
import {
  assertBuiltAgainstPeerFloor,
  assertTextRamp,
  collectForwardedTokenUtilities,
  validateBuiltCss,
} from "./validate-built-css.mjs"

import { withEntrySources } from "./tailwind-entry.mjs"

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

// Tailwind resolves every `@import` itself, through package exports, exactly as
// it does in a consumer that compiles the `./tailwind.css` source entry. Using
// the consumer's own resolution path here keeps the precompiled bundle and the
// source entry from drifting apart.
const result = await postcss([tailwindcss()]).process(globalsCss, { from })

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

const manifest = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8"))
for (const packageName of ["@tangle-network/ui", "@tangle-network/brand"]) {
  const peer = JSON.parse(await readFile(join(rootDir, "node_modules", packageName, "package.json"), "utf8"))
  assertBuiltAgainstPeerFloor(peer.version, manifest.peerDependencies[packageName], {
    exact: true,
    packageName,
  })
}
validateBuiltCss(result.css, {
  requiredUtilities: collectForwardedTokenUtilities(uiSrcDir),
})
assertTextRamp(result.css)

await writeFile(join(distDir, "globals.css"), result.css)
await writeFile(join(distDir, "styles.css"), result.css)

// The Tailwind SOURCE entry: the same runtime CSS as the bundle above,
// uncompiled, plus the `@source` lines a consumer's Tailwind needs to compile
// every utility these components write. @see TAILWIND_ENTRY_SOURCES.
const tailwindEntry = await readFile(join(srcStylesDir, "tailwind.css"), "utf8")
await writeFile(join(distDir, "tailwind.css"), withEntrySources(tailwindEntry))
