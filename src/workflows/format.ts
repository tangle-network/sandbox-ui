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
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

/** Human-readable USD cost: `$0`, `$0.0032` (sub-cent, 4dp), `$1.20`. Undefined
 *  for an absent or non-finite input so the caller renders no chip. */
export function fmtCost(usd: number | undefined): string | undefined {
  if (usd === undefined || !Number.isFinite(usd)) return undefined;
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}
