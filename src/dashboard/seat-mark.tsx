"use client";

import { cn } from "../lib/utils";
import { BrandLogo, modelBrandFor } from "../lib/model-brand";
import { HarnessLogo } from "./harness-logo";

export interface SeatMarkProps {
  harness: string;
  model: string;
  effort?: string;
  /** sm = 12px text, md = 14px text. Default sm. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Harness logo, model brand mark, model name and effort on one centre line.
 * Icons are 1.25em and the line height is 1.25, so every child is the same box
 * and the row scales with its font size, standalone or inside a pill.
 */
export function SeatMark({ harness, model, effort, size = "sm", className }: SeatMarkProps) {
  const identity = modelBrandFor(model);
  const brand = identity && (identity.lab.logoUrl || identity.lab.logo ? identity.lab : identity.host);
  return (
    <span
      title={[harness, model, effort].filter(Boolean).join(" · ")}
      className={cn(
        "inline-flex min-w-0 items-center gap-[0.375em] px-[0.375em] font-sans leading-[1.25]",
        size === "sm" ? "text-xs" : "text-sm",
        className,
      )}
    >
      <HarnessLogo type={harness} className="h-[1.25em]! w-[1.25em]!" />
      {brand && <BrandLogo brand={brand} size={size === "sm" ? "xs" : "sm"} className="h-[1.25em] w-[1.25em]" />}
      <span className="min-w-0 truncate font-medium text-foreground">{model}</span>
      {effort && <span className="shrink-0 text-muted-foreground">{effort}</span>}
    </span>
  );
}
