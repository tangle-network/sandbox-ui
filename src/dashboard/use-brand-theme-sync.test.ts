// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useBrandThemeSync } from "./use-brand-theme-sync"

// MutationObserver callbacks fire on a microtask; flush them.
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

afterEach(() => {
  document.documentElement.className = ""
  document.documentElement.removeAttribute("data-theme")
})

describe("useBrandThemeSync", () => {
  it("mirrors data-theme + .light off the initial .dark state on mount", () => {
    document.documentElement.classList.add("dark")
    renderHook(() => useBrandThemeSync())
    expect(document.documentElement.classList.contains("light")).toBe(false)
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
  })

  it("when the shared toggle removes .dark, light tokens take over (the bug)", async () => {
    document.documentElement.classList.add("dark")
    renderHook(() => useBrandThemeSync())

    // Simulate @tangle-network/ui's useTheme: it ONLY flips `.dark`.
    document.documentElement.classList.remove("dark")
    await flush()

    expect(document.documentElement.classList.contains("light")).toBe(true)
    expect(document.documentElement.getAttribute("data-theme")).toBe("light")
  })

  it("re-adding .dark switches data-theme + drops .light back", async () => {
    renderHook(() => useBrandThemeSync())
    await flush() // settles to light (no .dark present)
    expect(document.documentElement.getAttribute("data-theme")).toBe("light")

    document.documentElement.classList.add("dark")
    await flush()

    expect(document.documentElement.classList.contains("light")).toBe(false)
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
  })

  it("settles without an infinite observer loop (idempotent sync)", async () => {
    document.documentElement.classList.add("dark")
    renderHook(() => useBrandThemeSync())
    document.documentElement.classList.remove("dark")
    await flush()
    await flush() // a second flush must not flip anything back
    expect(document.documentElement.classList.contains("light")).toBe(true)
    expect(document.documentElement.getAttribute("data-theme")).toBe("light")
  })
})
