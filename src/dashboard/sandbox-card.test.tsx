import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  SandboxCard,
  canAdminSandbox,
  type SandboxCardData,
} from "./sandbox-card"

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
