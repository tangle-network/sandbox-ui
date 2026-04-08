import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { InfoPanel } from "./info-panel"

describe("InfoPanel", () => {
  const baseProps = {
    label: "Security Audit",
    title: "All engines operational.",
    description: "Secrets are encrypted at rest using AES-256.",
  }

  it("renders label, title, and description", () => {
    render(<InfoPanel {...baseProps} />)
    expect(screen.getByText("Security Audit")).toBeInTheDocument()
    expect(screen.getByText("All engines operational.")).toBeInTheDocument()
    expect(screen.getByText("Secrets are encrypted at rest using AES-256.")).toBeInTheDocument()
  })

  it("uses CSS variable for background color (not hardcoded hex)", () => {
    const { container } = render(<InfoPanel {...baseProps} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain("bg-[var(--brand-strong)]")
    expect(wrapper.className).not.toContain("#2E2A5E")
  })

  it("applies custom className", () => {
    const { container } = render(<InfoPanel {...baseProps} className="md:col-span-2" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain("md:col-span-2")
  })

  it("renders label in uppercase tracking style", () => {
    render(<InfoPanel {...baseProps} />)
    const label = screen.getByText("Security Audit")
    expect(label.tagName).toBe("P")
    expect(label.className).toContain("uppercase")
    expect(label.className).toContain("tracking-widest")
  })
})
