"use client";

import * as React from "react";

/**
 * Shape returned by the sidecar `/metrics/json` endpoint. Only the
 * fields read by this hook are modeled; the sidecar may add more.
 */
export interface SidecarMetricsPayload {
  process?: {
    memoryBytes?: {
      rss?: number;
      heapTotal?: number;
      heapUsed?: number;
      external?: number;
      arrayBuffers?: number;
    };
    cpuSeconds?: {
      user?: number;
      system?: number;
    };
  };
}

export interface SandboxMetrics {
  /**
   * CPU% derived from consecutive samples. `null` on the first sample
   * because a delta is required. Can exceed 100 on multi-core hosts.
   */
  cpuPercent: number | null;
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
}

export interface UseSandboxMetricsOptions {
  /** Sandbox API base URL, e.g. `https://api.tangle.tools`. */
  apiBaseUrl: string;
  /** Sandbox id; when falsy the hook stays idle. */
  sandboxId?: string | null;
  /**
   * Optional bearer token. When omitted the fetch still sends
   * credentials so a cookie session can authenticate the proxy.
   */
  token?: string | null;
  /** Pause polling when false. Defaults to true. */
  enabled?: boolean;
  /** Poll cadence; clamped to a 500ms floor. Defaults to 3000. */
  intervalMs?: number;
}

export interface UseSandboxMetricsResult {
  metrics: SandboxMetrics | null;
  loading: boolean;
  error: Error | null;
  /** Wall-clock ms of the last successful sample, or null. */
  lastUpdatedAt: number | null;
}

/**
 * Polls the sandbox's sidecar metrics through the API proxy and
 * derives a CPU% value from consecutive cumulative-CPU samples. Used
 * by the sandbox overview dashboard to drive live CPU/memory panels.
 */
export function useSandboxMetrics({
  apiBaseUrl,
  sandboxId,
  token,
  enabled = true,
  intervalMs = 3000,
}: UseSandboxMetricsOptions): UseSandboxMetricsResult {
  const [metrics, setMetrics] = React.useState<SandboxMetrics | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null);

  const sampleRef = React.useRef<{
    cpuSeconds: number;
    wallMs: number;
    sandboxId: string;
  } | null>(null);

  React.useEffect(() => {
    if (!enabled || !sandboxId || !apiBaseUrl) {
      return;
    }

    // Reset the sample baseline when the target sandbox changes so a
    // stale delta from the previous sandbox can't leak a bogus CPU%.
    if (sampleRef.current && sampleRef.current.sandboxId !== sandboxId) {
      sampleRef.current = null;
      setMetrics(null);
      setLastUpdatedAt(null);
    }

    const controller = new AbortController();
    let cancelled = false;
    const delay = Math.max(intervalMs, 500);

    const fetchOnce = async () => {
      try {
        setLoading(true);
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(
          `${apiBaseUrl}/v1/sidecar-proxy/${sandboxId}/metrics/json`,
          {
            method: "GET",
            credentials: "include",
            headers,
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          throw new Error(`Metrics request failed (HTTP ${res.status})`);
        }
        const data = (await res.json()) as SidecarMetricsPayload;
        const user = data?.process?.cpuSeconds?.user ?? 0;
        const system = data?.process?.cpuSeconds?.system ?? 0;
        const cpuSeconds = user + system;
        const wallMs = Date.now();

        let cpuPercent: number | null = null;
        const prev = sampleRef.current;
        if (prev && prev.sandboxId === sandboxId) {
          const dCpu = cpuSeconds - prev.cpuSeconds;
          const dWallSec = (wallMs - prev.wallMs) / 1000;
          // Cumulative CPU must grow monotonically; a negative delta
          // means the sidecar restarted, so treat it as "no sample
          // available" rather than rendering a noisy 0 or negative.
          if (dWallSec > 0 && dCpu >= 0) {
            cpuPercent = (dCpu / dWallSec) * 100;
          }
        }
        sampleRef.current = { cpuSeconds, wallMs, sandboxId };

        if (cancelled) return;
        setMetrics({
          cpuPercent,
          rssBytes: data?.process?.memoryBytes?.rss ?? 0,
          heapUsedBytes: data?.process?.memoryBytes?.heapUsed ?? 0,
          heapTotalBytes: data?.process?.memoryBytes?.heapTotal ?? 0,
        });
        setLastUpdatedAt(wallMs);
        setError(null);
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOnce();
    const id = window.setInterval(fetchOnce, delay);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, [apiBaseUrl, sandboxId, token, enabled, intervalMs]);

  return { metrics, loading, error, lastUpdatedAt };
}
