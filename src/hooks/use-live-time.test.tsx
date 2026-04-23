import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveTime } from "./use-live-time";

describe("useLiveTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances Date.now() snapshot on the given cadence", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const { result } = renderHook(() => useLiveTime(1000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeGreaterThan(initial);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBeGreaterThanOrEqual(initial + 3000);
  });

  it("falls back to a safe cadence when intervalMs is NaN", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    renderHook(() => useLiveTime(Number.NaN));
    // Must not pass NaN (browsers coerce to 0 and spin a render loop)
    // nor drop below the 100ms floor.
    const [, delay] = setIntervalSpy.mock.calls[0]!;
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBeGreaterThanOrEqual(100);
  });
});
