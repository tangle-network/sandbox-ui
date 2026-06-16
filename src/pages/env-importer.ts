/**
 * Pure parser for bulk-importing secrets from a `.env`-style document.
 *
 * Kept free of any React/DOM dependencies so it is trivially unit-testable
 * and reusable by the Environment Secrets import modal.
 */

export interface EnvImportRow {
  /** Normalized key: uppercased, any char outside [A-Z0-9_] replaced with `_`. */
  key: string
  /** Original key as written (after `export` stripped and trimmed). */
  rawKey: string
  /** Processed value: surrounding whitespace trimmed, matching full-value quotes stripped. */
  value: string
  /** 1-based line number in the source text. */
  lineNumber: number
}

export interface EnvImportError {
  lineNumber: number
  message: string
  rawLine: string
}

export interface EnvImportResult {
  rows: EnvImportRow[]
  errors: EnvImportError[]
}

const NORMALIZE_RE = /[^A-Z0-9_]/g

/** Mirrors the on-keystroke normalization used by the single-secret input. */
function normalizeKey(rawKey: string): string {
  return rawKey.toUpperCase().replace(NORMALIZE_RE, "_")
}

/**
 * Strip a single pair of matching quotes only when the *entire* value is one
 * quoted token — i.e. the opening quote char does not reappear inside. This
 * avoids mangling values such as `"a"b"` that merely happen to start and end
 * with a quote.
 */
function stripMatchingQuotes(value: string): string {
  if (value.length >= 2) {
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
      const inner = value.slice(1, -1)
      if (!inner.includes(quote)) {
        return inner
      }
    }
  }
  return value
}

/**
 * Parse `.env`-style text into editable rows plus line-specific errors.
 *
 * Rules:
 *  - Blank lines and full-line comments (`#...`) are skipped.
 *  - An optional leading `export ` keyword is stripped.
 *  - `KEY=value` splits on the first `=`; everything after it is the value.
 *  - Key and surrounding separator whitespace are trimmed.
 *  - Value surrounding whitespace is trimmed, then matching full-value
 *    single/double quotes are stripped.
 *  - Key is normalized the same way the single-secret input does it.
 *
 * Structural problems (no `=`, missing key, key with no alphanumeric chars)
 * are reported as per-line errors. An empty value is *not* an error here —
 * the import UI blocks saving rows with empty values, mirroring the
 * single-secret validation.
 */
export function parseEnvText(text: string): EnvImportResult {
  const rows: EnvImportRow[] = []
  const errors: EnvImportError[] = []

  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (trimmed === "" || trimmed.startsWith("#")) continue

    // Strip an optional leading `export ` keyword.
    let rest = trimmed
    const exportMatch = /^export\s+/.exec(rest)
    if (exportMatch) rest = rest.slice(exportMatch[0].length)

    const eqIdx = rest.indexOf("=")
    if (eqIdx === -1) {
      errors.push({ lineNumber, message: "Missing '=' separator", rawLine })
      continue
    }

    const rawKey = rest.slice(0, eqIdx).trim()
    const rawValue = rest.slice(eqIdx + 1).trim()

    if (rawKey === "") {
      errors.push({ lineNumber, message: "Missing key before '='", rawLine })
      continue
    }

    const key = normalizeKey(rawKey)
    if (!/[A-Z0-9]/.test(key)) {
      errors.push({
        lineNumber,
        message: "Key has no valid characters (letters or digits)",
        rawLine,
      })
      continue
    }

    rows.push({
      key,
      rawKey,
      value: stripMatchingQuotes(rawValue),
      lineNumber,
    })
  }

  return { rows, errors }
}
