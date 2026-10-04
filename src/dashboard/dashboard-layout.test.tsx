import { beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DashboardLayout, type NavItem } from "./dashboard-layout"

function NavIcon() {
  return <svg data-testid="nav-icon" />
}

function renderLayout(notifications?: Parameters<typeof DashboardLayout>[0]["notifications"]) {
  return render(
    <DashboardLayout navItems={[]} notifications={notifications}>
      <div>content</div>
    </DashboardLayout>,
  )
}

describe("DashboardLayout — labeled rail nav alignment", () => {
  const navItems: NavItem[] = [
    { id: "sandboxes", label: "Sandboxes", href: "/sandboxes", icon: NavIcon },
    { id: "templates", label: "Templates", href: "/templates", icon: NavIcon },
    { id: "team", label: "Team", href: "/team", icon: NavIcon },
  ]

  it("renders nav links as full-width rows on the anchor (asChild), not a nested button", () => {
    render(
      <DashboardLayout navItems={navItems} activeNavId="sandboxes" labeledRail>
        <div>content</div>
      </DashboardLayout>,
    )
    // Every nav anchor (desktop rail + mobile drawer render the same tree)
    // must carry the row class itself and contain no nested <button> — the
    // pre-fix markup was <a><button class="w-full">, which shrank the row to
    // its label width and centered it, leaving each item a different width.
    const links = document.querySelectorAll('nav a[href="/sandboxes"], nav a[href="/templates"], nav a[href="/team"]')
    expect(links.length).toBeGreaterThan(0)
    links.forEach((link) => {
      expect(link.className).toMatch(/w-full/)
      expect(link.querySelector("button")).toBeNull()
    })
  })

  it("keeps active and inactive nav items the same width", () => {
    render(
      <DashboardLayout navItems={navItems} activeNavId="sandboxes" labeledRail>
        <div>content</div>
      </DashboardLayout>,
    )
    const active = document.querySelector('nav a[href="/sandboxes"]') as HTMLElement
    const inactive = document.querySelector('nav a[href="/templates"]') as HTMLElement
    expect(active).toBeTruthy()
    expect(inactive).toBeTruthy()
    // Strip the active/inactive emphasis (color tokens + the active item's ring
    // and font-weight, none of which change box size); the remaining geometry
    // classes (width, height, padding, layout) must match so rows align exactly.
    const geometry = (cls: string) =>
      cls
        .split(/\s+/)
        .filter((c) => !/(accent-surface|accent-text|muted-foreground|hover:|foreground|^ring|font-medium|border-accent)/.test(c))
        .sort()
        .join(" ")
    expect(geometry(active.className)).toBe(geometry(inactive.className))
  })
})

describe("DashboardLayout — rail collapse control", () => {
  const navItems: NavItem[] = [
    { id: "sandboxes", label: "Sandboxes", href: "/sandboxes", icon: NavIcon },
  ]

  // The collapse toggle persists rail state to localStorage; reset it so each
  // test starts from the provider's default (expanded), independent of order.
  // Unguarded on purpose: `setupFiles` runs before every test file, and the setup
  // installs an in-memory Storage wherever the host does not supply a usable one —
  // including where reading `localStorage` throws (see test-support/memory-storage).
  beforeEach(() => {
    localStorage.clear()
  })

  it("renders a discoverable collapse toggle on the labeled rail", () => {
    render(
      <DashboardLayout navItems={navItems} labeledRail>
        <div>content</div>
      </DashboardLayout>,
    )
    // Expanded by default, so the header's panel toggle offers to collapse.
    // Only the desktop rail is collapsible — the mobile drawer never collapses.
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).toBeNull()
  })

  it("starts collapsed when defaultRailCollapsed is set", () => {
    render(
      <DashboardLayout navItems={navItems} labeledRail defaultRailCollapsed>
        <div>content</div>
      </DashboardLayout>,
    )
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).toBeNull()
  })

  it("renders no collapse toggle when labeledRail is omitted", () => {
    render(
      <DashboardLayout navItems={navItems}>
        <div>content</div>
      </DashboardLayout>,
    )
    expect(
      screen.queryByRole("button", { name: /Collapse sidebar|Expand sidebar/ }),
    ).toBeNull()
  })

  it("collapses the rail when the control is clicked", async () => {
    const user = userEvent.setup()
    render(
      <DashboardLayout navItems={navItems} labeledRail>
        <div>content</div>
      </DashboardLayout>,
    )
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
  })
})

