import { describe, it, expect } from "vitest"
import { formatPrice } from "./pricing-page"

describe("formatPrice", () => {
  it("formats zero cents as $0", () => {
    expect(formatPrice(0)).toBe("$0")
  })

  it("formats whole-dollar amounts without decimals", () => {
    expect(formatPrice(100)).toBe("$1")
    expect(formatPrice(500)).toBe("$5")
    expect(formatPrice(10000)).toBe("$100")
  })

  it("formats fractional-cent amounts with two decimals", () => {
    expect(formatPrice(150)).toBe("$1.50")
    expect(formatPrice(1999)).toBe("$19.99")
    expect(formatPrice(99)).toBe("$0.99")
    expect(formatPrice(1)).toBe("$0.01")
  })

  it("handles large values", () => {
    expect(formatPrice(100000)).toBe("$1000")
    expect(formatPrice(99999)).toBe("$999.99")
  })

  it("returns $0 for NaN", () => {
    expect(formatPrice(NaN)).toBe("$0")
  })

  it("returns $0 for negative values", () => {
    expect(formatPrice(-50)).toBe("$0")
    expect(formatPrice(-1)).toBe("$0")
  })

  it("returns $0 for Infinity", () => {
    expect(formatPrice(Infinity)).toBe("$0")
    expect(formatPrice(-Infinity)).toBe("$0")
  })
})
