import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DashboardLayout } from "./dashboard-layout"

function renderLayout(notifications?: Parameters<typeof DashboardLayout>[0]["notifications"]) {
  return render(
    <DashboardLayout navItems={[]} notifications={notifications}>
      <div>content</div>
    </DashboardLayout>,
  )
}

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
