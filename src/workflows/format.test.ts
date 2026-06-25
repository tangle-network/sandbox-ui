import { describe, expect, it } from "vitest";
import { fmtCost, fmtDuration } from "./format";

describe("fmtDuration", () => {
  it("returns undefined for absent or non-finite input", () => {
    expect(fmtDuration(undefined)).toBeUndefined();
    expect(fmtDuration(Number.NaN)).toBeUndefined();
    expect(fmtDuration(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it("renders sub-second durations in rounded ms", () => {
    expect(fmtDuration(0)).toBe("0ms");
    expect(fmtDuration(4.6)).toBe("5ms");
    expect(fmtDuration(850)).toBe("850ms");
    expect(fmtDuration(999)).toBe("999ms");
  });

  it("renders seconds with one decimal up to a minute", () => {
    expect(fmtDuration(1000)).toBe("1.0s");
    expect(fmtDuration(4200)).toBe("4.2s");
    expect(fmtDuration(59_900)).toBe("59.9s");
  });

  it("renders minutes and seconds past a minute", () => {
    expect(fmtDuration(60_000)).toBe("1m0s");
    expect(fmtDuration(90_000)).toBe("1m30s");
    expect(fmtDuration(605_000)).toBe("10m5s");
  });

  it("carries a rounded second into the minute instead of rendering 60s", () => {
    // Just below two minutes: seconds round to 60 and must roll over.
    expect(fmtDuration(119_999)).toBe("2m0s");
    expect(fmtDuration(119_600)).toBe("2m0s");
  });
});

describe("fmtCost", () => {
  it("returns undefined for absent or non-finite input", () => {
    expect(fmtCost(undefined)).toBeUndefined();
    expect(fmtCost(Number.NaN)).toBeUndefined();
    expect(fmtCost(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it("renders exact zero as $0", () => {
    expect(fmtCost(0)).toBe("$0");
  });

  it("renders sub-cent amounts with four decimals", () => {
    expect(fmtCost(0.0032)).toBe("$0.0032");
    expect(fmtCost(0.009999)).toBe("$0.0100");
    expect(fmtCost(0.00001)).toBe("$0.0000");
  });

  it("renders cent-and-above amounts with two decimals", () => {
    expect(fmtCost(0.01)).toBe("$0.01");
    expect(fmtCost(1.2)).toBe("$1.20");
    expect(fmtCost(1234.5)).toBe("$1234.50");
  });
});
