import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
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
    // Strip the active/inactive color tokens; the remaining geometry classes
    // (width, height, padding, layout) must match so the rows align exactly.
    const geometry = (cls: string) =>
      cls
        .split(/\s+/)
        .filter((c) => !/(accent-surface|accent-text|muted-foreground|hover:|foreground)/.test(c))
        .sort()
        .join(" ")
    expect(geometry(active.className)).toBe(geometry(inactive.className))
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
