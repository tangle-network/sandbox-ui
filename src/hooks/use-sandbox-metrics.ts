"use client";

import * as React from "react";

/**
 * Sandbox-level telemetry collected by the sidecar from cgroup v2
 * (Docker) or /proc (Firecracker guest). `cpuPercent` is computed
 * server-side from consecutive samples; sections are null when the
 * source cannot provide them.
 */
export interface SystemMetricsSnapshot {
  cpuPercent: number | null;
  cpuCores: number;
  memory: { usedBytes: number; totalBytes: number } | null;
  disk: { usedBytes: number; totalBytes: number; path: string } | null;
  source: "cgroup-v2" | "proc";
}

export interface LatencyPercentiles {
  p50: number | null;
  p95: number | null;
  sampleCount: number;
}

export interface SandboxLatencyMetrics {
  ttftMs: LatencyPercentiles;
  firstResponseMs: LatencyPercentiles;
  runDurationMs: LatencyPercentiles;
}

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
  system?: SystemMetricsSnapshot | null;
  latency?: SandboxLatencyMetrics;
}

/**
 * One polled time-series point, sourced from the sandbox-level
 * `system` section. Null values mean the sidecar could not provide
 * that reading — charts must render a gap, not a zero.
 */
export interface SandboxMetricsSample {
  /** Wall-clock ms when the sample was committed client-side. */
  at: number;
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
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
  /** Max retained history samples for charting. Defaults to 120. */
  historyLimit?: number;
}

export interface UseSandboxMetricsResult {
  metrics: SandboxMetrics | null;
  /**
   * Sandbox-level (container/VM) telemetry. Null until the sidecar
   * reports a `system` section — older sidecars never will, and
   * consumers must surface that as "unavailable", not zeros.
   */
  system: SystemMetricsSnapshot | null;
  /** Agent latency percentiles (TTFT, first response, run duration). */
  latency: SandboxLatencyMetrics | null;
  /**
   * Rolling window of system samples (oldest first), capped at
   * `historyLimit`. Cleared when the target sandbox changes.
   */
  history: SandboxMetricsSample[];
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
  historyLimit = 120,
}: UseSandboxMetricsOptions): UseSandboxMetricsResult {
  const [metrics, setMetrics] = React.useState<SandboxMetrics | null>(null);
  const [system, setSystem] = React.useState<SystemMetricsSnapshot | null>(null);
  const [latency, setLatency] = React.useState<SandboxLatencyMetrics | null>(null);
  const [history, setHistory] = React.useState<SandboxMetricsSample[]>([]);
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
  // The last `sandboxId` this effect ran against. Tracked independently
  // of `sampleRef` so that switching away from a sandbox that errored
  // without ever producing a sample still resets consumer-visible state.
  const prevSandboxIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Clear consumer-visible state when the *target* is cleared or
    // changed. `enabled=false` is a pause (per JSDoc, "Pause polling")
    // — keep the last-known sample around so consumers don't flash
    // empty panels when pausing. `sandboxId` going falsy is different:
    // the JSDoc promises the hook "stays idle", so we must not leak
    // stale metrics or an error banner from a sandbox that is no
    // longer selected.
    const sandboxCleared = !sandboxId || !apiBaseUrl;
    const sandboxChanged =
      prevSandboxIdRef.current !== null &&
      prevSandboxIdRef.current !== sandboxId;
    if ((sandboxCleared && prevSandboxIdRef.current !== null) || sandboxChanged) {
      sampleRef.current = null;
      hasLoadedRef.current = false;
      setMetrics(null);
      setSystem(null);
      setLatency(null);
      setHistory([]);
      setLastUpdatedAt(null);
      setError(null);
      if (sandboxCleared) setLoading(false);
    }
    prevSandboxIdRef.current = sandboxId ?? null;

    if (!enabled || sandboxCleared) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let timeoutId: number | null = null;
    const delay = Math.max(intervalMs, 500);

    const fetchOnce = async () => {
      // Only surface `loading` before the first successful sample.
      // After that, polls must not flash a spinner in consumer UIs.
      if (!hasLoadedRef.current) setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(
          `${apiBaseUrl}/v1/sidecar-proxy/${encodeURIComponent(sandboxId)}/metrics/json`,
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
        const sys = data?.system ?? null;
        setSystem(sys);
        setLatency(data?.latency ?? null);
        if (sys) {
          const sample: SandboxMetricsSample = {
            at: wallMs,
            cpuPercent: sys.cpuPercent,
            memoryUsedBytes: sys.memory?.usedBytes ?? null,
            memoryTotalBytes: sys.memory?.totalBytes ?? null,
            diskUsedBytes: sys.disk?.usedBytes ?? null,
            diskTotalBytes: sys.disk?.totalBytes ?? null,
          };
          setHistory((prevHistory) => {
            const next = [...prevHistory, sample];
            return next.length > historyLimit
              ? next.slice(next.length - historyLimit)
              : next;
          });
        }
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

    // Serial polling: schedule the next fetch only after the current
    // one has settled. `setInterval` allows overlapping in-flight
    // requests when fetch latency exceeds `delay`, which lets an older
    // response land after a newer one and corrupt the CPU-delta
    // baseline. A chained `setTimeout` makes overlap impossible and
    // applies natural backpressure under a slow server.
    const runLoop = async () => {
      if (cancelled) return;
      await fetchOnce();
      if (cancelled) return;
      timeoutId = window.setTimeout(runLoop, delay);
    };
    runLoop();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [apiBaseUrl, sandboxId, token, enabled, intervalMs, historyLimit]);

  return { metrics, system, latency, history, loading, error, lastUpdatedAt };
}
