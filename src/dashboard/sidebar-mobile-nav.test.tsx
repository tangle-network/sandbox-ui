import * as React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SidebarLayout, type SidebarLayoutNavItem } from "./sidebar-layout"

/**
 * Below `hideBelow` the desktop rail is `display:none`, so before this drawer a
 * phone had no entry point to any section at all — measured on all four
 * products: 0 menu buttons, 0 of 5 destinations reachable.
 *
 * These assertions are deliberately about EMITTED NAMES and REACHABILITY rather
 * than types: a renamed prop typechecks clean and silently stops a control
 * rendering, which is exactly the class of regression this drawer exists to
 * prevent.
 */

function Icon() {
  return <svg data-testid="icon" />
}

function navItem(overrides: Partial<SidebarLayoutNavItem> & { id: string }): SidebarLayoutNavItem {
  return { label: overrides.id, icon: Icon, href: `/${overrides.id}`, ...overrides }
}

// jsdom has no media-query engine; real breakpoint transitions are exercised
// by tests/visual/sidebar-navigation.spec.mjs in Chromium.
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: false, media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
})
afterEach(() => vi.unstubAllGlobals())

const SECTIONS = ["vault", "board", "approvals", "history", "terminal"]

function renderShell(props: Partial<React.ComponentProps<typeof SidebarLayout>> = {}) {
  return render(
    <SidebarLayout
      navItems={SECTIONS.map((id) => navItem({ id, label: id }))}
      hideBelow="lg"
      {...props}
    >
      <div>content</div>
    </SidebarLayout>,
  )
}

describe("SidebarLayout — mobile section nav", () => {
  it("keeps the default settings destination when the host omits it", async () => {
    const user = userEvent.setup()
    renderShell({ user: { name: "Workspace owner", email: "owner@example.test" } })
    await user.click(screen.getAllByRole("button", { name: "User menu" }).at(-1)!)
    expect(screen.getByRole("menuitem", { name: /Settings$/ }).getAttribute("href")).toBe("/dashboard/settings")
  })

  it("omits unavailable settings while keeping signout actionable", async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    renderShell({ user: { name: "Workspace owner", email: "owner@example.test" }, settingsHref: null, onLogout })
    await user.click(screen.getAllByRole("button", { name: "User menu" }).at(-1)!)
    expect(screen.queryByRole("menuitem", { name: /Settings$/ })).toBeNull()
    await user.click(screen.getByRole("menuitem", { name: /Sign Out$/ }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it("honors the host settings callback even without a route", async () => {
    const user = userEvent.setup()
    const onSettingsClick = vi.fn()
    renderShell({ user: { name: "Workspace owner", email: "owner@example.test" }, settingsHref: null, onSettingsClick })
    await user.click(screen.getAllByRole("button", { name: "User menu" }).at(-1)!)
    await user.click(screen.getByRole("menuitem", { name: /Settings$/ }))
    expect(onSettingsClick).toHaveBeenCalledTimes(1)
  })

  it("opens the drawer on a host without matchMedia", async () => {
    vi.stubGlobal("matchMedia", undefined)
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  it("exposes a menu trigger whenever the rail is hidden below a breakpoint", () => {
    renderShell()
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeTruthy()
  })

  it("renders no menu trigger when the rail is always visible", () => {
    renderShell({ hideBelow: undefined })
    expect(screen.queryByRole("button", { name: "Open navigation" })).toBeNull()
  })

  it("reaches every section from the drawer", async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole("button", { name: "Open navigation" }))

    const drawer = screen.getByRole("dialog", { name: "Navigation" })
    for (const section of SECTIONS) {
      const link = within(drawer).getByRole("link", { name: section })
      expect(link.getAttribute("href")).toBe(`/${section}`)
    }
  })

  it("closes after a section is chosen, so the destination is not covered", async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const drawer = screen.getByRole("dialog", { name: "Navigation" })
    await user.click(within(drawer).getByRole("link", { name: "vault" }))
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeTruthy()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
  })

  it("marks the trigger's expanded state so assistive tech can announce it", async () => {
    const user = userEvent.setup()
    renderShell()
    const trigger = screen.getByRole("button", { name: "Open navigation" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    await user.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  })

  it("carries the badge count into the drawer, not just the desktop rail", async () => {
    const user = userEvent.setup()
    render(
      <SidebarLayout
        navItems={[navItem({ id: "approvals", label: "approvals", badge: 7 })]}
        hideBelow="lg"
      >
        <div>content</div>
      </SidebarLayout>,
    )
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const drawer = screen.getByRole("dialog", { name: "Navigation" })
    expect(within(drawer).getByText("7")).toBeTruthy()
  })

  it("forwards a nav item's badgeLabel to the rail link's description", () => {
    render(
      <SidebarLayout
        navItems={[navItem({ id: "jobs", label: "jobs", badge: 3, badgeLabel: (n) => `${n} running` })]}
        hideBelow="lg"
      >
        <div>content</div>
      </SidebarLayout>,
    )
    const links = screen.getAllByRole("link", { name: "jobs" })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAccessibleDescription("3 running")
  })

  it("does not start open — a nav drawer that reopens on every load is a bug", () => {
    renderShell()
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
  })

  it("keeps the panel's content reachable, since a phone cannot dock it beside a rail", async () => {
    const user = userEvent.setup()
    renderShell({ panel: <div>thread list</div> })
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const drawer = screen.getByRole("dialog", { name: "Navigation" })
    expect(within(drawer).getByText("thread list")).toBeTruthy()
  })

  it("fires the nav item's own onSelect wiring exactly once per choice", async () => {
    const user = userEvent.setup()
    const onPanelOpenChange = vi.fn()
    render(
      <SidebarLayout
        navItems={[navItem({ id: "threads", label: "threads", href: undefined, togglesPanel: true })]}
        hideBelow="lg"
        panelOpen={false}
        onPanelOpenChange={onPanelOpenChange}
        panel={<div>panel</div>}
      >
        <div>content</div>
      </SidebarLayout>,
    )
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const drawer = screen.getByRole("dialog", { name: "Navigation" })
    await user.click(within(drawer).getByRole("button", { name: /threads/ }))
    expect(onPanelOpenChange).toHaveBeenCalledTimes(1)
    expect(onPanelOpenChange).toHaveBeenCalledWith(true)
  })

  // A product-controlled switcher (Hospitality's workspace menu) shares one
  // `open` across every mounted copy, so each copy is one more menu on screen.
  function ControlledSwitcher() {
    const [open, setOpen] = React.useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(!open)}>Workspace</button>
        {open && <div role="menu">Create workspace</div>}
      </>
    )
  }

  it("mounts the rail header content once on a phone, whether or not the drawer is open", async () => {
    const user = userEvent.setup()
    renderShell({ railLabels: true, railHeaderContent: <ControlledSwitcher /> })
    expect(screen.getAllByRole("button", { name: "Workspace" })).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "Workspace" }))
    expect(screen.getAllByRole("menu")).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const drawer = screen.getByRole("dialog", { name: "Navigation" })
    expect(screen.getAllByRole("button", { name: "Workspace", hidden: true })).toHaveLength(1)
    expect(within(drawer).getByRole("button", { name: "Workspace" })).toBeTruthy()
  })

  it("mounts the rail header content once on a desktop", () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: true, media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })))
    renderShell({ railLabels: true, railHeaderContent: <ControlledSwitcher /> })
    expect(screen.getAllByRole("button", { name: "Workspace" })).toHaveLength(1)
  })
})

