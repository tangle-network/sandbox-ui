// URL that must appear in the first `@import` of the built CSS.
// Update if fonts are migrated off Google Fonts (e.g. self-hosted / Bunny Fonts).
export const REQUIRED_FIRST_IMPORT_URL = "fonts.googleapis.com"

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const FIRST_IMPORT = /^[\t ]*@import[^;]+;/m
const CHARSET_DECLARATION = /@charset\s+[^;]+;/g
const EMPTY_LAYER_DECLARATION = /@layer\b[^{;]*;/g

/**
 * Validates that a PostCSS-processed stylesheet is spec-compliant with the
 * URL `@import` (Google Fonts) preceding every other statement that would
 * invalidate it. See comment in copy-styles.mjs for why this matters.
 *
 * Throws a descriptive Error on violation. Returns nothing on success.
 */
export function validateBuiltCss(css, { requiredFirstImportUrl = REQUIRED_FIRST_IMPORT_URL } = {}) {
  // Strip block comments before scanning so `@import` / `@charset` / `@layer`
  // text inside a comment cannot trigger false positives.
  const stripped = css.replace(BLOCK_COMMENT, "")

  const firstImport = stripped.match(FIRST_IMPORT)
  if (!firstImport || !firstImport[0].includes(requiredFirstImportUrl)) {
    throw new Error(
      `dist/globals.css: expected \`@import\` referencing "${requiredFirstImportUrl}" to be the first @import in the built output. Did src/styles/globals.css reorder the imports? The URL @import must stay ahead of @import "./tokens.css" and @import "tailwindcss" so it survives PostCSS inlining.`,
    )
  }

  // Preamble = everything before the first @import (in the comment-stripped
  // view). The CSS spec allows only `@charset` and empty `@layer` statements
  // before `@import`; strip those and assert nothing meaningful remains.
  const firstImportIndex = stripped.indexOf(firstImport[0])
  const preamble = stripped
    .slice(0, firstImportIndex)
    .replace(CHARSET_DECLARATION, "")
    .replace(EMPTY_LAYER_DECLARATION, "")

  if (/\S/.test(preamble)) {
    throw new Error(
      "dist/globals.css: found CSS statements before the first @import. @import must precede all statements except @charset/empty @layer.",
    )
  }
}
