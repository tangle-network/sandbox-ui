import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  REQUIRED_TEXT_RAMP,
  assertBuiltAgainstPeerFloor,
  assertTextRamp,
  collectForwardedTokenUtilities,
  escapeUtility,
  peerFloor,
  validateBuiltCss,
} from "./validate-built-css.mjs"

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..")

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

  it("allows bare-specifier @import statements (not URL form)", () => {
    // Non-URL @imports may still appear in intermediate tooling output;
    // this validator only forbids the URL form that breaks downstream
    // CSS chain imports.
    const css = `@import "@tangle-network/brand/styles/tokens.css";\n:root { color: red; }\n`
    expect(() => validateBuiltCss(css)).not.toThrow()
  })

  it("passes when every required token utility emits a rule", () => {
    const required = new Map([
      ["h-[var(--avatar-size)]", "a.tsx"],
      ["bg-[var(--brand-glow)]", "b.tsx"],
      ["text-[var(--text-dim)]", "c.tsx"],
    ])
    const css = [
      ".h-\\[var\\(--avatar-size\\)\\]{}",
      ".bg-\\[var\\(--brand-glow\\)\\]{}",
      ".text-\\[var\\(--text-dim\\)\\]{}",
    ].join("\n")
    expect(() => validateBuiltCss(css, { requiredUtilities: required })).not.toThrow()
  })

  it("matches a utility that only ever appears behind a variant", () => {
    // `hover:bg-[var(--x)]` emits `.hover\:bg-\[var\(--x\)\]:hover` and no bare
    // rule. Anchoring the marker on the leading dot would report it missing.
    const required = new Map([["bg-[var(--border-hover)]", "a.tsx"]])
    const css = ".hover\\:bg-\\[var\\(--border-hover\\)\\]:hover{}"
    expect(() => validateBuiltCss(css, { requiredUtilities: required })).not.toThrow()
  })

  it("throws, naming the utility and its file, when a rule is missing", () => {
    const required = new Map([
      ["text-[var(--text-dim)]", "src/primitives/input.tsx"],
    ])
    expect(() => validateBuiltCss("", { requiredUtilities: required })).toThrow(
      /text-\[var\(--text-dim\)\][\s\S]*input\.tsx/,
    )
  })

  it("throws rather than passing when the requirement could not be collected", () => {
    // An unreadable peer yields null. Treating that as "nothing required" is
    // how a check reports green while measuring nothing.
    expect(() => validateBuiltCss("", { requiredUtilities: null })).toThrow(
      /could not run/,
    )
  })
})

describe("collectForwardedTokenUtilities", () => {
  it("returns null when the source tree cannot be read", () => {
    expect(collectForwardedTokenUtilities("/nonexistent/ui/src")).toBeNull()
  })

  it("collects token utilities from the real forwarded UI source", () => {
    const utilities = collectForwardedTokenUtilities(
      join(rootDir, "node_modules", "@tangle-network", "ui", "src"),
    )
    expect(utilities).not.toBeNull()
    expect(utilities.size).toBeGreaterThan(0)
    for (const utility of utilities.keys()) {
      expect(utility).toMatch(/^[a-z-]+-\[(?:(?:color|length):)?var\(--[\w-]+(?:,[^\]\s]+)?\)\]$/)
    }
  })

  it("ignores classes that only appear in test and story files", () => {
    // `faint-text.test.tsx` names `text-[var(--x)]` as a fixture string. A
    // fixture is not a rendered class, and requiring it would gate the bundle
    // on a token that does not exist.
    const utilities = collectForwardedTokenUtilities(
      join(rootDir, "node_modules", "@tangle-network", "ui", "src"),
    )
    expect([...utilities.keys()]).not.toContain("text-[var(--x)]")
  })
})

describe("assertTextRamp", () => {
  it("passes when every tier emits a rule", () => {
    const css = REQUIRED_TEXT_RAMP.map(
      (u) => `.${u.replace(/[^\w-]/g, (c) => `\\${c}`)}{}`,
    ).join("\n")
    expect(() => assertTextRamp(css)).not.toThrow()
  })

  it("throws when the inline safelist has been removed", () => {
    // The exact regression: `@tangle-network/ui` uses a text-ramp utility the
    // installed version does not contain, so the scan never sees it, so the
    // bundle omits the rule and the tier renders at inherited body colour.
    expect(() => assertTextRamp("")).toThrow(/text ramp is missing/)
  })

  it("names precisely the tier that went missing", () => {
    const css = REQUIRED_TEXT_RAMP.filter((u) => !u.includes("--text-dim"))
      .map((u) => `.${u.replace(/[^\w-]/g, (c) => `\\${c}`)}{}`)
      .join("\n")
    expect(() => assertTextRamp(css)).toThrow(/text-\[var\(--text-dim\)\]/)
  })
})

