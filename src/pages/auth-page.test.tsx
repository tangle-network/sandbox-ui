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

  it("puts every control on the control scale's 44px lg row", () => {
    render(<AuthPage providers={["github"]} onEmailSubmit={async () => null} />)
    const controls = [
      screen.getByRole("link", { name: /continue with tangle/i }),
      screen.getByRole("button", { name: /continue with github/i }),
      screen.getByRole("textbox", { name: "Email" }),
      screen.getByLabelText("Password"),
      screen.getByRole("button", { name: /sign in with email/i }),
    ]
    for (const control of controls) {
      const style = control.getAttribute("style") ?? ""
      expect(style).toContain("var(--control-height-lg, 2.75rem)")
      expect(style).toContain("var(--control-text-lg, 1rem)")
    }
  })

  it("paints every field as a surface-ladder well with the 3:1 field border and keeps the focus line", () => {
    render(<AuthPage mode="signup" providers={[]} onEmailSubmit={async () => null} />)
    // The card opens Brand's surface context, so --well is the card's well inside it.
    expect(card().getAttribute("data-slot")).toBe("card")
    const fields = [
      screen.getByRole("textbox", { name: "Name" }),
      screen.getByRole("textbox", { name: "Email" }),
      screen.getByLabelText("Password"),
    ]
    for (const field of fields) {
      // --bg-input sat 2.6 L under a white card and the hairline edged it at 1.5:1.
      expect(field.className).toContain("bg-[var(--field-surface,var(--well))]")
      expect(field.className).toContain("border-[var(--field-border)]")
      // An inline outline: none hid Brand's focus line on every field.
      expect(field.style.outline).toBe("")
    }
  })

  it("gives every control the shared ring-hue hover, and no inline edge to outrank it", () => {
    render(<AuthPage mode="signup" providers={["github"]} onEmailSubmit={async () => null} />)
    const controls = [
      screen.getByRole("link", { name: /sign up with tangle/i }),
      screen.getByRole("button", { name: /continue with github/i }),
      screen.getByRole("button", { name: /create account with email/i }),
    ]
    for (const control of controls) {
      expect(control.className).toContain("hover:shadow-[var(--ix-hover)]")
      expect(control.className).toContain("active:shadow-[var(--ix-press)]")
      // An inline border or box-shadow beats every class, which left these with no hover state.
      expect(control.style.border).toBe("")
      expect(control.style.borderColor).toBe("")
      expect(control.style.boxShadow).toBe("")
    }
    for (const field of [screen.getByRole("textbox", { name: "Name" }), screen.getByRole("textbox", { name: "Email" }), screen.getByLabelText("Password")]) {
      expect(field.className).toContain("hover:shadow-[var(--shadow-well),var(--ix-hover)]")
      expect(field.style.border).toBe("")
      expect(field.style.background).toBe("")
    }
  })
})
