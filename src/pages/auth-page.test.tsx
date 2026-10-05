import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AuthPage } from "./auth-page"

function card() {
  // The card is the element that holds the Tangle wordmark.
  return screen.getByText("Tangle", { selector: "span" }).closest("div[style*='max-width']") as HTMLElement
}

describe("AuthPage theming", () => {
  it("paints the card from theme tokens and gives the wordmark the card's ink", () => {
    render(<AuthPage product="Tax" providers={[]} />)
    const style = card().getAttribute("style") ?? ""
    // A fixed #ffffff card left the inherited near-white dark-mode wordmark unreadable.
    expect(style).toContain("var(--card,")
    expect(style).toContain("var(--card-foreground,")
  })

  it("inverts the default Tangle button with the theme", () => {
    render(<AuthPage providers={[]} />)
    const style = screen.getByRole("link", { name: /continue with tangle/i }).getAttribute("style") ?? ""
    expect(style).toContain("var(--foreground,")
    expect(style).toContain("var(--background,")
  })

  it("keeps a white label on a product accent", () => {
    render(<AuthPage providers={[]} accent="rgb(80, 71, 235)" />)
    const link = screen.getByRole("link", { name: /continue with tangle/i })
    expect(link.style.background).toBe("rgb(80, 71, 235)")
    expect(link.style.color).toBe("rgb(255, 255, 255)")
  })
})
