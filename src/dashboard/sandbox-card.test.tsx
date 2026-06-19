import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  SandboxCard,
  canAdminSandbox,
  type SandboxCardData,
} from "./sandbox-card"
import type { SandboxStatus } from "./sandbox-card"

function makeSandbox(overrides: Partial<SandboxCardData> = {}): SandboxCardData {
  return {
    id: "sb-1",
    name: "My Sandbox",
    status: "running",
    ...overrides,
  }
}

// --- Unit tests for the exported authorization helper ---

describe("canAdminSandbox", () => {
  it("returns true for personal sandboxes (no team)", () => {
    expect(canAdminSandbox(makeSandbox())).toBe(true)
  })

  it("returns true for team owner", () => {
    expect(
      canAdminSandbox(makeSandbox({ team: { id: "t1", role: "owner" } })),
    ).toBe(true)
  })

  it("returns true for team admin", () => {
    expect(
      canAdminSandbox(makeSandbox({ team: { id: "t1", role: "admin" } })),
    ).toBe(true)
  })

  it("returns false for team member", () => {
    expect(
      canAdminSandbox(makeSandbox({ team: { id: "t1", role: "member" } })),
    ).toBe(false)
  })

  it("returns false for team viewer", () => {
    expect(
      canAdminSandbox(makeSandbox({ team: { id: "t1", role: "viewer" } })),
    ).toBe(false)
  })
})

// --- SandboxCard rendering tests ---

describe("SandboxCard", () => {
  it("renders sandbox name", () => {
    render(<SandboxCard sandbox={makeSandbox({ name: "Test Box" })} />)
    expect(screen.getByText("Test Box")).toBeInTheDocument()
  })

  it("renders team badge when team is present", () => {
    const sandbox = makeSandbox({
      team: { id: "t1", name: "Alpha Team", role: "member" },
    })
    render(<SandboxCard sandbox={sandbox} />)
    expect(screen.getByText("Alpha Team")).toBeInTheDocument()
  })

  it("shows team role in metadata", () => {
    const sandbox = makeSandbox({
      team: { id: "t1", name: "Alpha Team", role: "viewer" },
    })
    render(<SandboxCard sandbox={sandbox} />)
    expect(screen.getByText(/your role: viewer/)).toBeInTheDocument()
  })

  it("shows Delete for personal sandboxes when onDelete is provided", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({ status: "stopped" })}
        onDelete={onDelete}
      />,
    )

    // Open the dropdown
    await user.click(screen.getByLabelText("Sandbox options"))
    expect(screen.getByText("Delete Sandbox")).toBeInTheDocument()
  })

  it("shows Delete for team owner", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({
          status: "stopped",
          team: { id: "t1", role: "owner" },
        })}
        onDelete={onDelete}
      />,
    )

    await user.click(screen.getByLabelText("Sandbox options"))
    expect(screen.getByText("Delete Sandbox")).toBeInTheDocument()
  })

  it("hides Delete for team member", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({
          status: "stopped",
          team: { id: "t1", role: "member" },
        })}
        onDelete={onDelete}
      />,
    )

    await user.click(screen.getByLabelText("Sandbox options"))
    expect(screen.queryByText("Delete Sandbox")).not.toBeInTheDocument()
  })

  it("hides Delete for team viewer", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({
          status: "stopped",
          team: { id: "t1", role: "viewer" },
        })}
        onDelete={onDelete}
      />,
    )

    await user.click(screen.getByLabelText("Sandbox options"))
    expect(screen.queryByText("Delete Sandbox")).not.toBeInTheDocument()
  })
})

// --- Footer + dropdown Resume/Wake handler resolution (issue #114) ---
//
// The footer action and the dropdown "Resume" item must resolve to the
// same single start handler. Prefer onResume; fall back to onWake only
// for a hibernating card. A clickable start must never silently no-op.

