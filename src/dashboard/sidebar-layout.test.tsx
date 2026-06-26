import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SidebarLayout, type SidebarLayoutNavItem } from "./sidebar-layout"

function Icon() {
  return <svg data-testid="icon" />
}

// Stand-in for a React Router <Link>: records every prop it receives so the
// test can assert exactly what SidebarLayout forwards.
function makeSpyLink() {
  const calls: Record<string, unknown>[] = []
  const SpyLink = (props: Record<string, unknown>) => {
    calls.push(props)
    return (
      <a
        href={(props.href as string) ?? (props.to as string)}
        data-prefetch={props.prefetch as string | undefined}
        data-id={props["data-nav-id"] as string | undefined}
      >
        {props.children as React.ReactNode}
      </a>
    )
  }
  return { SpyLink, calls }
}

function navItem(overrides: Partial<SidebarLayoutNavItem> & { id: string }): SidebarLayoutNavItem {
  return { label: overrides.id, icon: Icon, href: `/${overrides.id}`, ...overrides }
}

describe("SidebarLayout — link prefetch forwarding", () => {
  it("forwards prefetch to the underlying Link when set on the nav item", () => {
    const { SpyLink, calls } = makeSpyLink()
    render(
      <SidebarLayout
        LinkComponent={SpyLink}
        navItems={[navItem({ id: "home", prefetch: "intent" })]}
      >
        <div>content</div>
      </SidebarLayout>,
    )

    const linkCall = calls.find((c) => c.href === "/home" || c.to === "/home")
    expect(linkCall).toBeDefined()
    expect(linkCall?.prefetch).toBe("intent")
  })

  it.each(["none", "intent", "render", "viewport"] as const)(
    "forwards prefetch=%s",
    (mode) => {
      const { SpyLink, calls } = makeSpyLink()
      render(
        <SidebarLayout LinkComponent={SpyLink} navItems={[navItem({ id: "x", prefetch: mode })]}>
          <div>content</div>
        </SidebarLayout>,
      )
      const linkCall = calls.find((c) => c.href === "/x" || c.to === "/x")
      expect(linkCall?.prefetch).toBe(mode)
    },
  )

  it("does NOT pass a prefetch prop when omitted (preserves current behavior)", () => {
    const { SpyLink, calls } = makeSpyLink()
    render(
      <SidebarLayout LinkComponent={SpyLink} navItems={[navItem({ id: "plain" })]}>
        <div>content</div>
      </SidebarLayout>,
    )

    const linkCall = calls.find((c) => c.href === "/plain" || c.to === "/plain")
    expect(linkCall).toBeDefined()
    expect("prefetch" in (linkCall ?? {})).toBe(false)
  })

  it("does not leak a prefetch attribute onto the default anchor when omitted", () => {
    render(
      <SidebarLayout navItems={[navItem({ id: "plain", label: "Plain" })]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const anchor = document.querySelector('a[href="/plain"]')
    expect(anchor).toBeTruthy()
    expect(anchor?.hasAttribute("prefetch")).toBe(false)
  })

  it("ignores prefetch for panel-toggle items (rendered as a button, not a link)", () => {
    const { SpyLink, calls } = makeSpyLink()
    render(
      <SidebarLayout
        LinkComponent={SpyLink}
        panel={<div>panel</div>}
        navItems={[
          // biome-ignore lint/suspicious/noExplicitAny: exercise the prop being ignored on a toggle
          { id: "toggle", label: "Toggle", icon: Icon, togglesPanel: true, prefetch: "render" } as any,
        ]}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    // A toggle renders a <button>, so the spy Link is never called for it.
    expect(calls.find((c) => c.prefetch === "render")).toBeUndefined()
    expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument()
  })
})

describe("SidebarLayout — rail header (brand · middle · toggle)", () => {
  it("renders the brand AND the middle content when expanded", () => {
    render(
      <SidebarLayout
        railLabels
        railHeaderContent={<div data-testid="switcher">Switcher</div>}
        logo={<span>LOGO</span>}
        logoHref="/home"
        navItems={[navItem({ id: "home" })]}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    // Both the brand mark (left) and the custom middle content are shown — the
    // redesigned header no longer suppresses the logo when a middle slot exists.
    expect(screen.getByTestId("switcher")).toBeInTheDocument()
    expect(screen.getByText("LOGO")).toBeInTheDocument()
  })

  it("shows a panel-toggle button in the header when the rail is collapsible", () => {
    render(
      <SidebarLayout railLabels logo={<span>LOGO</span>} navItems={[navItem({ id: "home" })]}>
        <div>content</div>
      </SidebarLayout>,
    )
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument()
  })
})

describe("SidebarLayout — flyout nav item", () => {
  const flyoutNav: SidebarLayoutNavItem = {
    id: "studio",
    label: "Studio",
    icon: Icon,
    flyoutItems: [
      { id: "designs", label: "Designs", icon: Icon, href: "/designs" },
      { id: "ads", label: "Ads", icon: Icon, href: "/ads" },
    ],
  }

  it("renders a trigger button (not a link) and hides children until opened", () => {
    render(
      <SidebarLayout navItems={[flyoutNav]}>
        <div>content</div>
      </SidebarLayout>,
    )
    expect(screen.getByRole("button", { name: "Studio" })).toBeInTheDocument()
    expect(screen.queryByText("Designs")).not.toBeInTheDocument()
  })

  it("reveals the sub-destinations on click", () => {
    render(
      <SidebarLayout navItems={[flyoutNav]}>
        <div>content</div>
      </SidebarLayout>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Studio" }))
    expect(screen.getByText("Designs")).toBeInTheDocument()
    expect(screen.getByText("Ads")).toBeInTheDocument()
  })

  it("highlights the door when a flyout child is active", () => {
    render(
      <SidebarLayout navItems={[{ ...flyoutNav, flyoutActiveIds: ["designs"] }]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const trigger = screen.getByRole("button", { name: "Studio" })
    expect(trigger.className).toContain("accent-surface-strong")
  })
})

describe("SidebarLayout — primary nav item", () => {
  it("renders an emphasized primary pill (distinct from a plain item)", () => {
    render(
      <SidebarLayout railLabels navItems={[navItem({ id: "new", label: "New", variant: "primary" })]}>
        <div>content</div>
      </SidebarLayout>,
    )
    const link = screen.getByText("New").closest("a")
    expect(link?.className).toContain("ring-[var(--border-accent)]")
  })
})

describe("SidebarLayout — expandable nav item", () => {
  const subItems = [
    { id: "s1", label: "Session 1", icon: Icon, href: "/c/1" },
    { id: "s2", label: "Session 2", icon: Icon, href: "/c/2" },
  ]

  const expandableNav = (overrides: Partial<SidebarLayoutNavItem> = {}): SidebarLayoutNavItem => ({
    id: "history",
    label: "History",
    icon: Icon,
    href: "/history",
    expandable: true,
    ...overrides,
  })

  it("hides fixed sub-items until the disclosure is clicked", () => {
    render(
      <SidebarLayout railLabels navItems={[expandableNav({ subItems })]}>
        <div>content</div>
      </SidebarLayout>,
    )
    expect(screen.queryByText("Session 1")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Expand History" }))
    expect(screen.getByText("Session 1")).toBeInTheDocument()
    expect(screen.getByText("Session 2")).toBeInTheDocument()
  })

  it("navigates to the row href via the label", () => {
    render(
      <SidebarLayout railLabels navItems={[expandableNav({ subItems })]}>
        <div>content</div>
      </SidebarLayout>,
    )
    expect(screen.getByText("History").closest("a")?.getAttribute("href")).toBe("/history")
  })

  it("lazy-loads sub-items once on first open, with a loading state", async () => {
    let resolve!: (v: { id: string; label: string; icon: typeof Icon; href: string }[]) => void
    const loadSubItems = vi.fn(
      () => new Promise<{ id: string; label: string; icon: typeof Icon; href: string }[]>((r) => { resolve = r }),
    )
    render(
      <SidebarLayout railLabels navItems={[expandableNav({ loadSubItems })]}>
        <div>content</div>
      </SidebarLayout>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Expand History" }))
    expect(loadSubItems).toHaveBeenCalledTimes(1)
    resolve([{ id: "lz", label: "Lazy Session", icon: Icon, href: "/c/lz" }])
    expect(await screen.findByText("Lazy Session")).toBeInTheDocument()
  })
})

describe("SidebarLayout — collapsed rail interactions", () => {
  beforeEach(() => {
    try { localStorage.clear() } catch { /* opaque origin */ }
  })

  it("expands when the empty rail body is clicked (collapsed)", () => {
    render(
      <SidebarLayout railLabels defaultRailCollapsed navItems={[navItem({ id: "home" })]}>
        <div>content</div>
      </SidebarLayout>,
    )
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
    const nav = document.querySelector("nav") as HTMLElement
    fireEvent.click(nav) // target === currentTarget (the empty body, not an item)
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument()
  })

  it("does NOT expand when a nav item is clicked (collapsed)", () => {
    render(
      <SidebarLayout railLabels defaultRailCollapsed navItems={[navItem({ id: "home" })]}>
        <div>content</div>
      </SidebarLayout>,
    )
    fireEvent.click(document.querySelector('a[href="/home"]') as HTMLElement)
    // Item click navigates; the rail stays collapsed.
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
  })

  it("shows an expandable item's sub-items in a hover flyout when collapsed", () => {
    render(
      <SidebarLayout
        railLabels
        defaultRailCollapsed
        navItems={[
          {
            id: "history",
            label: "History",
            icon: Icon,
            href: "/history",
            expandable: true,
            subItems: [{ id: "s1", label: "Session 1", icon: Icon, href: "/c/1" }],
          },
        ]}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    expect(screen.queryByText("Session 1")).not.toBeInTheDocument()
    const wrapper = (document.querySelector('a[href="/history"]') as HTMLElement).parentElement as HTMLElement
    fireEvent.mouseOver(wrapper) // React maps mouseover → onMouseEnter
    expect(screen.getByText("Session 1")).toBeInTheDocument()
  })
})

describe("SidebarLayout — appearance menu", () => {
  it("reveals Light/Dark/System in the Appearance submenu and fires onChange", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <SidebarLayout
        navItems={[navItem({ id: "home" })]}
        user={{ email: "a@b.com", name: "A" }}
        appearance={{ value: "system", onChange }}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    await user.click(screen.getByLabelText("User menu"))
    // A single "Appearance" row shows the current theme; the options live in a
    // submenu opened from it.
    const appearance = await screen.findByRole("menuitem", { name: /Appearance/ })
    await user.click(appearance)
    expect(await screen.findByRole("menuitem", { name: "Light" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "System" })).toBeInTheDocument()
    // Radix submenu item selection is pointer-driven; fireEvent.click on the
    // item triggers its onSelect reliably in jsdom.
    fireEvent.click(screen.getByRole("menuitem", { name: "Dark" }))
    expect(onChange).toHaveBeenCalledWith("dark")
  })
})
