import { describe, it, expect } from "vitest";
import { formatBytes, formatUptime } from "./format";

describe("formatUptime", () => {
  it("renders seconds for short durations", () => {
    expect(formatUptime(0)).toBe("0s");
    expect(formatUptime(7_500)).toBe("7s");
  });

  it("renders minutes and seconds under an hour", () => {
    expect(formatUptime(90_000)).toBe("1m 30s");
    expect(formatUptime(59 * 60_000 + 12_000)).toBe("59m 12s");
  });

  it("renders hours and minutes under a day", () => {
    expect(formatUptime(3_600_000)).toBe("1h 0m");
    expect(formatUptime(5 * 3_600_000 + 30 * 60_000)).toBe("5h 30m");
  });

  it("renders days and hours for multi-day durations", () => {
    expect(formatUptime(86_400_000)).toBe("1d 0h");
    expect(formatUptime(86_400_000 * 3 + 3_600_000 * 4)).toBe("3d 4h");
  });

  it("handles invalid input", () => {
    expect(formatUptime(Number.NaN)).toBe("—");
    expect(formatUptime(-1)).toBe("—");
  });
});

describe("formatBytes", () => {
  it("renders bytes, KB, MB, GB progressively", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2_048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
  });
});
