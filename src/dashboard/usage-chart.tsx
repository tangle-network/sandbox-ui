import * as React from "react";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@tangle-network/ui/primitives";

export interface UsageDataPoint {
  date: string;
  value: number;
}

export interface UsageChartProps {
  data: UsageDataPoint[];
  title: string;
  unit: string;
  className?: string;
}

const colors = {
  bar: "bg-primary",
  text: "text-[var(--accent-text)]",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function UsageChart({ data, title, unit, className }: UsageChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const isEmpty = data.length === 0 || total === 0;
  const labelEvery = data.length <= 7 ? 1 : Math.ceil(data.length / 7);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="min-w-0 truncate font-medium text-base">
          {title}
        </CardTitle>
        <div className="shrink-0 whitespace-nowrap text-right">
          <span className={cn("font-medium text-2xl tabular-nums", colors.text)}>
            {formatValue(total)}
          </span>
          <span className="ml-1 text-muted-foreground text-sm">{unit}</span>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
            <p className="font-medium text-sm">No {unit} recorded yet</p>
            <p className="text-muted-foreground text-xs">
              Usage appears here once activity begins.
            </p>
          </div>
        ) : (
          <>
            {/* Chart Container */}
            <div className="relative">
          {/* Y-axis labels */}
          <div className="absolute top-0 left-0 flex h-48 flex-col justify-between text-muted-foreground text-xs tabular-nums">
            <span>{formatValue(maxValue)}</span>
            <span>{formatValue(Math.round(maxValue / 2))}</span>
            <span>0</span>
          </div>

          {/* Chart Area */}
          <div className="ml-10 flex h-48 items-end gap-1">
            {data.map((point, index) => {
              const heightPercent = (point.value / maxValue) * 100;
              const isHovered = hoveredIndex === index;

              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: chart bar uses hover for tooltip display
                <div
                  key={point.date}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-12 z-10 rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container-highest px-3 py-1.5 text-sm shadow-[var(--shadow-dropdown),var(--edge-highlight)]">
                      <p className="font-medium tabular-nums">
                        {formatValue(point.value)} {unit}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(point.date)}
                      </p>
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className={cn(
                      "min-h-[2px] w-full rounded-t-sm transition-opacity",
                      colors.bar,
                      isHovered && "opacity-80",
                    )}
                    style={{ height: `${Math.max(heightPercent, 1)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels: every nth label, each given the n columns it
              stands for, so a date never truncates to its first letters. */}
          <div
            className="mt-2 ml-10 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
          >
            {data.map((point, index) =>
              index % labelEvery === 0 ? (
                <div
                  key={point.date}
                  style={{ gridColumn: `${index + 1} / span ${Math.min(labelEvery, data.length - index)}` }}
                  className={cn("truncate text-muted-foreground text-xs", hoveredIndex === index && colors.text)}
                >
                  {formatDate(point.date)}
                </div>
              ) : null,
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-[var(--md3-outline-variant)] border-t pt-4">
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Average</p>
            <p className="font-medium tabular-nums">
              {formatValue(Math.round(total / data.length))} {unit}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Peak</p>
            <p className="font-medium tabular-nums">
              {formatValue(maxValue)} {unit}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="font-medium tabular-nums">
              {formatValue(total)} {unit}
            </p>
          </div>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
