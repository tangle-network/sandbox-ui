/**
 * The three motion composites, as class strings.
 *
 * Every duration and curve this package animates on comes from a token declared
 * in `src/styles/globals.css` (`--duration-*` / `--ease-*` / `--motion-*`, the
 * same names and values `@tangle-network/agent-app` declares). A hardcoded
 * `duration-150` is invisible to the `prefers-reduced-motion` collapse at
 * `:root`, and "it writes its own timing" and "it ignores reduced motion" are
 * the same defect.
 *
 * These are arbitrary-value utilities rather than named ones (`duration-fast`,
 * the form agent-app's Tailwind preset generates) because the artifact this
 * package ships is the PRECOMPILED `dist/globals.css`, built with
 * `@import "tailwindcss" source(none)` and no JS config. A named utility that no
 * config defines emits no rule, and the failure is silent — the element simply
 * keeps its default timing. An arbitrary value that appears verbatim in scanned
 * source always emits. @see the text-ramp comment in globals.css for the same
 * failure mode, paid for once already.
 *
 * Pair them with a `transition-*` utility that names the properties:
 * `cn("transition-colors", MOTION_CONTROL)`.
 */

/** A control already on screen changing state: hover, active, press, focus. */
export const MOTION_CONTROL = "duration-[var(--duration-fast)] ease-[var(--ease-standard)]"

/** A surface arriving or leaving: a panel, a flyout, a disclosure. */
export const MOTION_SURFACE = "duration-[var(--duration-base)] ease-[var(--ease-entrance)]"

/**
 * A full-height surface travelling: the rail collapsing, the mobile drawer, the
 * content margin that has to keep pace with them. Pairs `--duration-slow` with
 * `--ease-standard` — the slow tier is the one composite agent-app leaves
 * unnamed, so it is composed here from its two tokens rather than invented as a
 * fourth `--motion-*` the other package would not have.
 */
export const MOTION_TRAVEL = "duration-[var(--duration-slow)] ease-[var(--ease-standard)]"
