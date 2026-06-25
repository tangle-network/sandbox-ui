/**
 * Display formatters for the workflow graph's live run-state chips. Pure and
 * dependency-free so they can be unit-tested without rendering the graph.
 */

/** Human-readable duration: `850ms`, `4.2s`, `1m30s`. Undefined for an absent or
 *  non-finite input so the caller renders no chip. */
export function fmtDuration(ms: number | undefined): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  // Round to whole seconds BEFORE splitting into minutes + seconds so a value
  // like 119_999ms can't render `1m60s` — the carry rolls into the minute.
  const totalSeconds = Math.round(s);
  return `${Math.floor(totalSeconds / 60)}m${totalSeconds % 60}s`;
}

/** Human-readable USD cost: `$0`, `$0.0032` (sub-cent, 4dp), `$1.20`. Undefined
 *  for an absent or non-finite input so the caller renders no chip. */
export function fmtCost(usd: number | undefined): string | undefined {
  if (usd === undefined || !Number.isFinite(usd)) return undefined;
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}
