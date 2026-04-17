import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CreditBalance } from "./credit-balance"

describe("CreditBalance", () => {
  it("renders the balance amount", () => {
    render(<CreditBalance amount={42.5} />)
    expect(screen.getByText("$42.50")).toBeInTheDocument()
  })

  it("does not render top-up controls when onTopUp is omitted", () => {
    render(<CreditBalance amount={10} />)
    expect(screen.queryByText("Top Up")).not.toBeInTheDocument()
  })

  // --- Input formatting ---

  describe("input formatting", () => {
    it("strips non-numeric characters except dot", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(<CreditBalance amount={0} onTopUp={onTopUp} />)

      const input = screen.getByDisplayValue("$50.00")
      await user.clear(input)
      await user.type(input, "abc12.34xyz")

      expect(input).toHaveValue("$12.34")
    })

    it("limits to 2 decimal places", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(<CreditBalance amount={0} onTopUp={onTopUp} />)

      const input = screen.getByDisplayValue("$50.00")
      await user.clear(input)
      await user.type(input, "1.999")

      // Only the first 2 decimal digits are kept
      expect(input).toHaveValue("$1.99")
    })

    it("normalises multiple dots to first valid segment", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(<CreditBalance amount={0} onTopUp={onTopUp} />)

      const input = screen.getByDisplayValue("$50.00")
      await user.clear(input)
      await user.type(input, "1.2.3.4")

      // Per-keystroke: "1.2" accepted, second "." discarded, "3" appends → "1.23", ".4" discarded
      expect(input).toHaveValue("$1.23")
    })
  })

  // --- Top Up button validation ---

  describe("top up button validation", () => {
    it("calls onTopUp with valid parsed float", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(<CreditBalance amount={0} onTopUp={onTopUp} />)

      // Default value is 50.00
      await user.click(screen.getByText("Top Up"))
      expect(onTopUp).toHaveBeenCalledWith(50)
    })

    it("does not call onTopUp when input is empty", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(<CreditBalance amount={0} onTopUp={onTopUp} />)

      const input = screen.getByDisplayValue("$50.00")
      await user.clear(input)
      await user.click(screen.getByText("Top Up"))

      expect(onTopUp).not.toHaveBeenCalled()
    })

    it("does not call onTopUp when input is '0'", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(<CreditBalance amount={0} onTopUp={onTopUp} />)

      const input = screen.getByDisplayValue("$50.00")
      await user.clear(input)
      await user.type(input, "0")
      await user.click(screen.getByText("Top Up"))

      expect(onTopUp).not.toHaveBeenCalled()
    })

    it("does not call onTopUp when input is '.'", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(<CreditBalance amount={0} onTopUp={onTopUp} />)

      const input = screen.getByDisplayValue("$50.00")
      await user.clear(input)
      await user.type(input, ".")
      await user.click(screen.getByText("Top Up"))

      expect(onTopUp).not.toHaveBeenCalled()
    })
  })

  // --- Quick-amount buttons ---

  describe("quick-amount buttons", () => {
    it("calls onTopUp with the quick amount value", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(<CreditBalance amount={0} onTopUp={onTopUp} />)

      await user.click(screen.getByText("+$25"))
      expect(onTopUp).toHaveBeenCalledWith(25)
    })

    it("does not render buttons for invalid quick amounts", async () => {
      const user = userEvent.setup()
      const onTopUp = vi.fn()
      render(
        <CreditBalance amount={0} onTopUp={onTopUp} quickAmounts={[0, -5, 10]} />,
      )

      expect(screen.queryByText("+$0")).not.toBeInTheDocument()
      expect(screen.queryByText("+$-5")).not.toBeInTheDocument()

      await user.click(screen.getByText("+$10"))
      expect(onTopUp).toHaveBeenCalledWith(10)
      expect(onTopUp).toHaveBeenCalledTimes(1)
    })
  })
})
