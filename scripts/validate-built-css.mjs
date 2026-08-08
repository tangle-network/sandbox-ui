import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const URL_IMPORT = /@import\s+url\s*\([^)]*\)\s*;?/i

/**
 * A token-backed arbitrary utility: `text-[var(--text-dim)]`,
 * `bg-[var(--brand-glow)]`, `h-[var(--avatar-size)]`, `text-[color:var(--x)]`.
 *
 * Deliberately only the SIMPLE shape. A utility carrying a fallback
 * (`text-[var(--brand-cool,hsl(var(--primary)))]`) still emits; it is just not
 * required, because matching its escaped form means re-implementing Tailwind's
 * normalisation and a brittle check that fails on a formatting change is worse
 * than no check.
 */
const TOKEN_UTILITY =
  /(?:^|["'\s`])((?:[a-z]+-)*[a-z]+-\[(?:color:)?var\((--[\w-]+)\)\])/g

/**
 * The brand text ramp, which the bundle must carry whatever `@tangle-network/ui`
 * happens to be installed at build time.
 *
 * These are declared with `@source inline(...)` in `src/styles/globals.css`
 * rather than discovered by the scan, so they are asserted from the built bytes
 * here — a safelist nobody checks is a safelist that gets deleted in a cleanup.
 * Their failure mode is the reason they are special-cased: an un-emitted colour
 * utility leaves the element at the INHERITED colour, so the text renders at
 * body weight and the tier silently disappears. Nothing looks broken, no
 * contrast check fires, and the hierarchy is simply gone.
 */
export const REQUIRED_TEXT_RAMP = [
  "text-[var(--text-primary)]",
  "text-[var(--text-secondary)]",
  "text-[var(--text-muted)]",
  "text-[var(--text-dim)]",
]

/**
 * The text ramp must be present in the built bytes, whatever ui was installed.
 * Separate from `validateBuiltCss` because it is unconditional: there is no
 * caller and no fixture for which an absent text ramp is acceptable, so it
 * takes no options to forget to pass.
 */
export function assertTextRamp(css) {
  const missing = REQUIRED_TEXT_RAMP.filter(
    (utility) => !css.includes(escapeUtility(utility)),
  )
  if (missing.length > 0) {
    throw new Error(
      `dist/globals.css: the brand text ramp is missing ${missing.join(", ")}. ` +
        `These are emitted via \`@source inline(...)\` in src/styles/globals.css precisely because the ` +
        `@tangle-network/ui scan only covers the version installed at build time. Restore those lines — ` +
        `without them a consumer on a newer ui renders that tier at inherited body colour.`,
    )
  }
}

/** A source file whose classes reach a consumer's screen. */
const RENDERABLE = /\.tsx?$/
const NOT_RENDERABLE = /\.(test|spec|stories)\.tsx?$/

/**
 * How Tailwind writes a class name into a selector: every character that is not
 * alphanumeric, `_` or `-` is backslash-escaped. `text-[var(--text-dim)]`
 * becomes `.text-\[var\(--text-dim\)\]`.
 *
 * The leading dot is deliberately NOT included, so the marker also matches the
 * same utility behind a variant (`.hover\:bg-\[var\(--x\)\]:hover`) — a utility
 * only ever used with a variant would otherwise read as missing.
 */
export const escapeUtility = (utility) =>
  utility.replace(/[^\w-]/g, (c) => `\\${c}`)

/**
 * Every token-backed utility the forwarded `@tangle-network/ui` source uses.
 *
 * This is derived rather than hand-listed, and that is the whole point. The
 * predecessor was a literal list of six markers, and the defect it was supposed
 * to prevent shipped anyway: `@tangle-network/ui` 11.2.4 restyled the Input
 * hint, the StatCard subtitle and the TerminalLine timestamp onto
 * `text-[var(--text-dim)]`, nobody added that string to the list, and the built
 * bundle emitted no rule for it. Consumers who do not run their own Tailwind
 * scan over `@tangle-network/ui` (physim, blueprint-agent) therefore rendered
 * those three at body-text colour — not a contrast failure, a lost hierarchy,
 * and invisible to every check that existed.
 *
 * A list that has to be maintained by the person who did not write the change
 * is not a gate. Reading the source is.
 */
export function collectForwardedTokenUtilities(uiSrcDir) {
  const utilities = new Map()
  let entries
  try {
    entries = readdirSync(uiSrcDir, { recursive: true, withFileTypes: true })
  } catch {
    // The caller decides whether an unresolvable peer is fatal; returning an
    // empty set here would silently downgrade the check to "nothing required".
    return null
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!RENDERABLE.test(entry.name) || NOT_RENDERABLE.test(entry.name)) continue
    const file = join(entry.parentPath ?? entry.path, entry.name)
    for (const [, utility] of readFileSync(file, "utf8").matchAll(TOKEN_UTILITY)) {
      if (!utilities.has(utility)) utilities.set(utility, file)
    }
  }
  return utilities
}

const parseVersion = (v) => v.replace(/^[^\d]*/, "").split(".").map(Number)

/**
 * The precompiled CSS only carries the utilities of the `@tangle-network/ui`
 * it was BUILT against, so the floor this package declares to consumers has to
 * be a version it actually scanned. That is the whole mechanism behind the
 * missing `text-[var(--text-dim)]` rule: sandbox-ui resolved ui 11.2.0 while
 * consumers installed 11.2.4, the peer range `^11.0.0` permitted both, and the
 * three primitives 11.2.4 restyled onto that token rendered at the inherited
 * body colour for anyone who does not run their own Tailwind scan over
 * `@tangle-network/ui` (physim, blueprint-agent).
 *
 * Building against something older than the declared floor makes the bundle a
 * promise the build did not keep, so it fails here rather than in a consumer.
 * The reverse — building against something NEWER — is safe: the extra rules are
 * dead bytes for a consumer on an older ui, never a missing one.
 */
export function assertBuiltAgainstPeerFloor(resolvedVersion, peerRange) {
  const [rMajor, rMinor, rPatch] = parseVersion(resolvedVersion)
  const [fMajor, fMinor, fPatch] = parseVersion(peerRange)
  const older =
    rMajor < fMajor ||
    (rMajor === fMajor &&
      (rMinor < fMinor || (rMinor === fMinor && rPatch < fPatch)))
  if (rMajor !== fMajor || older) {
    throw new Error(
      `dist/globals.css was built against @tangle-network/ui ${resolvedVersion}, but package.json declares the peer floor "${peerRange}". ` +
        `The precompiled bundle only emits utilities from the source it scanned, so a consumer on the floor version would be missing rules. ` +
        `Install a ui that satisfies the floor and rebuild, or lower the floor to what you build against.`,
    )
  }
}

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
export function validateBuiltCss(css, options = {}) {
  // Strip block comments so `@import url(...)` text inside a comment
  // cannot trigger a false positive.
  const stripped = css.replace(BLOCK_COMMENT, "")

  const match = stripped.match(URL_IMPORT)
  if (match) {
    throw new Error(
      `dist/globals.css: URL @import is not allowed in the built output. Found: ${match[0].trim()}. Remove it from src/styles/globals.css — fonts are loaded by the consumer, not this library. See README "Fonts".`,
    )
  }

  // Checked BEFORE the truthiness guard, because `null` is falsy: folding the
  // two into one `if` is how the collector's failure signal silently became
  // "nothing is required", which is the failure mode this whole check exists
  // to prevent, turned on itself.
  if (options.requiredUtilities === null) {
    throw new Error(
      `dist/globals.css: could not read @tangle-network/ui source, so the forwarded-utility check could not run. A check that cannot run must not pass — install the peer and rebuild.`,
    )
  }

  if (options.requiredUtilities) {
    const missing = [...options.requiredUtilities].filter(
      ([utility]) => !css.includes(escapeUtility(utility)),
    )
    if (missing.length > 0) {
      const detail = missing
        .map(([utility, file]) => `  ${utility}  (${file})`)
        .join("\n")
      throw new Error(
        `dist/globals.css: ${missing.length} token utility(ies) used by @tangle-network/ui emit no rule:\n${detail}\n` +
          `Consumers on the precompiled bundle render these at the inherited colour. ` +
          `Usually this means the resolved @tangle-network/ui is older than the one consumers install — bump it — ` +
          `or that src/styles/globals.css no longer @source-scans its src/.`,
      )
    }
  }
}
