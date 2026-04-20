import { describe, it, expect } from "vitest"
import { validateBuiltCss } from "./validate-built-css.mjs"

const googleFontsImport = `@import url("https://fonts.googleapis.com/css2?family=Geist");`

describe("validateBuiltCss", () => {
  it("passes when the Google Fonts @import is the first statement", () => {
    expect(() => validateBuiltCss(`${googleFontsImport}\n@import "tailwindcss";`)).not.toThrow()
  })

  it("passes when a leading block comment precedes the @import", () => {
    const css = `/*! tailwindcss v4.2.2 | MIT License | https://tailwindcss.com */\n${googleFontsImport}\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })

  it("passes when a block comment contains the text '@import' at column 0", () => {
    // The false-positive that /^@import/m would otherwise hit.
    const css = `/*\n@import url("example.com/foo");\n*/\n${googleFontsImport}\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })

  it("passes when @charset precedes the @import", () => {
    const css = `@charset "UTF-8";\n${googleFontsImport}\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })

  it("passes when an empty @layer declaration precedes the @import", () => {
    const css = `@layer reset, base, components;\n${googleFontsImport}\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })

  it("passes when both @charset and @layer precede the @import", () => {
    const css = `@charset "UTF-8";\n@layer reset, base;\n${googleFontsImport}\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })

  it("throws when the first @import is not the Google Fonts URL", () => {
    const css = `@import "./tokens.css";\n${googleFontsImport}\n`
    expect(() => validateBuiltCss(css)).toThrow(/fonts\.googleapis\.com/)
  })

  it("throws when no @import exists at all", () => {
    expect(() => validateBuiltCss(`:root { color: red; }\n`)).toThrow(/fonts\.googleapis\.com/)
  })

  it("throws when a real CSS rule precedes the first @import", () => {
    const css = `:root { color: red; }\n${googleFontsImport}\n`
    expect(() => validateBuiltCss(css)).toThrow(/found CSS statements before the first @import/)
  })

  it("throws when a non-empty @layer block precedes the @import", () => {
    const css = `@layer base { body { margin: 0; } }\n${googleFontsImport}\n`
    expect(() => validateBuiltCss(css)).toThrow(/found CSS statements before the first @import/)
  })

  it("honours the requiredFirstImportUrl override", () => {
    const css = `@import url("https://fonts.bunny.net/css?family=Geist");\n`
    expect(() => validateBuiltCss(css, { requiredFirstImportUrl: "fonts.bunny.net" })).not.toThrow()
    expect(() => validateBuiltCss(css)).toThrow(/fonts\.googleapis\.com/)
  })
})
