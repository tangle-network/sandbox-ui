const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const URL_IMPORT = /@import\s+url\s*\([^)]*\)\s*;?/i

/**
 * Validates that a PostCSS-processed stylesheet contains no URL `@import`
 * statements.
 *
 * URL @imports (`@import url("https://...")`) are disallowed in this
 * library's built CSS because they silently break downstream consumers.
 * When an app does `@import "@tangle-network/sandbox-ui/globals.css"` from
 * its own stylesheet, PostCSS inlines our file verbatim at the position of
 * that directive. Any `@import url(...)` in our file then ends up AFTER
 * whatever rules preceded the outer `@import` — which the CSS spec
 * disallows (`@import` must precede all rules except `@charset` / empty
 * `@layer`), and PostCSS rejects the build. The failure surfaces in the
 * consumer, not here, so we catch the pattern at our build boundary.
 *
 * Fonts are a consumer concern — see README "Fonts" for how apps should
 * load the font families this library references.
 *
 * Throws a descriptive Error on violation. Returns nothing on success.
 */
export function validateBuiltCss(css) {
  // Strip block comments so `@import url(...)` text inside a comment
  // cannot trigger a false positive.
  const stripped = css.replace(BLOCK_COMMENT, "")

  const match = stripped.match(URL_IMPORT)
  if (match) {
    throw new Error(
      `dist/globals.css: URL @import is not allowed in the built output. Found: ${match[0].trim()}. Remove it from src/styles/globals.css — fonts are loaded by the consumer, not this library. See README "Fonts".`,
    )
  }
}
