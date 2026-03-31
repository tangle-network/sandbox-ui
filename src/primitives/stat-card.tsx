import * as React from "react";
import { cn } from "../lib/utils";
import { Card } from "./card";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "sandbox";
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      className,
      variant = "default",
      title,
      value,
      subtitle,
      icon,
      trend,
      ...props
    },
    ref,
  ) => {
    const iconColors = {
      default: "text-muted-foreground",
      sandbox: "text-[var(--accent-text)]",
    };

    const trendColors = {
      positive: "text-[var(--surface-success-text)]",
      negative: "text-[var(--surface-danger-text)]",
      neutral: "text-muted-foreground",
    };

    const trendStatus = trend
      ? trend.value > 0
        ? "positive"
        : trend.value < 0
          ? "negative"
          : "neutral"
      : null;

    return (
      <Card
        ref={ref}
        variant={variant}
        className={cn("p-6", className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">{title}</p>
            <p className="font-bold text-3xl tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-muted-foreground/70 text-xs">{subtitle}</p>
            )}
            {trend && trendStatus && (
              <div
                className={cn(
                  "flex items-center gap-1 text-sm",
                  trendColors[trendStatus],
                )}
              >
                {trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "→"}
                <span>{Math.abs(trend.value)}%</span>
                {trend.label && (
                  <span className="text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                "rounded-lg bg-[var(--depth-3)] p-2",
                variant === "sandbox" && "bg-[var(--accent-surface-soft)]",
                iconColors[variant],
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </Card>
    );
  },
);
StatCard.displayName = "StatCard";

export { StatCard };
