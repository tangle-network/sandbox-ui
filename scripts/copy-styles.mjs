import { createRequire } from "node:module"
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postcss from "postcss"
import postcssImport from "postcss-import"
import tailwindcss from "@tailwindcss/postcss"
import { validateBuiltCss } from "./validate-built-css.mjs"

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

// Build-output sanity: no URL @imports leak into dist (see validator for why).
validateBuiltCss(result.css)

await writeFile(join(distDir, "globals.css"), result.css)
await writeFile(join(distDir, "styles.css"), result.css)
