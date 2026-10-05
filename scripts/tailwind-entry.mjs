/**
 * `@source` globs appended to the published `dist/tailwind.css`.
 *
 * Tailwind resolves an `@source` path relative to the REAL path of the file that
 * declares it. From `dist/tailwind.css` that reaches this package's own dist and
 * its `@tangle-network/ui` peer, which is a sibling directory both in pnpm's
 * virtual store and in a hoisted npm install. The nested path covers an npm
 * install that had to put a second ui version under this package. Tailwind
 * ignores a path that does not exist, so listing both costs nothing.
 *
 * JS only: the compiled `styles.css` beside this file must not feed the scan.
 */
export const TAILWIND_ENTRY_SOURCES = [
  "./**/*.js",
  "../../ui/dist/**/*.js",
  "../node_modules/@tangle-network/ui/dist/**/*.js",
]

export function withEntrySources(css) {
  const lines = TAILWIND_ENTRY_SOURCES.map((glob) => `@source "${glob}";`).join("\n")
  return `${css.trimEnd()}\n\n/* Published sources: this package's dist and its @tangle-network/ui peer. */\n${lines}\n`
}
