import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import * as React from "react"
import {
  SidebarProvider,
  useSidebar,
  SIDEBAR_RAIL_WIDTH,
  SIDEBAR_RAIL_LABELED_WIDTH,
} from "./sidebar-context"
import { SidebarLayout, type SidebarLayoutNavItem } from "./sidebar-layout"

const RAIL_COLLAPSED_KEY = "sandbox-sidebar-rail-collapsed"

function Icon() {
  return <svg data-testid="icon" />
}

// Surfaces the sidebar context values as DOM so assertions read them directly.
function Probe() {
  const { railCollapsed, railWidth, toggleRail, setRailCollapsed } = useSidebar()
  return (
    <div>
      <span data-testid="collapsed">{String(railCollapsed)}</span>
      <span data-testid="width">{railWidth}</span>
      <button type="button" data-testid="toggle" onClick={toggleRail}>
        toggle
      </button>
      <button type="button" data-testid="collapse" onClick={() => setRailCollapsed(true)}>
        collapse
      </button>
    </div>
  )
}

describe("SidebarProvider — rail collapse (uncontrolled)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("defaults to expanded when nothing is set", () => {
    render(
      <SidebarProvider labeledRail>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("collapsed").textContent).toBe("false")
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_LABELED_WIDTH))
  })

  it("toggleRail flips collapsed and persists to localStorage", () => {
    render(
      <SidebarProvider labeledRail>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("collapsed").textContent).toBe("false")

    fireEvent.click(screen.getByTestId("toggle"))
    expect(screen.getByTestId("collapsed").textContent).toBe("true")
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("true")

    fireEvent.click(screen.getByTestId("toggle"))
    expect(screen.getByTestId("collapsed").textContent).toBe("false")
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("false")
  })

  it("hydrates collapsed state from localStorage on mount", () => {
    localStorage.setItem(RAIL_COLLAPSED_KEY, "true")
    render(
      <SidebarProvider labeledRail>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("collapsed").textContent).toBe("true")
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_WIDTH))
  })

  it("respects defaultRailCollapsed when localStorage is empty", () => {
    render(
      <SidebarProvider labeledRail defaultRailCollapsed>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("collapsed").textContent).toBe("true")
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_WIDTH))
  })
})

describe("SidebarProvider — railWidth derivation", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("derives 248 when labeled + expanded, 56 when labeled + collapsed", () => {
    render(
      <SidebarProvider labeledRail>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_LABELED_WIDTH))
    fireEvent.click(screen.getByTestId("toggle"))
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_WIDTH))
  })

  it("stays 56 for a non-labeled rail regardless of collapsed state", () => {
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_WIDTH))
    // Collapsing a non-labeled rail has no width effect (it is already icon-only).
    fireEvent.click(screen.getByTestId("collapse"))
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_WIDTH))
  })
})

describe("SidebarProvider — rail collapse (controlled)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("reflects the controlled prop and never writes localStorage", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SidebarProvider labeledRail railCollapsed={false} onRailCollapsedChange={onChange}>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("collapsed").textContent).toBe("false")
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_LABELED_WIDTH))

    // Toggling in controlled mode reports out but does not self-update or persist.
    fireEvent.click(screen.getByTestId("toggle"))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByTestId("collapsed").textContent).toBe("false")
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBeNull()

    // The owner drives the value via the prop.
    rerender(
      <SidebarProvider labeledRail railCollapsed onRailCollapsedChange={onChange}>
        <Probe />
      </SidebarProvider>,
    )
    expect(screen.getByTestId("collapsed").textContent).toBe("true")
    expect(screen.getByTestId("width").textContent).toBe(String(SIDEBAR_RAIL_WIDTH))
  })
})

describe("SidebarLayout — collapse control + icon rail", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const navItems: SidebarLayoutNavItem[] = [
    { id: "home", label: "Home", icon: Icon, href: "/home" },
    { id: "settings", label: "Settings", icon: Icon, href: "/settings" },
  ]

  it("renders nav labels when expanded and a collapse control on a labeled rail", () => {
    render(
      <SidebarLayout navItems={navItems} railLabels activeId="home">
        <div>content</div>
      </SidebarLayout>,
    )
    // Labels visible while expanded.
    expect(screen.getByText("Home")).toBeInTheDocument()
    // Collapse control present.
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument()
  })

  it("hides nav labels and shows the expand control after collapsing", () => {
    render(
      <SidebarLayout navItems={navItems} railLabels activeId="home">
        <div>content</div>
      </SidebarLayout>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    // Icon-only rail: the inline label is gone. The label is exposed via the
    // button's accessible name; the visual tooltip is now a hover-only portal,
    // so it is not in the DOM at rest.
    expect(screen.queryByText("Home", { selector: "span" })).not.toBeInTheDocument()
    const expand = screen.getByRole("button", { name: "Expand sidebar" })
    expect(expand).toBeInTheDocument()
    const homeLink = document.querySelector('a[href="/home"]')
    expect(homeLink).toHaveAttribute("aria-label", "Home")
  })

  it("does NOT render a collapse control when railLabels is omitted (backward-compat)", () => {
    render(
      <SidebarLayout navItems={navItems} activeId="home">
        <div>content</div>
      </SidebarLayout>,
    )
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument()
    // Icon-only rail: no inline visible label; the label is exposed via the
    // link's accessible name (the tooltip is a hover-only portal, not at rest).
    expect(screen.queryByText("Home", { selector: "span" })).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/home"]')).toHaveAttribute("aria-label", "Home")
  })

  it("respects controlled railCollapsed + reports changes", () => {
    const onChange = vi.fn()
    render(
      <SidebarLayout
        navItems={navItems}
        railLabels
        railCollapsed
        onRailCollapsedChange={onChange}
        activeId="home"
      >
        <div>content</div>
      </SidebarLayout>,
    )
    // Controlled-collapsed: inline label hidden (tooltip only), expand control shown.
    expect(screen.queryByText("Home", { selector: 'span:not([role="tooltip"])' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
