import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
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

describe("SidebarLayout — railHeaderContent slot", () => {
  it("renders railHeaderContent in place of the logo link", () => {
    render(
      <SidebarLayout
        railHeaderContent={<div data-testid="switcher">Switcher</div>}
        logo={<span>LOGO</span>}
        logoHref="/home"
        navItems={[navItem({ id: "home" })]}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    expect(screen.getByTestId("switcher")).toBeInTheDocument()
    // logo link is suppressed when the header slot is provided
    expect(screen.queryByText("LOGO")).not.toBeInTheDocument()
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
