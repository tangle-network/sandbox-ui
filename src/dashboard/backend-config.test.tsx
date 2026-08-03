import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BackendConfig } from "./backend-config"

const baseProps = {
  status: { running: true, model: "gpt-5", provider: "openai" },
  mcpServers: [],
  onAddMcp: vi.fn(),
  onRemoveMcp: vi.fn(),
}

describe("BackendConfig restart action", () => {
  it("omits restart when the host has no restart operation", () => {
    render(<BackendConfig {...baseProps} />)

    expect(screen.queryByRole("button", { name: "Restart" })).toBeNull()
  })

  it("calls the host restart operation when provided", () => {
    const onRestart = vi.fn()
    render(<BackendConfig {...baseProps} onRestart={onRestart} />)

    fireEvent.click(screen.getByRole("button", { name: "Restart" }))

    expect(onRestart).toHaveBeenCalledOnce()
  })
})
