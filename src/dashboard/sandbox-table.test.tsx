import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
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

  it("invokes onOpenIDE when the row body of a running sandbox is clicked", () => {
    const onOpenIDE = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "running" })]}
        onOpenIDE={onOpenIDE}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Open My Sandbox/ }))
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
    fireEvent.click(screen.getByRole("button", { name: /Resume My Sandbox/ }))
    expect(onResume).toHaveBeenCalledWith("sb-1")
  })

  it("does not make provisioning rows clickable", () => {
    // Stacking a second start on top of an in-flight provision would
    // either 409 or race the orchestrator — better to leave the row
    // inert and let the status indicator do its job.
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "provisioning" })]}
        onResume={vi.fn()}
        onOpenIDE={vi.fn()}
      />,
    )
    expect(screen.queryByRole("button", { name: /My Sandbox/ })).not.toBeInTheDocument()
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

  it("supports keyboard activation of a clickable row", () => {
    const onResume = vi.fn()
    render(
      <SandboxTable
        sandboxes={[makeSandbox({ status: "stopped" })]}
        onResume={onResume}
      />,
    )
    const row = screen.getByRole("button", { name: /Resume My Sandbox/ })
    fireEvent.keyDown(row, { key: "Enter" })
    expect(onResume).toHaveBeenCalledWith("sb-1")
    fireEvent.keyDown(row, { key: " " })
    expect(onResume).toHaveBeenCalledTimes(2)
  })

  it.each(["Enter", " "])(
    "does not fire onResume when %s is pressed on a child action button inside the row",
    (key) => {
      // The row's onKeyDown handler calls preventDefault on Enter/Space
      // to take over keyboard activation. Without a target guard the
      // bubbled keydown from a focused child button (e.g. Delete) would
      // ALSO hit that branch — preventDefault would suppress the
      // button's native activation and the row would fire onResume
      // instead. A keyboard user trying to delete would see a resume.
      const onResume = vi.fn()
      const onDelete = vi.fn()
      render(
        <SandboxTable
          sandboxes={[makeSandbox({ status: "stopped" })]}
          onResume={onResume}
          onDelete={onDelete}
        />,
      )
      fireEvent.keyDown(screen.getByTitle("Delete"), { key })
      expect(onResume).not.toHaveBeenCalled()
    },
  )
})
