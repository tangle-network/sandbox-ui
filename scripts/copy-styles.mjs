import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postcss from "postcss"
import tailwindcss from "@tailwindcss/postcss"

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const srcStylesDir = join(rootDir, "src", "styles")
const distDir = join(rootDir, "dist")

await mkdir(distDir, { recursive: true })
await cp(join(srcStylesDir, "tokens.css"), join(distDir, "tokens.css"))

const globalsCss = await readFile(join(srcStylesDir, "globals.css"), "utf8")
const from = join(srcStylesDir, "globals.css")

// Run PostCSS with Tailwind v4 to resolve @import "tailwindcss" and generate
// all utility classes referenced in src/**/*.tsx
const result = await postcss([tailwindcss()]).process(globalsCss, { from })

// The Google Fonts `@import url(...)` in src/styles/globals.css must remain
// above every inlined stylesheet so the built CSS is spec-compliant (@import
// must precede all rules except @charset / empty @layer). If someone moves
// the source @import below `@import "./tokens.css"` or `@import "tailwindcss"`
// the built file silently places the URL @import after ~thousands of rules
// and downstream bundlers (Vite, webpack) drop it — fonts stop loading in
// consumers that rely on this library to fetch them. Fail loudly here.
const firstImport = result.css.match(/^@import[^;]+;/m)
if (!firstImport || !firstImport[0].includes("fonts.googleapis.com")) {
  throw new Error(
    "dist/globals.css: expected Google Fonts `@import url(...)` to be the first @import in the built output. Did src/styles/globals.css reorder the imports? The URL @import must stay ahead of @import \"./tokens.css\" and @import \"tailwindcss\" so it survives PostCSS inlining.",
  )
}
const firstImportIndex = result.css.indexOf(firstImport[0])
const preamble = result.css.slice(0, firstImportIndex)
if (/[{};][^\/*]/.test(preamble.replace(/\/\*[\s\S]*?\*\//g, ""))) {
  throw new Error(
    "dist/globals.css: found CSS statements before the first @import. @import must precede all statements except @charset/empty @layer.",
  )
}

await writeFile(join(distDir, "globals.css"), result.css)
await writeFile(join(distDir, "styles.css"), result.css)
