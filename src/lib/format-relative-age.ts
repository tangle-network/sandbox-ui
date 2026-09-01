const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Compact age for a session rail: `now`, `5m`, `3h`, `2d`, `3w`, `4mo`, `1y`.
 * Unlike `timeAgo` from `@tangle-network/ui/utils` it accepts any date input,
 * rolls past hours into days and beyond, and carries no "ago" suffix, so it
 * fits a "codex · 2h" meta line. A future or unparseable date reads `now` /
 * empty rather than a negative count. `now` is injectable for deterministic tests.
 */
export function formatRelativeAge(
  date: string | number | Date,
  now: number = Date.now(),
): string {
  const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "";

  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < MINUTE) return "now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < MONTH) return `${Math.floor(elapsed / WEEK)}w`;
  if (elapsed < YEAR) return `${Math.floor(elapsed / MONTH)}mo`;
  return `${Math.floor(elapsed / YEAR)}y`;
}
