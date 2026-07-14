import { describe, expect, it } from "vitest"
import { modelBrandFor, resolveModelBrandIdentity } from "./model-brand"

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

/**
 * `resolveModelBrandIdentity` is the layer under {@link modelBrandFor}: it takes a
 * whole `ModelInfo` (which the picker has and a workflow node does not) and answers
 * WHO hosts the model and WHO made it. Two marks, or one where they are the same.
 *
 * Almost all of it is a precedence chain, and a precedence chain is exactly the kind
 * of thing that reorders silently under a refactor — so each rung gets a test.
 */
describe("resolveModelBrandIdentity", () => {
  it("takes the host and the lab straight from `logos` when they are given", () => {
    // An explicit override outranks everything the id could imply.
    const identity = resolveModelBrandIdentity({
      id: "anthropic/claude-sonnet-4-5",
      _provider: "openai",
      logos: { host: "groq", lab: "meta" },
    })
    expect(identity.host.key).toBe("groq")
    expect(identity.lab.key).toBe("meta")
    expect(identity.combined).toBe(false)
  })

  it("prefers `hostProvider` over the router's provider fields", () => {
    // A gateway can serve someone else's model: the HOST is who takes the request.
    const identity = resolveModelBrandIdentity({
      id: "claude-sonnet-4-5",
      hostProvider: "openrouter",
      _provider: "anthropic",
      provider: "openai",
    })
    expect(identity.host.key).toBe("openrouter")
  })

  it("falls back through `_provider`, then `provider`, then the id's first segment", () => {
    expect(
      resolveModelBrandIdentity({ id: "x", _provider: "groq", provider: "openai" })
        .host.key,
    ).toBe("groq")
    expect(resolveModelBrandIdentity({ id: "x", provider: "openai" }).host.key).toBe(
      "openai",
    )
    expect(resolveModelBrandIdentity({ id: "mistral/mixtral" }).host.key).toBe(
      "mistral",
    )
  })

  it("takes the lab from `modelLab` before inferring it from the id", () => {
    const identity = resolveModelBrandIdentity({
      id: "openrouter/some-model",
      modelLab: "deepseek",
    })
    expect(identity.lab.key).toBe("deepseek")
  })

  it("infers the lab from the model id when nothing declares it", () => {
    // The id is the last thing left, and usually enough: a name carries its lab.
    expect(
      resolveModelBrandIdentity({ id: "openrouter/claude-sonnet-4-5" }).lab.key,
    ).toBe("anthropic")
    expect(resolveModelBrandIdentity({ id: "groq/llama-3.3-70b" }).lab.key).toBe(
      "meta",
    )
  })

  it("reports ONE mark when the lab hosts its own model", () => {
    // `combined` is what decides whether the card draws a stack or a single glyph.
    expect(
      resolveModelBrandIdentity({ id: "anthropic/claude-sonnet-4-5" }).combined,
    ).toBe(true)
    expect(
      resolveModelBrandIdentity({ id: "openrouter/anthropic/claude-sonnet-4-5" })
        .combined,
    ).toBe(false)
  })

  it("uses a caller's own artwork over the bundled glyph, and marks it full-colour", () => {
    // A host-supplied logo may be full-colour art; the bundled marks are monochrome
    // masks tinted with the foreground token, so the two cannot be rendered alike.
    const identity = resolveModelBrandIdentity({
      id: "anthropic/claude-sonnet-4-5",
      logos: { hostUrl: "https://cdn.example/host.svg" },
    })
    expect(identity.host.logoUrl).toBe("https://cdn.example/host.svg")
    expect(identity.host.monochrome).toBe(false)
  })

  it("answers with the unknown brand rather than throwing on a model it cannot place", () => {
    const identity = resolveModelBrandIdentity({ id: "some-internal/model-x" })
    expect(identity.host.key).toBe("unknown")
    expect(identity.lab.key).toBe("unknown")
  })
})
