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

await writeFile(join(distDir, "globals.css"), result.css)
await writeFile(join(distDir, "styles.css"), result.css)
