import { describe, it, expect, vi } from "vitest"
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
    expect(
      screen.getByRole("button", { name: "Open navigation" }).getAttribute("aria-expanded"),
    ).toBe("true")
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

  it("restores the page's own overflow when it closes", async () => {
    const user = userEvent.setup()
    document.body.style.overflow = "auto"
    renderShell()
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(document.body.style.overflow).toBe("hidden")
    await user.keyboard("{Escape}")
    expect(document.body.style.overflow).toBe("auto")
    document.body.style.overflow = ""
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
})
