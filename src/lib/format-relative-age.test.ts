import { describe, expect, it } from "vitest";
import { formatRelativeAge } from "./format-relative-age";

const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeAge", () => {
  it("rolls through every unit without a suffix", () => {
    expect(formatRelativeAge(NOW - 20_000, NOW)).toBe("now");
    expect(formatRelativeAge(NOW - 5 * MINUTE, NOW)).toBe("5m");
    expect(formatRelativeAge(NOW - 3 * HOUR, NOW)).toBe("3h");
    expect(formatRelativeAge(NOW - 2 * DAY, NOW)).toBe("2d");
    expect(formatRelativeAge(NOW - 3 * 7 * DAY, NOW)).toBe("3w");
    expect(formatRelativeAge(NOW - 4 * 30 * DAY, NOW)).toBe("4mo");
    expect(formatRelativeAge(NOW - 400 * DAY, NOW)).toBe("1y");
  });

  it("accepts Date objects and ISO strings", () => {
    expect(formatRelativeAge(new Date(NOW - 90 * MINUTE), NOW)).toBe("1h");
    expect(formatRelativeAge(new Date(NOW - 90 * MINUTE).toISOString(), NOW)).toBe("1h");
  });

  it("never prints a negative age for a future timestamp", () => {
    expect(formatRelativeAge(NOW + 5 * MINUTE, NOW)).toBe("now");
  });

  it("returns an empty string for an unparseable date", () => {
    expect(formatRelativeAge("not a date", NOW)).toBe("");
  });
});
