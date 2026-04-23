import { describe, expect, it } from "vitest"
import { validateBuiltCss } from "./validate-built-css.mjs"

describe("validateBuiltCss", () => {
  it("passes on a CSS bundle with no URL @imports", () => {
    const css = `:root { --brand: blue; }\n@layer base { body { margin: 0; } }\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })

  it("passes on an empty stylesheet", () => {
    expect(() => validateBuiltCss("")).not.toThrow()
  })

  it("throws when a Google Fonts URL @import is present", () => {
    const css = `@import url("https://fonts.googleapis.com/css2?family=Geist");\n:root { color: red; }\n`
    expect(() => validateBuiltCss(css)).toThrow(/URL @import is not allowed/)
  })

  it("throws when an arbitrary remote URL @import is present", () => {
    const css = `:root { color: red; }\n@import url("https://example.com/font.css");\n`
    expect(() => validateBuiltCss(css)).toThrow(/URL @import is not allowed/)
  })

  it("throws when a URL @import uses single quotes and extra whitespace", () => {
    const css = `@import   url( 'https://example.com/a.css' )  ;\n`
    expect(() => validateBuiltCss(css)).toThrow(/URL @import is not allowed/)
  })

  it("ignores URL @import text that appears inside a block comment", () => {
    const css = `/* historical: @import url("https://fonts.googleapis.com/css"); */\n:root { color: red; }\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })

  it("allows relative @import statements (not URL form)", () => {
    // Non-URL @imports may still appear in intermediate tooling output;
    // this validator only forbids the URL form that breaks downstream
    // CSS chain imports.
    const css = `@import "./tokens.css";\n:root { color: red; }\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })
})
