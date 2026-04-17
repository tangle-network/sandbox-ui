import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SandboxTable } from "./sandbox-table"
import type { SandboxCardData } from "./sandbox-card"

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

  it("renders 'Personal' badge for non-team sandboxes", () => {
    render(<SandboxTable sandboxes={[makeSandbox()]} />)
    expect(screen.getByText("Personal")).toBeInTheDocument()
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
})
