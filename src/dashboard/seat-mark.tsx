"use client";

import { cn } from "../lib/utils";
import { BrandLogo, modelBrandFor } from "../lib/model-brand";
import { HarnessLogo } from "./harness-logo";

export interface SeatMarkProps {
  harness: string;
  model: string;
  /** Show only the model mark when the harness has its own column. */
  marks?: "model";
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
export function SeatMark({ harness, model, marks, effort, size = "sm", className }: SeatMarkProps) {
  const showHarness = marks !== "model";
  const identity = modelBrandFor(model);
  const brand = identity && (identity.lab.logoUrl || identity.lab.logo ? identity.lab : identity.host);
  return (
    <span
      title={[showHarness && harness, model, effort].filter(Boolean).join(" · ")}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-[0.375em] font-sans leading-[1.25]",
        showHarness && "px-[0.375em]",
        size === "sm" ? "text-xs" : "text-sm",
        className,
      )}
    >
      {showHarness && <HarnessLogo type={harness} className="h-[1.25em]! w-[1.25em]! shrink-0" />}
      {brand && <BrandLogo brand={brand} size={size === "sm" ? "xs" : "sm"} className="h-[1.25em] w-[1.25em] shrink-0" />}
      <span className="min-w-0 truncate font-medium text-foreground">{model}</span>
      {effort && <span className="min-w-0 truncate text-muted-foreground">{effort}</span>}
    </span>
  );
}
