import * as React from "react"

/**
 * Keep `<html>`'s `data-theme` attribute and `.light` class in lockstep with the
 * `.dark` class.
 *
 * The shared theme hook (`@tangle-network/ui`'s `useTheme`, used by
 * {@link RailThemeToggle} and the `appearance` menu) only toggles `.dark`. But
 * `@tangle-network/brand` 0.6 defaults to dark via `[data-sandbox-ui]` (always
 * present on the app's `<html>`) and scopes its light tokens to `.light` /
 * `[data-theme="light"]`. So removing `.dark` alone does NOT switch to light —
 * the dark shell stays — and the toggle appears dead.
 *
 * Mirroring `data-theme` + `.light` off `.dark` here, once, in the layout every
 * app mounts, makes the light/dark toggle actually switch regardless of which
 * control flipped it — so apps no longer each reimplement this sync. Observing
 * the `class` attribute (rather than reading `useTheme`) catches every writer,
 * including an app's pre-React no-flash script.
 *
 * A Brand NAMED theme (`data-theme="aubergine"`, `"intelligence"`,
 * `"tangle-light"`, …) belongs to the app that selected it. The hook still
 * mirrors `.light`, but it never rewrites a named `data-theme` to plain
 * `dark`/`light`: doing so drops the named scope's tokens and renders the app in
 * the default palette. It writes `data-theme` only when the attribute is absent
 * or already `dark`/`light`.
 */
export function useBrandThemeSync(): void {
  React.useEffect(() => {
    if (typeof document === "undefined") return
    const el = document.documentElement
    const sync = () => {
      const dark = el.classList.contains("dark")
      // `toggle(name, force)` is a no-op (no mutation) when already in the target
      // state, so the observer settles after one pass instead of looping.
      el.classList.toggle("light", !dark)
      const current = el.getAttribute("data-theme")
      if (!isPlainTheme(current)) return
      const next = dark ? "dark" : "light"
      if (current !== next) el.setAttribute("data-theme", next)
    }
    sync()
    const observer = new MutationObserver(sync)
    // Watch only `class`; our `data-theme` write is excluded so it can't re-trigger.
    observer.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
}

function isPlainTheme(value: string | null): boolean {
  return value === null || value === "" || value === "dark" || value === "light"
}
