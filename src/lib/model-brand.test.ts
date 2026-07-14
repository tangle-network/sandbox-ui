import { describe, expect, it } from "vitest"
import { modelBrandFor } from "./model-brand"

/**
 * `modelBrandFor` is the whole public surface a caller holding a model STRING has:
 * hand it an id, get the mark, or get `null` and keep whatever glyph you had. A
 * caller cannot check the id first — the ids come from a router — so every shape one
 * can arrive in has to answer, not throw.
 */
describe("modelBrandFor", () => {
  it("reads the lab out of a hosted id", () => {
    const brand = modelBrandFor("openrouter/anthropic/claude-sonnet-4-5")
    expect(brand?.host.key).toBe("openrouter")
    expect(brand?.lab.key).toBe("anthropic")
    // Two different marks: the host carries it, the lab made it.
    expect(brand?.combined).toBe(false)
  })

  it("collapses to ONE mark when the lab hosts its own model", () => {
    const brand = modelBrandFor("anthropic/claude-sonnet-4-5")
    expect(brand?.lab.key).toBe("anthropic")
    expect(brand?.combined).toBe(true)
  })

  it("infers the lab from a bare id that names no host", () => {
    expect(modelBrandFor("gpt-5.4")?.lab.key).toBe("openai")
    expect(modelBrandFor("claude-sonnet-4-5")?.lab.key).toBe("anthropic")
  })

  it("answers null for a model with no published mark, rather than inventing one", () => {
    expect(modelBrandFor("some-internal/model-x")).toBeNull()
  })

  it("answers null for nothing at all", () => {
    expect(modelBrandFor("")).toBeNull()
    expect(modelBrandFor("   ")).toBeNull()
  })

  it("survives an id that is only separators", () => {
    // The ids come off a router, not a picker — a malformed one must not take the
    // card down with it.
    expect(() => modelBrandFor("/")).not.toThrow()
    expect(() => modelBrandFor("///")).not.toThrow()
    expect(modelBrandFor("/")).toBeNull()
  })
})
