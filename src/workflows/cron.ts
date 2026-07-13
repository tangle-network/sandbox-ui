/**
 * Cron → English for a schedule trigger's node label. A raw `0 9 * * 1-5` tells
 * a reader nothing at a glance; "Weekdays at 09:00" tells them everything.
 *
 * Deliberately partial: it recognizes the timetables people actually author and
 * returns the EXPRESSION VERBATIM for anything else (step ranges, multi-field
 * lists, `@yearly` macros, 6-field second-precision cron). A wrong-but-confident
 * translation of an exotic expression is worse than the expression itself, so
 * there is no best-effort guessing — the node just shows what was written.
 */

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * A step field (star-slash-N), but ONLY when N actually produces an even
 * cadence. Cron steps WITHIN a field's own range and then restarts at the top of
 * the next unit — so a minute step means "every N minutes" only when N divides
 * 60, and an hour step means "every N hours" only when N divides 24. A 90-minute
 * step (a classic authoring mistake) does NOT fire every 90 minutes: it matches
 * minute 0 alone, i.e. hourly. Translating it as "Every 90 minutes" would tell an
 * author their broken cron is exactly what they meant — the one thing this module
 * must never do.
 */
function evenStep(field: string, period: number): number | null {
  const m = /^\*\/(\d+)$/.exec(field);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  if (n < 1 || n >= period || period % n !== 0) return null;
  return n;
}

/** A single, plain integer field value (no list/range/step). */
function plainInt(field: string): number | null {
  if (!/^\d+$/.test(field)) return null;
  return Number.parseInt(field, 10);
}

/** `9` → "09:00". Returns null when either half isn't a plain in-range value. */
function timeOfDay(minute: string, hour: string): string | null {
  const m = plainInt(minute);
  const h = plainInt(hour);
  if (m === null || h === null || m > 59 || h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** English for a day-of-week field: `1-5` → "Weekdays", `1` → "Mondays",
 *  `1,3,5` → "Mon, Wed, Fri". Null for anything else (a step, an out-of-range
 *  day), so the caller falls back to the raw expression. Cron allows both `0`
 *  and `7` for Sunday. */
function weekdays(field: string): string | null {
  if (field === "1-5") return "Weekdays";
  if (field === "0,6" || field === "6,0" || field === "6-7") return "Weekends";
  const dayName = (value: number): string | null => {
    if (value < 0 || value > 7) return null;
    return WEEKDAY_NAMES[value === 7 ? 0 : value];
  };
  const single = plainInt(field);
  if (single !== null) {
    const name = dayName(single);
    return name ? `${name}s` : null;
  }
  if (/^\d+(,\d+)+$/.test(field)) {
    const names = field.split(",").map((d) => dayName(Number.parseInt(d, 10)));
    if (names.some((n) => n === null)) return null;
    // `0,7` is Sunday twice — dedupe, or the label reads "Sun, Sun".
    const unique = [...new Set(names as string[])];
    return unique.map((n) => n.slice(0, 3)).join(", ");
  }
  return null;
}

/** Ordinal for a day of the month: 1 → "1st", 22 → "22nd". */
function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/**
 * English for a standard 5-field cron expression (`minute hour day-of-month
 * month day-of-week`), or the expression VERBATIM (trimmed) when it isn't one of
 * the recognized shapes — including when it is empty. Never throws, so it is
 * always safe to render whatever the definition happens to carry.
 */
export function describeCron(expression: string): string {
  const raw = expression.trim();
  const fields = raw.split(/\s+/);
  if (fields.length !== 5) return raw;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

  // Only day-of-month OR day-of-week may constrain the day; a cron that sets
  // both means "either day matches", which no short phrase captures honestly.
  const anyDayOfMonth = dayOfMonth === "*";
  const anyDayOfWeek = dayOfWeek === "*";
  const anyMonth = month === "*";
  if (!anyMonth) return raw;
  if (!anyDayOfMonth && !anyDayOfWeek) return raw;

  const everyDay = anyDayOfMonth && anyDayOfWeek;

  if (everyDay) {
    if (minute === "*" && hour === "*") return "Every minute";
    const everyNMinutes = evenStep(minute, 60);
    if (everyNMinutes !== null && hour === "*") {
      return everyNMinutes === 1
        ? "Every minute"
        : `Every ${everyNMinutes} minutes`;
    }
    const everyNHours = evenStep(hour, 24);
    const atMinute = plainInt(minute);
    const pastTheHour =
      atMinute !== null && atMinute <= 59
        ? `:${String(atMinute).padStart(2, "0")}`
        : null;
    if (everyNHours !== null && pastTheHour) {
      return everyNHours === 1
        ? `Hourly at ${pastTheHour}`
        : `Every ${everyNHours} hours at ${pastTheHour}`;
    }
    if (hour === "*" && pastTheHour) return `Hourly at ${pastTheHour}`;
    const time = timeOfDay(minute, hour);
    return time ? `Daily at ${time}` : raw;
  }

  const time = timeOfDay(minute, hour);
  if (!time) return raw;

  if (!anyDayOfWeek) {
    const days = weekdays(dayOfWeek);
    return days ? `${days} at ${time}` : raw;
  }

  const day = plainInt(dayOfMonth);
  if (day !== null && day >= 1 && day <= 31) {
    return `Monthly on the ${ordinal(day)} at ${time}`;
  }
  return raw;
}
