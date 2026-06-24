import { createTwoFilesPatch, diffLines } from "diff"

export interface DiffStats {
  added: number
  removed: number
}

/**
 * Count added / removed lines between two file revisions.
 *
 * Ported from blueprint-agent's `computeDiffStats`: normalize CRLF, short-
 * circuit on equality, then `diffLines` with `ignoreWhitespace` so pure
 * reindentation does not inflate the counts. `newlineIsToken:false` keeps a
 * line (not its trailing newline) as the unit, matching the +/- a reader
 * counts by eye.
 */
export function computeDiffStats(original: string, current: string): DiffStats {
  if (original === current) return { added: 0, removed: 0 }
  const a = original.replace(/\r\n/g, "\n")
  const b = current.replace(/\r\n/g, "\n")
  if (a === b) return { added: 0, removed: 0 }

  const changes = diffLines(a, b, { newlineIsToken: false, ignoreWhitespace: true })
  let added = 0
  let removed = 0
  for (const part of changes) {
    if (!part.added && !part.removed) continue
    const count = part.count ?? part.value.split("\n").length
    if (part.added) added += count
    else if (part.removed) removed += count
  }
  return { added, removed }
}

/**
 * Build a single-file unified patch (baseline → current) for `@pierre/diffs`'
 * `PatchDiff`. `context: Infinity` would print the whole file; the default
 * 4-line context keeps hunks compact while preserving locality. Equal inputs
 * yield an empty string so callers can treat "" as "no diff".
 */
export function buildUnifiedPatch(filename: string, baseline: string, current: string): string {
  if (baseline === current) return ""
  return createTwoFilesPatch(filename, filename, baseline, current, "", "")
}
