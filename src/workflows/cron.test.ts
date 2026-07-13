import { describe, expect, it } from "vitest";
import { describeCron } from "./cron";

describe("describeCron", () => {
  it("says the timetables people actually author", () => {
    expect(describeCron("0 9 * * 1-5")).toBe("Weekdays at 09:00");
    expect(describeCron("30 6 * * *")).toBe("Daily at 06:30");
    expect(describeCron("0 0 * * *")).toBe("Daily at 00:00");
    expect(describeCron("0 9 * * 1")).toBe("Mondays at 09:00");
    expect(describeCron("0 12 * * 0")).toBe("Sundays at 12:00");
    // Cron allows 7 for Sunday too.
    expect(describeCron("0 12 * * 7")).toBe("Sundays at 12:00");
    expect(describeCron("15 8 * * 1,3,5")).toBe("Mon, Wed, Fri at 08:15");
    expect(describeCron("0 10 * * 0,6")).toBe("Weekends at 10:00");
    expect(describeCron("0 3 1 * *")).toBe("Monthly on the 1st at 03:00");
    expect(describeCron("0 3 22 * *")).toBe("Monthly on the 22nd at 03:00");
    expect(describeCron("0 3 13 * *")).toBe("Monthly on the 13th at 03:00");
  });

  it("says the sub-daily ones", () => {
    expect(describeCron("* * * * *")).toBe("Every minute");
    expect(describeCron("*/5 * * * *")).toBe("Every 5 minutes");
    expect(describeCron("*/1 * * * *")).toBe("Every minute");
    expect(describeCron("0 * * * *")).toBe("Hourly at :00");
    expect(describeCron("15 * * * *")).toBe("Hourly at :15");
    expect(describeCron("0 */4 * * *")).toBe("Every 4 hours at :00");
  });

  it("tolerates surrounding and repeated whitespace", () => {
    expect(describeCron("  0   9  *  *  1-5 ")).toBe("Weekdays at 09:00");
  });

  it("refuses a step that does not divide its field — the wrong translation is the dangerous one", () => {
    // Cron steps WITHIN a field and restarts at the next unit. `*/90` (a classic
    // mistake) fires at :00 only — hourly. Calling it "Every 90 minutes" would
    // confirm an author's broken schedule as correct.
    expect(describeCron("*/90 * * * *")).toBe("*/90 * * * *");
    expect(describeCron("*/7 * * * *")).toBe("*/7 * * * *");
    expect(describeCron("*/25 * * * *")).toBe("*/25 * * * *");
    expect(describeCron("0 */5 * * *")).toBe("0 */5 * * *");
    expect(describeCron("*/0 * * * *")).toBe("*/0 * * * *");
    // …while the steps that DO divide evenly still read as English.
    expect(describeCron("*/15 * * * *")).toBe("Every 15 minutes");
    expect(describeCron("0 */6 * * *")).toBe("Every 6 hours at :00");
  });

  it("does not say Sunday twice (cron allows both 0 and 7)", () => {
    expect(describeCron("0 9 * * 0,7")).toBe("Sun at 09:00");
  });

  it("returns the expression verbatim rather than guessing at an exotic one", () => {
    // A confident-but-wrong translation is worse than the cron itself. Anything
    // outside the recognized shapes is shown as written.
    const exotic = [
      "0 9 * 3 *", // a month constraint
      "0 9 1 * 1", // day-of-month AND day-of-week (an OR, not an AND)
      "0 9-17 * * *", // an hour range
      "0 9 * * 1-3", // a weekday range that isn't Mon-Fri
      "@daily", // a macro
      "0 0 1 1 * 2030", // 6 fields
      "not a cron",
      "",
    ];
    for (const expression of exotic) {
      expect(describeCron(expression)).toBe(expression.trim());
    }
  });

  it("rejects out-of-range field values instead of formatting nonsense", () => {
    expect(describeCron("99 9 * * *")).toBe("99 9 * * *");
    expect(describeCron("0 44 * * *")).toBe("0 44 * * *");
    expect(describeCron("0 9 * * 9")).toBe("0 9 * * 9");
  });
});
