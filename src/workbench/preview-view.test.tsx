import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PreviewView } from "./preview-view"

const current = "https://preview.example.test/current"
function go(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Preview address" }), { target: { value } })
  fireEvent.submit(screen.getByRole("form", { name: "Preview navigation" }))
}

describe("PreviewView", () => {
  it("keeps the frame on its current URL during editing and navigates only on submission", () => {
    const { container } = render(<PreviewView url={current} />)
    fireEvent.change(screen.getByRole("textbox", { name: "Preview address" }), { target: { value: "/next" } })
    expect(container.querySelector("iframe")).toHaveAttribute("src", current)
    expect(screen.getByRole("link", { name: "Open preview in new tab" })).toHaveAttribute("href", current)
    fireEvent.submit(screen.getByRole("form", { name: "Preview navigation" }))
    expect(container.querySelector("iframe")).toHaveAttribute("src", "https://preview.example.test/next")
  })
  it("accepts keyboard form submission without a pointer", async () => {
    const user = userEvent.setup()
    const { container } = render(<PreviewView url={current} />)
    const input = screen.getByRole("textbox", { name: "Preview address" })
    await user.clear(input); await user.type(input, "/keyboard{Enter}")
    expect(container.querySelector("iframe")).toHaveAttribute("src", "https://preview.example.test/keyboard")
  })
  it("rejects a non-web address without changing the running frame", () => {
    const { container } = render(<PreviewView url={current} />)
    go("javascript:alert(1)")
    expect(container.querySelector("iframe")).toHaveAttribute("src", current)
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toHaveTextContent("HTTPS")
  })
  it("does not render or link an unsafe initial URL", () => {
    const { container } = render(<PreviewView url="data:text/html,unsafe" />)
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.queryByRole("link", { name: "Open preview in new tab" })).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
  it("does not claim HTTP readiness or private access after iframe load", () => {
    const { container } = render(<PreviewView url={current} />)
    fireEvent.load(container.querySelector("iframe")!)
    expect(screen.getByText("Application readiness not verified")).toBeInTheDocument()
    expect(screen.getByText("Access not verified")).toBeInTheDocument()
    expect(screen.queryByText("Loading preview frame…")).not.toBeInTheDocument()
  })
  it("does not carry old-address readiness or access metadata to a new path", () => {
    render(<PreviewView url={current} access={{ state: "authenticated", source: "enforced-policy" }}
      readiness={{ state: "ready", statusCode: 200, checkedAt: "2026-09-24T00:00:00Z" }} />)
    expect(screen.getByText("Authentication required")).toBeInTheDocument()
    go("/different")
    expect(screen.getByText("Access not verified")).toBeInTheDocument()
    expect(screen.getByText("Application readiness not verified")).toBeInTheDocument()
  })
  it("rejects unapproved navigation and delegates checks only to the product callback", () => {
    const check = vi.fn()
    const { container } = render(<PreviewView url={current} onCheckReadiness={check} />)
    go("https://outside.example.test/")
    expect(screen.getByRole("alert")).toHaveTextContent("not approved")
    expect(container.querySelector("iframe")).toHaveAttribute("src", current)
    expect(check).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Check application" }))
    expect(check).toHaveBeenCalledTimes(1)
  })
  it("does not grant a same-application-origin iframe both scripts and same-origin access", () => {
    const { container } = render(<PreviewView url={`${window.location.origin}/preview-fixture`} />)
    expect(container.querySelector("iframe")?.getAttribute("sandbox")).not.toContain("allow-same-origin")
  })
})
