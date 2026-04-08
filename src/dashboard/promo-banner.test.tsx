import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PromoBanner } from "./promo-banner"

describe("PromoBanner", () => {
  const baseProps = {
    title: "Upgrade your plan",
    description: "Get more resources for your sandboxes.",
    buttonLabel: "Learn more",
  }

  it("renders title, description, and button label", () => {
    render(<PromoBanner {...baseProps} />)
    expect(screen.getByText("Upgrade your plan")).toBeInTheDocument()
    expect(screen.getByText("Get more resources for your sandboxes.")).toBeInTheDocument()
    expect(screen.getByText("Learn more")).toBeInTheDocument()
  })

  it("renders a <button> when no href is provided", () => {
    render(<PromoBanner {...baseProps} onClick={() => {}} />)
    const button = screen.getByRole("button", { name: /learn more/i })
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe("BUTTON")
  })

  it("renders an <a> element when href is provided (no nested button)", () => {
    render(<PromoBanner {...baseProps} href="https://example.com" />)
    const link = screen.getByRole("link", { name: /learn more/i })
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("href", "https://example.com")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    // Ensure no <button> inside the <a>
    expect(link.querySelector("button")).toBeNull()
  })

  it("fires onClick when button is clicked", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<PromoBanner {...baseProps} onClick={onClick} />)
    await user.click(screen.getByRole("button", { name: /learn more/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("fires onClick on anchor when href and onClick are both provided", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<PromoBanner {...baseProps} href="https://example.com" onClick={onClick} />)
    const link = screen.getByRole("link", { name: /learn more/i })
    await user.click(link)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("disables the button when disabled prop is true", () => {
    render(<PromoBanner {...baseProps} disabled />)
    const button = screen.getByRole("button", { name: /learn more/i })
    expect(button).toBeDisabled()
  })

  it("renders the icon slot when provided", () => {
    render(<PromoBanner {...baseProps} icon={<span data-testid="test-icon">Icon</span>} />)
    expect(screen.getByTestId("test-icon")).toBeInTheDocument()
  })

  it("uses CSS variable for background color (not hardcoded hex)", () => {
    const { container } = render(<PromoBanner {...baseProps} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain("bg-[var(--brand-strong)]")
    expect(wrapper.className).not.toContain("#2E2A5E")
  })

  it("applies custom className", () => {
    const { container } = render(<PromoBanner {...baseProps} className="my-custom-class" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain("my-custom-class")
  })
})
