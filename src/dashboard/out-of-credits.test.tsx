import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  OutOfCreditsModal,
  parseInsufficientBalance,
} from "./out-of-credits"

describe("parseInsufficientBalance", () => {
  it("parses a canonical 402 insufficient_balance body", () => {
    const r = parseInsufficientBalance({
      error: "Insufficient balance.",
      code: "insufficient_balance",
      manageUrl: "https://id.tangle.tools/billing",
      plan: "free",
      remainingBalanceUsd: 0,
    })
    expect(r).toEqual({
      manageUrl: "https://id.tangle.tools/billing",
      plan: "free",
      remainingBalanceUsd: 0,
      message: "Insufficient balance.",
    })
  })

  it("returns null for non-insufficient-balance payloads", () => {
    expect(parseInsufficientBalance({ code: "rate_limited" })).toBeNull()
    expect(parseInsufficientBalance({ error: "boom" })).toBeNull()
    expect(parseInsufficientBalance(null)).toBeNull()
    expect(parseInsufficientBalance("nope")).toBeNull()
  })

  it("falls back to defaultManageUrl when the body omits manageUrl", () => {
    const r = parseInsufficientBalance(
      { code: "insufficient_balance" },
      { defaultManageUrl: "https://id.tangle.tools/billing" },
    )
    expect(r?.manageUrl).toBe("https://id.tangle.tools/billing")
  })

  it("returns null when neither manageUrl nor a default is available (no dead CTA)", () => {
    expect(parseInsufficientBalance({ code: "insufficient_balance" })).toBeNull()
  })
})

describe("OutOfCreditsModal", () => {
  const balance = {
    manageUrl: "https://id.tangle.tools/billing",
    plan: "free",
    remainingBalanceUsd: 0,
  }

  it("renders nothing when balance is null", () => {
    const { container } = render(<OutOfCreditsModal balance={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the CTA linking to the platform billing page", () => {
    render(<OutOfCreditsModal balance={balance} />)
    expect(screen.getByText("You're out of credits")).toBeInTheDocument()
    const cta = screen.getByRole("link", { name: "Add credits" })
    expect(cta).toHaveAttribute("href", "https://id.tangle.tools/billing")
  })

  it("shows a dismiss control only when onClose is provided (hard paywall otherwise)", async () => {
    const onClose = vi.fn()
    const { rerender } = render(<OutOfCreditsModal balance={balance} />)
    expect(screen.queryByText("Not now")).not.toBeInTheDocument()
    rerender(<OutOfCreditsModal balance={balance} onClose={onClose} />)
    const dismiss = screen.getByText("Not now")
    await userEvent.click(dismiss)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
