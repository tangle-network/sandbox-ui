import * as React from "react";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../primitives/card";

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
  bar: "bg-[image:var(--accent-gradient-strong)]",
  barHover: "hover:brightness-110",
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

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-medium text-base">{title}</CardTitle>
        <div className="text-right">
          <span className={cn("font-bold text-2xl", colors.text)}>
            {formatValue(total)}
          </span>
          <span className="ml-1 text-muted-foreground text-sm">{unit}</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart Container */}
        <div className="relative">
          {/* Y-axis labels */}
          <div className="absolute top-0 left-0 flex h-48 flex-col justify-between text-muted-foreground text-xs">
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
                  className="group relative flex flex-1 flex-col items-center"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-12 z-10 rounded-lg bg-popover px-3 py-1.5 text-sm shadow-lg">
                      <p className="font-medium">
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
                      "min-h-[2px] w-full rounded-t-sm transition-all duration-200",
                      colors.bar,
                      colors.barHover,
                      isHovered && "opacity-80",
                    )}
                    style={{ height: `${Math.max(heightPercent, 1)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div className="mt-2 ml-10 flex gap-1">
            {data.map((point, index) => (
              <div
                key={point.date}
                className={cn(
                  "flex-1 truncate text-center text-muted-foreground text-xs",
                  hoveredIndex === index && colors.text,
                )}
              >
                {/* Show every nth label to avoid crowding */}
                {data.length <= 7 || index % Math.ceil(data.length / 7) === 0
                  ? formatDate(point.date)
                  : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-border border-t pt-4">
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Average</p>
            <p className="font-medium">
              {formatValue(Math.round(total / data.length))} {unit}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Peak</p>
            <p className="font-medium">
              {formatValue(maxValue)} {unit}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Total</p>
            <p className={cn("font-medium", colors.text)}>
              {formatValue(total)} {unit}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
