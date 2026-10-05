import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { SandboxStatus } from "./sandbox-card"
import { SANDBOX_STATUS, SandboxStatusPill, sandboxStatus } from "./sandbox-status"

const ALL: SandboxStatus[] = ["running", "hibernating", "provisioning", "stopped", "failed", "archived", "creating", "expired"]

describe("sandbox lifecycle adapter", () => {
  it("maps every lifecycle state to a label and a status tone", () => {
    for (const status of ALL) expect(SANDBOX_STATUS[status].label).toBeTruthy()
    expect(SANDBOX_STATUS.running.tone).toBe("success")
    expect(SANDBOX_STATUS.creating.tone).toBe("running")
    expect(SANDBOX_STATUS.failed.tone).toBe("danger")
    expect(SANDBOX_STATUS.stopped.tone).toBe("neutral")
  })

  it("names an unknown future state instead of hiding it", () => {
    expect(sandboxStatus("migrating")).toEqual({ label: "Migrating", tone: "neutral" })
  })

  it("renders ui's StatusPill with a glyph and the state's label", () => {
    const { container } = render(<SandboxStatusPill status="failed" />)
    expect(screen.getByText("Failed")).toBeInTheDocument()
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull()
    expect((container.firstElementChild as HTMLElement).className).toContain("--surface-danger-")
  })
})
