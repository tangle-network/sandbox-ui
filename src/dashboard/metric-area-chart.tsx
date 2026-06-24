"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface MetricChartPoint {
  /** Wall-clock ms. */
  at: number;
  /** Null renders a gap in the series, never a zero. */
  value: number | null;
}

export type MetricChartTone = "primary" | "success" | "warning" | "danger";

const TONE_VARS: Record<MetricChartTone, string> = {
  primary: "var(--brand-primary, hsl(var(--primary)))",
  success: "var(--status-running, #22c55e)",
  warning: "var(--status-creating, #eab308)",
  danger: "var(--status-error, #ef4444)",
};

export interface MetricAreaChartProps {
  points: MetricChartPoint[];
  label: string;
  /** Formats the current value and y-axis bounds (e.g. percent, bytes). */
  formatValue: (value: number) => string;
  /**
   * Fixed y-axis maximum (100 for percents, memory total for bytes).
   * Omitted = auto-scale to the observed maximum with 10% headroom.
   */
  maxValue?: number;
  /** Secondary line under the current value (e.g. "of 8 GiB"). */
  detail?: React.ReactNode;
  tone?: MetricChartTone;
  /** Plot height in px. Defaults to 96. */
  height?: number;
  /** Shown instead of the plot while no point has a value yet. */
  emptyState?: React.ReactNode;
  className?: string;
}

interface Segment {
  path: string;
  area: string;
}

/**
 * Builds line + area paths, splitting at null values so outages render
 * as gaps. X is the sample's time position within [first, last]; Y is
 * normalized to [0, yMax].
 */
function buildSegments(
  points: MetricChartPoint[],
  width: number,
  height: number,
  yMax: number,
): Segment[] {
  if (points.length === 0 || yMax <= 0) return [];
  const t0 = points[0].at;
  const t1 = points[points.length - 1].at;
  const span = Math.max(1, t1 - t0);
  const x = (at: number) =>
    points.length === 1 ? width / 2 : ((at - t0) / span) * width;
  const y = (v: number) =>
    height - Math.min(1, Math.max(0, v / yMax)) * height;

  const segments: Segment[] = [];
  let run: Array<{ px: number; py: number }> = [];

  const flush = () => {
    if (run.length === 0) return;
    const line = run
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(2)},${p.py.toFixed(2)}`)
      .join(" ");
    const first = run[0];
    const last = run[run.length - 1];
    const area = `${line} L${last.px.toFixed(2)},${height} L${first.px.toFixed(2)},${height} Z`;
    segments.push({ path: line, area });
    run = [];
  };

  for (const point of points) {
    if (point.value === null) {
      flush();
      continue;
    }
    run.push({ px: x(point.at), py: y(point.value) });
  }
  flush();
  return segments;
}

/**
 * Lightweight live time-series panel (Prometheus/Grafana idiom): big
 * current value, area chart of the rolling window, dashed gridlines.
 * Pure SVG — no chart dependency. Null samples render as gaps.
 */
export function MetricAreaChart({
  points,
  label,
  formatValue,
  maxValue,
  detail,
  tone = "primary",
  height = 96,
  emptyState,
  className,
}: MetricAreaChartProps) {
  const gradientId = React.useId();
  const width = 400;
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const latest = values.length > 0 ? values[values.length - 1] : null;
  const observedMax = values.length > 0 ? Math.max(...values) : 0;
  const yMax = maxValue ?? (observedMax > 0 ? observedMax * 1.1 : 1);
  const segments = buildSegments(points, width, height, yMax);
  const color = TONE_VARS[tone];

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container p-4 shadow-sm",
        className,
      )}
      data-testid={`metric-chart-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.12em]">
          {label}
        </p>
        <div className="text-right">
          <span className="font-semibold text-foreground text-xl tabular-nums tracking-tight">
            {latest === null ? "—" : formatValue(latest)}
          </span>
          {detail && (
            <span className="ml-1.5 text-muted-foreground text-xs">
              {detail}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3">
        {values.length === 0 ? (
          <div
            className="flex items-center justify-center text-muted-foreground text-xs"
            style={{ height }}
          >
            {emptyState ?? "Waiting for samples…"}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="block w-full"
            style={{ height }}
            role="img"
            aria-label={`${label} chart`}
          >
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={fraction}
                x1={0}
                x2={width}
                y1={height * fraction}
                y2={height * fraction}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
                strokeDasharray="3 5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {segments.map((segment) => (
              <React.Fragment key={segment.path}>
                <path d={segment.area} fill={`url(#${gradientId})`} />
                <path
                  d={segment.path}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </React.Fragment>
            ))}
          </svg>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{values.length > 0 ? formatValue(0) : ""}</span>
        <span>{values.length > 0 ? formatValue(yMax) : ""}</span>
      </div>
    </div>
  );
}