describe("assertBuiltAgainstPeerFloor", () => {
  it("accepts a build against exactly the declared floor", () => {
    expect(() => assertBuiltAgainstPeerFloor("11.2.4", "^11.2.4")).not.toThrow()
  })

  it("accepts a build against something newer than the floor", () => {
    // Retain the legacy minimum-version mode. The actual CSS build uses
    // exact mode below; a newer source tree is not proof of an older floor.
    expect(() => assertBuiltAgainstPeerFloor("11.3.0", "^11.2.4")).not.toThrow()
  })

  it("throws on the exact skew that shipped the missing rule", () => {
    // sandbox-ui resolved ui 11.2.0 while `^11.0.0` let consumers install
    // 11.2.4, so the precompiled bundle under-covered what they rendered.
    expect(() => assertBuiltAgainstPeerFloor("11.2.0", "^11.2.4")).toThrow(
      /built against @tangle-network\/ui 11\.2\.0/,
    )
  })

  it("throws across a major, in either direction", () => {
    expect(() => assertBuiltAgainstPeerFloor("10.9.9", "^11.2.4")).toThrow()
    expect(() => assertBuiltAgainstPeerFloor("12.0.0", "^11.2.4")).toThrow()
  })
})


describe("canonical presentation CSS coverage", () => {
  it("collects Heading lengths and nested fallbacks, excluding tests and stories", () => {
    const directory = mkdtempSync(join(tmpdir(), "presentation-utilities-"))
    const classes = [
      "text-[length:var(--font-size-3xl,1.875rem)]",
      "leading-[var(--line-height-heading,1.15)]",
      "tracking-[var(--tracking-tight,-0.02em)]",
      "text-[var(--brand-cool,hsl(var(--primary)))]",
    ]
    try {
      writeFileSync(join(directory, "heading.tsx"), `export const classes = "${classes.join(" ")}"`)
      writeFileSync(join(directory, "heading.test.tsx"), '"text-[var(--test-only)]"')
      writeFileSync(join(directory, "heading.stories.tsx"), '"text-[var(--story-only)]"')
      const required = collectForwardedTokenUtilities(directory)
      expect([...required.keys()]).toEqual(classes)
      const css = classes.map((name) => `.${escapeUtility(name)}{color:inherit}`).join("\n")
      expect(() => validateBuiltCss(css, { requiredUtilities: required })).not.toThrow()
      expect(() => validateBuiltCss(css.replace(escapeUtility(classes[0]), "removed"), {
        requiredUtilities: required,
      })).toThrow(/font-size-3xl/)
      expect(() => validateBuiltCss(`/* ${css} */`, { requiredUtilities: required })).toThrow()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it("does not count commented text-ramp rules as compiled utilities", () => {
    const rules = REQUIRED_TEXT_RAMP.map((name) => `.${escapeUtility(name)}{}`).join("\n")
    expect(() => assertTextRamp(`/* ${rules} */`)).toThrow(/text ramp is missing/)
  })

  it("requires the exact declared floor when requested by build and consumer", () => {
    expect(() => assertBuiltAgainstPeerFloor("11.13.0", "^11.13.0", { exact: true })).not.toThrow()
    expect(() => assertBuiltAgainstPeerFloor("11.14.0", "^11.13.0", { exact: true })).toThrow(/exactly 11.13.0/)
    expect(() => assertBuiltAgainstPeerFloor("1.9.0", "^1.10.0", {
      exact: true, packageName: "@tangle-network/brand",
    })).toThrow(/brand 1.9.0/)
  })

  it("rejects unknown range grammar and malformed installed versions", () => {
    for (const value of ["", "*", "latest", "^11", "^11.13.0 || ^12.0.0"]) {
      expect(() => peerFloor(value)).toThrow(/Unsupported peer floor/)
    }
    expect(() => assertBuiltAgainstPeerFloor("11.13", "^11.13.0")).toThrow(/Invalid resolved version/)
  })
})