describe("DashboardLayout — notification dropdown", () => {
  it("renders the bell button", () => {
    renderLayout()
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument()
  })

  it("shows unread badge when unreadCount > 0", () => {
    renderLayout({ items: [], unreadCount: 3 })
    const bell = screen.getByRole("button", { name: "Notifications" })
    // The red dot indicator is inside the button
    expect(bell.querySelector(".bg-destructive")).toBeTruthy()
  })

  it("does not show unread badge when unreadCount is 0", () => {
    renderLayout({ items: [], unreadCount: 0 })
    const bell = screen.getByRole("button", { name: "Notifications" })
    expect(bell.querySelector(".bg-destructive")).toBeNull()
  })

  it("opens dropdown on click and shows empty state", async () => {
    const user = userEvent.setup()
    renderLayout({ items: [], unreadCount: 0 })

    await user.click(screen.getByRole("button", { name: "Notifications" }))

    expect(screen.getByText("No notifications yet")).toBeInTheDocument()
  })

  it("renders notification items when provided", async () => {
    const user = userEvent.setup()
    renderLayout({
      items: [
        { id: "1", title: "Deploy complete", message: "Sandbox is running", read: false, createdAt: "2026-04-01T10:00:00Z" },
      ],
      unreadCount: 1,
    })

    await user.click(screen.getByRole("button", { name: "Notifications" }))

    expect(screen.getByText("Deploy complete")).toBeInTheDocument()
    expect(screen.getByText("Sandbox is running")).toBeInTheDocument()
  })

  it("calls onMarkRead when clicking an unread notification", async () => {
    const user = userEvent.setup()
    const onMarkRead = vi.fn()
    renderLayout({
      items: [
        { id: "n1", title: "Alert", message: "Something happened", read: false, createdAt: "2026-04-01T10:00:00Z" },
      ],
      unreadCount: 1,
      onMarkRead,
    })

    await user.click(screen.getByRole("button", { name: "Notifications" }))
    await user.click(screen.getByText("Alert"))

    expect(onMarkRead).toHaveBeenCalledWith("n1")
  })

  it("shows 'Mark all read' button when there are unread items", async () => {
    const user = userEvent.setup()
    const onMarkAllRead = vi.fn()
    renderLayout({
      items: [
        { id: "n1", title: "Alert", message: "msg", read: false, createdAt: "2026-04-01T10:00:00Z" },
      ],
      unreadCount: 1,
      onMarkAllRead,
    })

    await user.click(screen.getByRole("button", { name: "Notifications" }))
    await user.click(screen.getByText("Mark all read"))

    expect(onMarkAllRead).toHaveBeenCalledOnce()
  })

  it("closes dropdown on Escape key", async () => {
    const user = userEvent.setup()
    renderLayout({ items: [], unreadCount: 0 })

    await user.click(screen.getByRole("button", { name: "Notifications" }))
    expect(screen.getByText("No notifications yet")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByText("No notifications yet")).not.toBeInTheDocument()
    })
  })

  it("has aria-expanded attribute reflecting open state", async () => {
    const user = userEvent.setup()
    renderLayout({ items: [], unreadCount: 0 })

    const bell = screen.getByRole("button", { name: "Notifications" })
    expect(bell).toHaveAttribute("aria-expanded", "false")

    await user.click(bell)
    expect(bell).toHaveAttribute("aria-expanded", "true")
  })

  it("renders createdAt as fallback string when date is invalid", async () => {
    const user = userEvent.setup()
    renderLayout({
      items: [
        { id: "n1", title: "Bad Date", message: "msg", read: true, createdAt: "not-a-date" },
      ],
      unreadCount: 0,
    })

    await user.click(screen.getByRole("button", { name: "Notifications" }))

    // Should fall back to the raw string instead of "Invalid Date"
    expect(screen.getByText("not-a-date")).toBeInTheDocument()
    expect(screen.queryByText("Invalid Date")).not.toBeInTheDocument()
  })
})