describe("SandboxCard resume/wake resolution", () => {
  it("footer calls onResume when only onResume is provided (no silent no-op)", async () => {
    const user = userEvent.setup()
    const onResume = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({ status: "stopped" })}
        onResume={onResume}
      />,
    )
    await user.click(screen.getByRole("button", { name: /resume sandbox/i }))
    expect(onResume).toHaveBeenCalledWith("sb-1")
  })

  it("footer prefers onResume over onWake when both are provided", async () => {
    const user = userEvent.setup()
    const onResume = vi.fn()
    const onWake = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({ status: "hibernating" })}
        onResume={onResume}
        onWake={onWake}
      />,
    )
    await user.click(screen.getByRole("button", { name: /wake sandbox/i }))
    expect(onResume).toHaveBeenCalledWith("sb-1")
    expect(onWake).not.toHaveBeenCalled()
  })

  it("footer falls back to onWake for a hibernating card when onResume is absent", async () => {
    const user = userEvent.setup()
    const onWake = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({ status: "hibernating" })}
        onWake={onWake}
      />,
    )
    await user.click(screen.getByRole("button", { name: /wake sandbox/i }))
    expect(onWake).toHaveBeenCalledWith("sb-1")
  })

  it.each(["stopped", "failed", "archived"] satisfies SandboxStatus[])(
    "disables the footer for a %s card when only onWake is provided",
    (status) => {
      // onWake's historical contract was hibernating-only. We do not
      // extend it to stopped/failed/archived, so the start affordance
      // must be inert rather than fire-and-nothing.
      render(
        <SandboxCard
          sandbox={makeSandbox({ status })}
          onWake={vi.fn()}
        />,
      )
      expect(
        screen.getByRole("button", { name: /resume sandbox/i }),
      ).toBeDisabled()
    },
  )

  it("disables the footer action when neither onResume nor onWake is provided", () => {
    render(<SandboxCard sandbox={makeSandbox({ status: "stopped" })} />)
    expect(
      screen.getByRole("button", { name: /resume sandbox/i }),
    ).toBeDisabled()
  })

  it("keeps the footer disabled with 'Starting...' while transitioning", () => {
    render(
      <SandboxCard
        sandbox={makeSandbox({ status: "provisioning" })}
        onResume={vi.fn()}
      />,
    )
    const button = screen.getByRole("button", { name: /starting/i })
    expect(button).toBeDisabled()
  })

  it("dropdown Resume calls the resolved onResume handler", async () => {
    const user = userEvent.setup()
    const onResume = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({ status: "stopped" })}
        onResume={onResume}
      />,
    )
    await user.click(screen.getByLabelText("Sandbox options"))
    await user.click(screen.getByRole("menuitem", { name: /resume sandbox/i }))
    expect(onResume).toHaveBeenCalledWith("sb-1")
  })

  it("footer and dropdown resolve to the same single handler", async () => {
    // With both onResume and onWake wired, each control fires exactly
    // one handler (onResume), and onWake is never reached.
    const user = userEvent.setup()
    const onResume = vi.fn()
    const onWake = vi.fn()
    render(
      <SandboxCard
        sandbox={makeSandbox({ status: "stopped" })}
        onResume={onResume}
        onWake={onWake}
      />,
    )

    await user.click(screen.getByRole("button", { name: /resume sandbox/i }))
    await user.click(screen.getByLabelText("Sandbox options"))
    await user.click(screen.getByRole("menuitem", { name: /resume sandbox/i }))

    expect(onResume).toHaveBeenCalledTimes(2)
    expect(onResume).toHaveBeenNthCalledWith(1, "sb-1")
    expect(onResume).toHaveBeenNthCalledWith(2, "sb-1")
    expect(onWake).not.toHaveBeenCalled()
  })

  it("does not render a dropdown Resume item when no start handler is provided", async () => {
    const user = userEvent.setup()
    render(<SandboxCard sandbox={makeSandbox({ status: "stopped" })} />)
    await user.click(screen.getByLabelText("Sandbox options"))
    expect(
      screen.queryByRole("menuitem", { name: /resume sandbox/i }),
    ).not.toBeInTheDocument()
  })
})
