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

  it("resets consumer state when sandboxId transitions to null", async () => {
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

    const { result, rerender } = renderHook(
      ({ sandboxId }) =>
        useSandboxMetrics({
          apiBaseUrl: "http://api.test",
          sandboxId,
          enabled: true,
          intervalMs: 60_000,
        }),
      { initialProps: { sandboxId: "sb_a" as string | null } },
    );

    await waitFor(() => {
      expect(result.current.metrics).not.toBeNull();
    });

    rerender({ sandboxId: null });

    await waitFor(() => {
      expect(result.current.metrics).toBeNull();
      expect(result.current.lastUpdatedAt).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  it("pausing via enabled=false keeps the last-known sample", async () => {
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

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useSandboxMetrics({
          apiBaseUrl: "http://api.test",
          sandboxId: "sb_abc",
          enabled,
          intervalMs: 60_000,
        }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(result.current.metrics).not.toBeNull();
    });
    const snapshot = result.current.metrics;

    rerender({ enabled: false });

    // Paused — no new fetches, and the prior sample is preserved so
    // consumers aren't forced to flash an empty panel.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.metrics).toEqual(snapshot);
  });

  it("URL-encodes the sandboxId", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        process: {
          memoryBytes: {
            rss: 1,
            heapTotal: 1,
            heapUsed: 1,
          },
          cpuSeconds: { user: 0, system: 0 },
        },
      }),
    );

    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://api.test",
        sandboxId: "weird/id with space",
        enabled: true,
        intervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(result.current.metrics).not.toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/sidecar-proxy/weird%2Fid%20with%20space/metrics/json",
      expect.any(Object),
    );
  });
});

describe("useSandboxMetrics — system telemetry + history", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const SYSTEM = {
    cpuPercent: 42.5,
    cpuCores: 4,
    memory: { usedBytes: 2_000_000_000, totalBytes: 8_000_000_000 },
    disk: { usedBytes: 10_000_000_000, totalBytes: 50_000_000_000, path: "/workspace" },
    source: "cgroup-v2" as const,
  };

  it("exposes the system section and appends a history sample", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        process: { cpuSeconds: { user: 1, system: 0 } },
        system: SYSTEM,
        latency: {
          ttftMs: { p50: 120, p95: 480, sampleCount: 9 },
          firstResponseMs: { p50: 300, p95: 900, sampleCount: 9 },
          runDurationMs: { p50: 4000, p95: 12000, sampleCount: 9 },
        },
      }),
    );
    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://localhost",
        sandboxId: "sb-1",
        intervalMs: 100_000,
      }),
    );
    await waitFor(() => {
      expect(result.current.system).not.toBeNull();
    });
    expect(result.current.system?.cpuPercent).toBe(42.5);
    expect(result.current.system?.memory?.totalBytes).toBe(8_000_000_000);
    expect(result.current.latency?.ttftMs.p95).toBe(480);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({
      cpuPercent: 42.5,
      memoryUsedBytes: 2_000_000_000,
      diskTotalBytes: 50_000_000_000,
    });
  });

  it("keeps system null and history empty when the sidecar omits the section (old sidecar)", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({ process: { cpuSeconds: { user: 1, system: 0 } } }),
    );
    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://localhost",
        sandboxId: "sb-1",
        intervalMs: 100_000,
      }),
    );
    await waitFor(() => {
      expect(result.current.metrics).not.toBeNull();
    });
    expect(result.current.system).toBeNull();
    expect(result.current.history).toHaveLength(0);
  });

  it("caps history at historyLimit, dropping oldest samples", async () => {
    let call = 0;
    fetchMock.mockImplementation(async () => {
      call += 1;
      return mockFetchResponse({
        process: { cpuSeconds: { user: call, system: 0 } },
        system: { ...SYSTEM, cpuPercent: call },
      });
    });
    const { result } = renderHook(() =>
      useSandboxMetrics({
        apiBaseUrl: "http://localhost",
        sandboxId: "sb-1",
        intervalMs: 500,
        historyLimit: 3,
      }),
    );
    await waitFor(
      () => {
        expect(result.current.history).toHaveLength(3);
        // Oldest sample must have been evicted: window starts above 1.
        expect(result.current.history[0]?.cpuPercent).toBeGreaterThan(1);
      },
      { timeout: 5000 },
    );
  });

  it("clears history when the sandbox changes", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        process: { cpuSeconds: { user: 1, system: 0 } },
        system: SYSTEM,
      }),
    );
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) =>
        useSandboxMetrics({
          apiBaseUrl: "http://localhost",
          sandboxId: id,
          intervalMs: 100_000,
        }),
      { initialProps: { id: "sb-1" } },
    );
    await waitFor(() => {
      expect(result.current.history).toHaveLength(1);
    });
    rerender({ id: "sb-2" });
    expect(result.current.history).toHaveLength(0);
    expect(result.current.system).toBeNull();
  });
});
