import { describe, it, expect } from "vitest"
import { parseEnvText } from "./env-importer"

describe("parseEnvText", () => {
  it("parses a simple KEY=value line", () => {
    const { rows, errors } = parseEnvText("API_KEY=abc123")
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      key: "API_KEY",
      rawKey: "API_KEY",
      value: "abc123",
      lineNumber: 1,
    })
  })

  it("strips an optional leading export keyword", () => {
    const { rows, errors } = parseEnvText("export DATABASE_URL=postgres://localhost")
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      key: "DATABASE_URL",
      rawKey: "DATABASE_URL",
      value: "postgres://localhost",
    })
  })

  it("does not treat exportKEY (no space) as an export keyword", () => {
    const { rows, errors } = parseEnvText("exportKEY=value")
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ key: "EXPORTKEY", rawKey: "exportKEY" })
  })

  it("skips blank lines and full-line comments", () => {
    const text = [
      "# top comment",
      "",
      "   ",
      "REAL=value",
      "   # indented comment",
      "OTHER=2",
    ].join("\n")
    const { rows, errors } = parseEnvText(text)
    expect(errors).toEqual([])
    expect(rows.map((r) => r.key)).toEqual(["REAL", "OTHER"])
    expect(rows[0].lineNumber).toBe(4)
    expect(rows[1].lineNumber).toBe(6)
  })

  it("trims whitespace around key and separator", () => {
    const { rows, errors } = parseEnvText("   SPACED_KEY   =   spaced-value   ")
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ key: "SPACED_KEY", value: "spaced-value" })
  })

  it("preserves equals signs inside the value", () => {
    const { rows } = parseEnvText("CONN=host=db user=postgres")
    expect(rows[0].value).toBe("host=db user=postgres")
  })

  it("strips matching full-value double quotes", () => {
    const { rows } = parseEnvText('KEY="hello world"')
    expect(rows[0].value).toBe("hello world")
  })

  it("strips matching full-value single quotes", () => {
    const { rows } = parseEnvText("KEY='hello world'")
    expect(rows[0].value).toBe("hello world")
  })

  it("preserves inner quotes when value is not a single quoted token", () => {
    const { rows } = parseEnvText('KEY="a"b"')
    expect(rows[0].value).toBe('"a"b"')
  })

  it("does not strip a quote from only one end", () => {
    const { rows } = parseEnvText('KEY="value')
    expect(rows[0].value).toBe('"value')
  })

  it("normalizes keys like the single-secret input", () => {
    const { rows } = parseEnvText("my-secret.key=1\nfoo bar=2")
    expect(rows[0].key).toBe("MY_SECRET_KEY")
    expect(rows[0].rawKey).toBe("my-secret.key")
    expect(rows[1].key).toBe("FOO_BAR")
  })

  it("rejects a line with no '=' separator", () => {
    const { rows, errors } = parseEnvText("JUSTAKEY")
    expect(rows).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      lineNumber: 1,
      message: "Missing '=' separator",
      rawLine: "JUSTAKEY",
    })
  })

  it("rejects a line with an empty key", () => {
    const { rows, errors } = parseEnvText("=value")
    expect(rows).toEqual([])
    expect(errors[0]).toMatchObject({
      lineNumber: 1,
      message: "Missing key before '='",
    })
  })

  it("rejects a key that normalizes to only underscores", () => {
    const { rows, errors } = parseEnvText("!!!=value")
    expect(rows).toEqual([])
    expect(errors[0]).toMatchObject({
      lineNumber: 1,
      message: "Key has no valid characters (letters or digits)",
    })
  })

  it("allows an empty value as a row (save-gated, not a parse error)", () => {
    const { rows, errors } = parseEnvText("EMPTY=\nALSO=   \nQUOTED=\"\"")
    expect(errors).toEqual([])
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.value)).toEqual(["", "", ""])
  })

  it("reports multiple errors with correct line numbers and raw lines", () => {
    const text = "GOOD=1\nBADLINE\n=missingkey\nOTHER=2\n!!! =badkey"
    const { rows, errors } = parseEnvText(text)
    expect(rows.map((r) => r.key)).toEqual(["GOOD", "OTHER"])
    expect(errors.map((e) => e.lineNumber)).toEqual([2, 3, 5])
    expect(errors[0].rawLine).toBe("BADLINE")
  })

  it("returns empty rows and errors for empty input", () => {
    expect(parseEnvText("")).toEqual({ rows: [], errors: [] })
  })

  it("returns empty rows and errors for only comments and blanks", () => {
    expect(parseEnvText("# just a comment\n\n   ")).toEqual({ rows: [], errors: [] })
  })

  it("handles CRLF line endings", () => {
    const { rows, errors } = parseEnvText("A=1\r\nB=2\r\n")
    expect(errors).toEqual([])
    expect(rows.map((r) => r.key)).toEqual(["A", "B"])
  })
})
