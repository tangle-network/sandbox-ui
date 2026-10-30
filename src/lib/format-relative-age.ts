const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const UNITS = [
  ["y", 365 * DAY],
  ["mo", 30 * DAY],
  ["w", 7 * DAY],
  ["d", DAY],
  ["h", HOUR],
  ["m", MINUTE],
] as const;

/** Compact age without an ago suffix; invalid dates are empty and future dates read now. */
export function formatRelativeAge(date: string | number | Date, now = Date.now()): string {
  const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "";
  const elapsed = Math.max(0, now - timestamp);
  const unit = UNITS.find(([, duration]) => elapsed >= duration);
  return unit ? `${Math.floor(elapsed / unit[1])}${unit[0]}` : "now";
}
