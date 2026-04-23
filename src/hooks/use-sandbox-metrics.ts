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
  /**
   * True only until the first successful sample has arrived (or the
   * first one after the target `sandboxId` changes). Subsequent polls
   * do not flip this back to true, so consumers can gate a spinner
   * on it without it flashing on every cycle.
   */
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
  // Tracks whether this hook has produced a successful sample for the
  // current `sandboxId`. Gates `loading` so it only reflects the
  // pre-first-sample state rather than flipping on every poll cycle.
  const hasLoadedRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (!enabled || !sandboxId || !apiBaseUrl) {
      return;
    }

    // Reset the sample baseline when the target sandbox changes so a
    // stale delta from the previous sandbox can't leak a bogus CPU%.
    // The "have we loaded yet" flag resets too, so the consumer sees
    // a fresh loading state for the new sandbox.
    if (sampleRef.current && sampleRef.current.sandboxId !== sandboxId) {
      sampleRef.current = null;
      hasLoadedRef.current = false;
      setMetrics(null);
      setLastUpdatedAt(null);
    }

    const controller = new AbortController();
    let cancelled = false;
    const delay = Math.max(intervalMs, 500);

    const fetchOnce = async () => {
      // Only surface `loading` before the first successful sample.
      // After that, polls must not flash a spinner in consumer UIs.
      if (!hasLoadedRef.current) setLoading(true);
      try {
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

        if (cancelled) return;

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
        // Only advance the baseline when we're about to commit state,
        // so a torn-down or superseded fetch can't poison the next
        // delta with a sample the consumer never saw.
        sampleRef.current = { cpuSeconds, wallMs, sandboxId };

        setMetrics({
          cpuPercent,
          rssBytes: data?.process?.memoryBytes?.rss ?? 0,
          heapUsedBytes: data?.process?.memoryBytes?.heapUsed ?? 0,
          heapTotalBytes: data?.process?.memoryBytes?.heapTotal ?? 0,
        });
        setLastUpdatedAt(wallMs);
        setError(null);
        hasLoadedRef.current = true;
        setLoading(false);
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
        // Surface a terminal loading=false so consumers can render the
        // error instead of remaining stuck on a skeleton forever.
        if (!hasLoadedRef.current) setLoading(false);
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
