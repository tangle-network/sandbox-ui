import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSandboxMetrics } from "./use-sandbox-metrics";

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetchResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
  } as unknown as Response;
}

describe("useSandboxMetrics", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays idle when sandboxId is missing", async () => {
    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://localhost",
        sandboxId: null,
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.metrics).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("returns null cpuPercent on first sample and computes % on the second", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockFetchResponse({
          process: {
            memoryBytes: {
              rss: 100_000_000,
              heapTotal: 50_000_000,
              heapUsed: 25_000_000,
            },
            cpuSeconds: { user: 1, system: 0.5 },
          },
        }),
      )
      // Second sample advances cpuSeconds by 10s. Against any realistic
      // sub-2s wall-clock gap between polls, the derived cpuPercent is
      // comfortably above 100.
      .mockResolvedValue(
        mockFetchResponse({
          process: {
            memoryBytes: {
              rss: 100_000_000,
              heapTotal: 50_000_000,
              heapUsed: 25_000_000,
            },
            cpuSeconds: { user: 11, system: 0.5 },
          },
        }),
      );

    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://api.test",
        sandboxId: "sb_abc",
        token: "tok",
        enabled: true,
        intervalMs: 500,
      }),
    );

    await waitFor(() => {
      expect(result.current.metrics).not.toBeNull();
    });

    expect(result.current.metrics?.cpuPercent).toBeNull();
    expect(result.current.metrics?.rssBytes).toBe(100_000_000);
    expect(result.current.metrics?.heapUsedBytes).toBe(25_000_000);
    expect(result.current.loading).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/sidecar-proxy/sb_abc/metrics/json",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      }),
    );

    // Second sample arrives; cpuPercent is now computed from the delta.
    await waitFor(
      () => {
        expect(result.current.metrics?.cpuPercent).not.toBeNull();
      },
      { timeout: 3000 },
    );
    expect(result.current.metrics!.cpuPercent!).toBeGreaterThan(100);
  });

  it("keeps loading=false on subsequent poll cycles once a sample has arrived", async () => {
    const payload = {
      process: {
        memoryBytes: {
          rss: 100_000_000,
          heapTotal: 50_000_000,
          heapUsed: 25_000_000,
        },
        cpuSeconds: { user: 1, system: 0.5 },
      },
    };
    fetchMock.mockResolvedValueOnce(mockFetchResponse(payload));
    // Leave the second poll fetch in flight so we can observe `loading`
    // while a poll is actively running — the regression we guard
    // against is `loading` flipping back to true on every tick.
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));

    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://api.test",
        sandboxId: "sb_abc",
        enabled: true,
        intervalMs: 500,
      }),
    );

    await waitFor(() => {
      expect(result.current.metrics).not.toBeNull();
    });
    expect(result.current.loading).toBe(false);

    // The interval will fire the second fetch on its own; once it has,
    // `loading` must remain false while the fetch is still in flight.
    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
      { timeout: 2000 },
    );
    expect(result.current.loading).toBe(false);
  });

  it("surfaces an error when the fetch responds with non-ok", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({}, false, 503));
    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://api.test",
        sandboxId: "sb_abc",
        enabled: true,
        intervalMs: 60_000,
      }),
    );
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error?.message).toMatch(/HTTP 503/);
  });

  it("resets metrics and re-enters loading when sandboxId changes", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        process: {
          memoryBytes: {
            rss: 100_000_000,
            heapTotal: 50_000_000,
            heapUsed: 25_000_000,
          },
          cpuSeconds: { user: 1, system: 0.5 },
        },
      }),
    );
    // Hold the new sandbox's first fetch so we can observe the
    // post-reset `loading=true, metrics=null` state before it resolves.
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));

    const { result, rerender } = renderHook(
      ({ sandboxId }) =>
        useSandboxMetrics({
          apiBaseUrl: "http://api.test",
          sandboxId,
          enabled: true,
          intervalMs: 60_000,
        }),
      { initialProps: { sandboxId: "sb_a" } },
    );

    await waitFor(() => {
      expect(result.current.metrics).not.toBeNull();
    });
    expect(result.current.metrics?.rssBytes).toBe(100_000_000);
    expect(result.current.loading).toBe(false);

    rerender({ sandboxId: "sb_b" });

    await waitFor(() => {
      expect(result.current.metrics).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.lastUpdatedAt).toBeNull();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://api.test/v1/sidecar-proxy/sb_b/metrics/json",
      expect.any(Object),
    );
  });

  it("clears a stale error when sandboxId changes", async () => {
    fetchMock
      .mockResolvedValueOnce(mockFetchResponse({}, false, 503))
      // Hold the new sandbox's first fetch to pin the reset snapshot.
      .mockReturnValueOnce(new Promise<Response>(() => {}));

    const { result, rerender } = renderHook(
      ({ sandboxId }) =>
        useSandboxMetrics({
          apiBaseUrl: "http://api.test",
          sandboxId,
          enabled: true,
          intervalMs: 60_000,
        }),
      { initialProps: { sandboxId: "sb_a" } },
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    rerender({ sandboxId: "sb_b" });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(true);
    });
  });

  it("clears error state once a subsequent poll succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(mockFetchResponse({}, false, 503))
      .mockResolvedValue(
        mockFetchResponse({
          process: {
            memoryBytes: {
              rss: 100_000_000,
              heapTotal: 50_000_000,
              heapUsed: 25_000_000,
            },
            cpuSeconds: { user: 1, system: 0.5 },
          },
        }),
      );

    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://api.test",
        sandboxId: "sb_abc",
        enabled: true,
        intervalMs: 500,
      }),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    await waitFor(
      () => {
        expect(result.current.error).toBeNull();
        expect(result.current.metrics).not.toBeNull();
      },
      { timeout: 3000 },
    );
    expect(result.current.metrics?.rssBytes).toBe(100_000_000);
  });
});
