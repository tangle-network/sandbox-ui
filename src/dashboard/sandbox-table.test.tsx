import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SandboxTable } from "./sandbox-table"
import type { SandboxCardData, SandboxStatus } from "./sandbox-card"

function makeSandbox(overrides: Partial<SandboxCardData> = {}): SandboxCardData {
  return {
    id: "sb-1",
    name: "My Sandbox",
    status: "running",
    ...overrides,
  }
}

describe("SandboxTable", () => {
  it("renders sandbox rows", () => {
    const sandboxes = [
      makeSandbox({ id: "1", name: "Alpha" }),
      makeSandbox({ id: "2", name: "Beta", status: "stopped" }),
    ]
    render(<SandboxTable sandboxes={sandboxes} />)
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("renders team badge for team sandboxes", () => {
    const sandboxes = [
      makeSandbox({ team: { id: "t1", name: "DevOps", role: "admin" } }),
    ]
    render(<SandboxTable sandboxes={sandboxes} />)
    expect(screen.getByText("DevOps")).toBeInTheDocument()
    expect(screen.getByText(/admin/)).toBeInTheDocument()
  })

  it("hides Scope column when no sandboxes have teams", () => {
    render(<SandboxTable sandboxes={[makeSandbox()]} />)
    expect(screen.queryByText("Scope")).not.toBeInTheDocument()
    expect(screen.queryByText("Personal")).not.toBeInTheDocument()
  })

  it("renders Personal badge alongside team sandboxes in Scope column", () => {
    const sandboxes = [
      makeSandbox({ id: "1" }),
      makeSandbox({ id: "2", team: { id: "t1", name: "Infra", role: "admin" } }),
    ]
    render(<SandboxTable sandboxes={sandboxes} />)
    expect(screen.getByText("Scope")).toBeInTheDocument()
    expect(screen.getByText("Personal")).toBeInTheDocument()
    expect(screen.getByText("Infra")).toBeInTheDocument()
  })

  // --- RBAC: delete button visibility ---

  it("shows Delete button for personal sandboxes when onDelete is provided", () => {
    const onDelete = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox()]}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByTitle("Delete")).toBeInTheDocument()
  })

  it("shows Delete button for team owner", () => {
    const onDelete = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ team: { id: "t1", role: "owner" } })]}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByTitle("Delete")).toBeInTheDocument()
  })

  it("shows Delete button for team admin", () => {
    const onDelete = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ team: { id: "t1", role: "admin" } })]}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByTitle("Delete")).toBeInTheDocument()
  })

  it("hides Delete button for team member", () => {
    const onDelete = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ team: { id: "t1", role: "member" } })]}
        onDelete={onDelete}
      />,
    )
    expect(screen.queryByTitle("Delete")).not.toBeInTheDocument()
  })

  it("hides Delete button for team viewer", () => {
    const onDelete = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ team: { id: "t1", role: "viewer" } })]}
        onDelete={onDelete}
      />,
    )
    expect(screen.queryByTitle("Delete")).not.toBeInTheDocument()
  })

  it("hides Delete button entirely when onDelete is not provided", () => {
    render(<SandboxTable sandboxes={[makeSandbox()]} />)
    expect(screen.queryByTitle("Delete")).not.toBeInTheDocument()
  })

  // --- Resume / Wake affordances for non-running sandboxes ---

  const RESUMABLE_STATUSES: SandboxStatus[] = [
    "stopped",
    "failed",
    "hibernating",
    "archived",
  ]

  it.each(RESUMABLE_STATUSES)(
    "renders a Resume button for %s rows when onResume is provided",
    (status) => {
      const onResume = vi.fn()
      render(
        <SandboxTable
          sandboxes={[makeSandbox({ status })]}
          onResume={onResume}
        />,
      )
      // "Wake Up" for hibernating, "Resume" for the rest — both come
      // out of the same dedicated button so the user always has a path
      // back to a running session.
      const label = status === "hibernating" ? "Wake Up" : "Resume"
      const button = screen.getByTitle(label)
      fireEvent.click(button)
      expect(onResume).toHaveBeenCalledWith("sb-1")
    },
  )

  it("does not render a Resume button for running rows", () => {
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "running" })]}
        onResume={vi.fn()}
      />,
    )
    expect(screen.queryByTitle("Resume")).not.toBeInTheDocument()
    expect(screen.queryByTitle("Wake Up")).not.toBeInTheDocument()
  })

  it.each(["provisioning", "creating"] satisfies SandboxStatus[])(
    "does not render a Resume button for %s rows (transitioning)",
    (status) => {
      render(
        <SandboxTable
          sandboxes={[makeSandbox({ status })]}
          onResume={vi.fn()}
        />,
      )
      expect(screen.queryByTitle("Resume")).not.toBeInTheDocument()
      expect(screen.queryByTitle("Wake Up")).not.toBeInTheDocument()
    },
  )

  it("falls back to onWake for hibernating rows when onResume is absent", () => {
    // Back-compat: existing callers wired onWake before onResume existed
    // and only handled the hibernating case. They keep working without
    // changes.
    const onWake = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "hibernating" })]}
        onWake={onWake}
      />,
    )
    fireEvent.click(screen.getByTitle("Wake Up"))
    expect(onWake).toHaveBeenCalledWith("sb-1")
  })

  it("does not use onWake as a fallback for non-hibernating stopped rows", () => {
    // onWake's documented contract was hibernating-only. We deliberately
    // do not extend it to stopped/failed/archived rows on the fallback
    // path — a caller that wants those statuses to be actionable must
    // opt in by passing onResume.
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "stopped" })]}
        onWake={vi.fn()}
      />,
    )
    expect(screen.queryByTitle("Resume")).not.toBeInTheDocument()
    expect(screen.queryByTitle("Wake Up")).not.toBeInTheDocument()
  })

  // --- Row-level click handling ---

  // The row's onClick is a sighted-user convenience. It deliberately
  // does not surface in the a11y tree (no role="button", no tabIndex,
  // no aria-label) — keyboard and screen-reader users reach the same
  // actions through the explicit Resume / Open IDE / Delete <button>
  // elements inside the actions cell. These tests therefore use
  // closest("tr") to grab the row by its content rather than by role.

  function rowFor(name: string): HTMLTableRowElement {
    const row = screen.getByText(name).closest("tr")
    if (!row) throw new Error(`No <tr> ancestor for "${name}"`)
    return row
  }

  it("invokes onOpenIDE when the row body of a running sandbox is clicked", () => {
    const onOpenIDE = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "running" })]}
        onOpenIDE={onOpenIDE}
      />,
    )
    fireEvent.click(rowFor("My Sandbox"))
    expect(onOpenIDE).toHaveBeenCalledWith("sb-1")
  })

  it("invokes onResume when the row body of a stopped sandbox is clicked", () => {
    const onResume = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "stopped" })]}
        onResume={onResume}
      />,
    )
    fireEvent.click(rowFor("My Sandbox"))
    expect(onResume).toHaveBeenCalledWith("sb-1")
  })

  it("does not make provisioning rows clickable", () => {
    // Stacking a second start on top of an in-flight provision would
    // either 409 or race the orchestrator — better to leave the row
    // inert and let the status indicator do its job.
    const onResume = vi.fn()
    const onOpenIDE = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "provisioning" })]}
        onResume={onResume}
        onOpenIDE={onOpenIDE}
      />,
    )
    fireEvent.click(rowFor("My Sandbox"))
    expect(onResume).not.toHaveBeenCalled()
    expect(onOpenIDE).not.toHaveBeenCalled()
  })

  it("stops row-click propagation from action buttons", () => {
    // The Delete trash button sits inside the clickable row. Without
    // stopPropagation the same click would also fire the row's
    // onResume — the user would see a delete dialog AND a resume
    // request in flight.
    const onResume = vi.fn()
    const onDelete = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "stopped" })]}
        onResume={onResume}
        onDelete={onDelete}
      />,
    )
    fireEvent.click(screen.getByTitle("Delete"))
    expect(onDelete).toHaveBeenCalledWith("sb-1")
    expect(onResume).not.toHaveBeenCalled()
  })

  it("does not override the <tr> row role with button on clickable rows", () => {
    // Regression guard for the a11y review (P3): setting
    // role="button" on a <tr> would collapse per-cell announcements
    // for screen-reader users. We rely on the explicit Resume / IDE /
    // Delete buttons for assistive-tech access and keep the row's
    // implicit row role intact.
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "stopped" })]}
        onResume={vi.fn()}
      />,
    )
    const row = rowFor("My Sandbox")
    expect(row).not.toHaveAttribute("role", "button")
    expect(row).not.toHaveAttribute("tabindex")
    expect(row).not.toHaveAttribute("aria-label")
  })

  // --- Overflow menu (issue #1190 / sandbox-ui#0.16.2) ---

  // The legacy `onMore` button shared its `Code2` icon with the IDE
  // quick-action, so a running row rendered two visually identical
  // buttons that did the same thing. The fix swaps that button for a
  // `MoreVertical` dropdown trigger and lifts the missing lifecycle/
  // observability actions out of `SandboxCard` so the two views expose
  // an identical action set. These tests assert that exposure.

  it("renders exactly one IDE quick-action button on running rows (no duplicate Code2)", () => {
    // Regression guard for #1190: previously, passing onMore on a
    // running row drew a second Code2 icon next to the Open IDE
    // button. The overflow trigger is now a MoreVertical icon, and
    // onMore lives inside the dropdown menu.
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "running" })]}
        onOpenIDE={vi.fn()}
        onOpenTerminal={vi.fn()}
        onSSH={vi.fn()}
        onMore={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getAllByTitle("Open IDE")).toHaveLength(1)
    // The overflow trigger is rendered, but uses a distinct icon and
    // title so it is no longer mistaken for the IDE button.
    expect(screen.getByTitle("More actions")).toBeInTheDocument()
  })

  it("does not render the overflow trigger when no overflow callbacks are passed", () => {
    // Empty menus would be a worse experience than no menu at all.
    // The trigger only appears when at least one item would render.
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "running" })]}
        onOpenIDE={vi.fn()}
      />,
    )
    expect(screen.queryByTitle("More actions")).not.toBeInTheDocument()
  })

  it("does not render the overflow trigger for provisioning rows without onMore", () => {
    // Provisioning rows have no lifecycle / fork affordance — Stop /
    // KeepAlive / Fork are all gated to `isActive`. Without onMore the
    // menu would be empty.
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "provisioning" })]}
        onStop={vi.fn()}
        onKeepAlive={vi.fn()}
        onFork={vi.fn()}
        onUsage={vi.fn()}
        onHealth={vi.fn()}
      />,
    )
    expect(screen.queryByTitle("More actions")).not.toBeInTheDocument()
  })

  it("renders Stop / Keep Alive / Usage / Health / Fork / View Details for running rows", async () => {
    // Mirrors `SandboxCard`'s running-state dropdown so the user gets
    // the same action set regardless of which view they're in.
    const user = userEvent.setup()
    const handlers = {
      onStop: vi.fn(),
      onKeepAlive: vi.fn(),
      onUsage: vi.fn(),
      onHealth: vi.fn(),
      onFork: vi.fn(),
      onMore: vi.fn(),
    }
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "running" })]}
        {...handlers}
      />,
    )
    await user.click(screen.getByTitle("More actions"))
    expect(await screen.findByText("Stop Sandbox")).toBeInTheDocument()
    expect(screen.getByText("Keep Alive")).toBeInTheDocument()
    expect(screen.getByText("View Usage")).toBeInTheDocument()
    expect(screen.getByText("Health Check")).toBeInTheDocument()
    expect(screen.getByText("Fork Sandbox")).toBeInTheDocument()
    expect(screen.getByText("View Details")).toBeInTheDocument()
  })

  it.each([
    { item: "Stop Sandbox", prop: "onStop" as const },
    { item: "Keep Alive", prop: "onKeepAlive" as const },
    { item: "View Usage", prop: "onUsage" as const },
    { item: "Health Check", prop: "onHealth" as const },
    { item: "Fork Sandbox", prop: "onFork" as const },
    { item: "View Details", prop: "onMore" as const },
  ])("fires $prop with the row id when $item is clicked", async ({ item, prop }) => {
    const user = userEvent.setup()
    const handler = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "running" })]}
        {...{ [prop]: handler }}
      />,
    )
    await user.click(screen.getByTitle("More actions"))
    await user.click(await screen.findByText(item))
    expect(handler).toHaveBeenCalledWith("sb-1")
  })

  it("limits resumable rows to Fork and View Details in the overflow menu", async () => {
    // Stop / KeepAlive / Usage / Health are running-only — exposing
    // them on a stopped row would either 4xx or fire on a sandbox the
    // user can't currently interact with.
    const user = userEvent.setup()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "stopped" })]}
        onResume={vi.fn()}
        onStop={vi.fn()}
        onKeepAlive={vi.fn()}
        onUsage={vi.fn()}
        onHealth={vi.fn()}
        onFork={vi.fn()}
        onMore={vi.fn()}
      />,
    )
    await user.click(screen.getByTitle("More actions"))
    expect(await screen.findByText("Fork Sandbox")).toBeInTheDocument()
    expect(screen.getByText("View Details")).toBeInTheDocument()
    expect(screen.queryByText("Stop Sandbox")).not.toBeInTheDocument()
    expect(screen.queryByText("Keep Alive")).not.toBeInTheDocument()
    expect(screen.queryByText("View Usage")).not.toBeInTheDocument()
    expect(screen.queryByText("Health Check")).not.toBeInTheDocument()
  })

  it("limits transitioning rows to View Details in the overflow menu", async () => {
    const user = userEvent.setup()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "provisioning" })]}
        onFork={vi.fn()}
        onMore={vi.fn()}
      />,
    )
    await user.click(screen.getByTitle("More actions"))
    expect(await screen.findByText("View Details")).toBeInTheDocument()
    expect(screen.queryByText("Fork Sandbox")).not.toBeInTheDocument()
  })

  it("does not fire the row's onResume when the overflow trigger is clicked", async () => {
    // The trigger sits inside the clickable row. Without
    // stopPropagation, opening the menu would also fire the row-click
    // resume action.
    const user = userEvent.setup()
    const onResume = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "stopped" })]}
        onResume={onResume}
        onFork={vi.fn()}
      />,
    )
    await user.click(screen.getByTitle("More actions"))
    expect(onResume).not.toHaveBeenCalled()
  })

  it("does not fire the row's onResume when a menu item is clicked", async () => {
    // The dropdown content renders through a portal but React's
    // synthetic events still bubble up the React tree — without
    // stopPropagation on the item, clicking "Fork Sandbox" inside the
    // menu would also fire the row's onResume.
    const user = userEvent.setup()
    const onResume = vi.fn()
    const onFork = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "stopped" })]}
        onResume={onResume}
        onFork={onFork}
      />,
    )
    await user.click(screen.getByTitle("More actions"))
    await user.click(await screen.findByText("Fork Sandbox"))
    expect(onFork).toHaveBeenCalledWith("sb-1")
    expect(onResume).not.toHaveBeenCalled()
  })

  it("does not fire the row's onOpenIDE when a menu item is clicked on running rows", async () => {
    const user = userEvent.setup()
    const onOpenIDE = vi.fn()
    const onStop = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "running" })]}
        onOpenIDE={onOpenIDE}
        onStop={onStop}
      />,
    )
    await user.click(screen.getByTitle("More actions"))
    await user.click(await screen.findByText("Stop Sandbox"))
    expect(onStop).toHaveBeenCalledWith("sb-1")
    expect(onOpenIDE).not.toHaveBeenCalled()
  })
})