describe("DashboardLayout — sidebar controls", () => {
  beforeEach(() => localStorage.clear())

  it("keeps New Sandbox, workspace switching and host links in the sidebar", async () => {
    const user = userEvent.setup()
    const onNewSandbox = vi.fn()
    render(<DashboardLayout navItems={[]} labeledRail onNewSandbox={onNewSandbox}
      sidebarLeading={({ collapsed }) => <button type="button">{collapsed ? "Workspace icon" : "Personal workspace"}</button>}
      topNavLinks={[{ label: "Admin billing", href: "/billing" }]}><div>content</div></DashboardLayout>)
    const sidebar = document.querySelector('[data-sidebar="true"]')!
    expect(sidebar).toContainElement(screen.getByRole("button", { name: "New Sandbox" }))
    expect(sidebar).toContainElement(screen.getByRole("button", { name: "Personal workspace" }))
    expect(sidebar).toContainElement(screen.getByRole("link", { name: "Admin billing" }))
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toHaveClass("lg:hidden")
    expect(screen.getByRole("main")).toHaveClass("lg:pt-0")
    await user.click(screen.getByRole("button", { name: "New Sandbox" }))
    expect(onNewSandbox).toHaveBeenCalledOnce()
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(screen.getByRole("button", { name: "Workspace icon" })).toBeInTheDocument()
  })

  it("keeps legacy workspace content reachable from a collapsed rail", async () => {
    const user = userEvent.setup()
    render(<DashboardLayout navItems={[]} labeledRail defaultRailCollapsed topBarLeading={<button type="button">Choose team</button>}><div>content</div></DashboardLayout>)
    await user.click(screen.getByRole("button", { name: "Workspace" }))
    expect(screen.getByRole("button", { name: "Choose team" })).toBeInTheDocument()
  })

  it("places notifications above the account menu without making read-only entries clickable", async () => {
    const user = userEvent.setup()
    render(<DashboardLayout navItems={[]} user={{ email: "owner@example.com" }} notifications={{items:[{id:"read",title:"Completed",message:"Finished",read:true,createdAt:"2026-10-04T00:00:00Z"}],unreadCount:0}}><div>content</div></DashboardLayout>)
    const bell = screen.getByRole("button", { name: "Notifications" })
    const profile = screen.getByRole("button", { name: "User menu" })
    expect(bell.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(bell)
    expect(screen.getByRole("menu", { name: "Notifications" })).toHaveTextContent("Completed")
    expect(screen.queryByRole("menuitem", { name: /Completed/ })).toBeNull()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(bell).toHaveFocus())
  })

  it("keeps the mobile drawer open when its notification menu closes, then restores the menu trigger", async () => {
    const user = userEvent.setup()
    renderLayout({items:[],unreadCount:0})
    const trigger = screen.getByRole("button", { name: "Open menu" })
    await user.click(trigger)
    const drawer = screen.getByRole("dialog", { name: "Navigation" })
    const bell = within(drawer).getByRole("button", { name: "Notifications" })
    await user.click(bell)
    await user.keyboard("{Escape}")
    expect(drawer).toBeInTheDocument()
    await waitFor(() => expect(bell).toHaveFocus())
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("closes the mobile drawer before invoking callback-driven account navigation", async () => {
    const user = userEvent.setup()
    const onSettingsClick = vi.fn()
    render(<DashboardLayout navItems={[]} user={{email:"owner@example.com"}} onSettingsClick={onSettingsClick}><div>content</div></DashboardLayout>)
    await user.click(screen.getByRole("button", { name: "Open menu" }))
    const drawer = screen.getByRole("dialog", { name: "Navigation" })
    await user.click(within(drawer).getByRole("button", { name: "User menu" }))
    await user.click(screen.getByRole("menuitem", { name: /Settings$/ }))
    expect(onSettingsClick).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull())
  })

  it("closes the mobile drawer when New Sandbox is selected", async () => {
    const user = userEvent.setup()
    const onNewSandbox = vi.fn()
    render(<DashboardLayout navItems={[]} onNewSandbox={onNewSandbox}><div>content</div></DashboardLayout>)
    await user.click(screen.getByRole("button", { name: "Open menu" }))
    await user.click(within(screen.getByRole("dialog", { name: "Navigation" })).getByRole("button", { name: "New Sandbox" }))
    expect(onNewSandbox).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull())
  })
})
