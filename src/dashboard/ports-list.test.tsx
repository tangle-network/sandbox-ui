import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { PortsList } from "./ports-list"

describe("PortsList exposure validation", () => {
  it("rejects fractional, out-of-range, and already exposed ports without truncating", () => {
    const onExposePort = vi.fn()
    render(
      <PortsList
        ports={[{ port: 3000, url: "https://3000.example.com", status: "active" }]}
        onExposePort={onExposePort}
      />,
    )

    const input = screen.getByRole("spinbutton", { name: "Port number" })
    const button = screen.getByRole("button", { name: "Expose" })
    for (const value of ["3.5", "0", "65536", "3000"]) {
      fireEvent.change(input, { target: { value } })
      expect(input).toHaveAttribute("aria-invalid", "true")
      expect(button).toBeDisabled()
      fireEvent.keyDown(input, { key: "Enter" })
    }
    expect(onExposePort).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: "8080" } })
    expect(button).toBeEnabled()
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onExposePort).toHaveBeenCalledExactlyOnceWith(8080)
    expect(input).toHaveValue(null)
  })
})
