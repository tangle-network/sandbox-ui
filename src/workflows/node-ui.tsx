/**
 * Shared presentational atoms for a workflow graph node — the type icon, meta
 * chips, and the status color/label/badge maps. One source of truth so the
 * production node ({@link WorkflowNode}) and the design-exploration variants
 * ({@link node-variants}) render identical iconography and status coloring.
 *
 * Inline `style` colors here use the RAW brand tokens (`hsl(var(--primary))`,
 * literal hex) — NOT the `--color-*` @theme aliases, which are undefined in a
 * consumer that only imports `tokens.css` (e.g. platform-web), where a
 * `var(--color-*)` would silently resolve to nothing. See the edge-color test.
 */

import {
  Bell,
  Box,
  Cable,
  Circle,
  Clock,
  type LucideIcon,
  Repeat,
  Sparkles,
  Split,
  Webhook,
} from "lucide-react";
import type { ReactNode } from "react";
import type { WfNodeStatus, WfNodeTone } from "./model";

// Tone accent color (theme-reactive, resolving against the raw brand vars):
// trigger = primary indigo; structural (parallel/foreach control flow) = warning
// amber; action = muted neutral. Drives a node's icon tint and its static border.
export const TONE_ACCENT: Record<WfNodeTone, string> = {
  trigger: "hsl(var(--primary))",
  structural: "var(--surface-warning-text)",
  action: "hsl(var(--muted-foreground))",
};

// Status colors, shared by the node (dot/progress) and the edges so a node and
// the hop pointing at it read as one. green/red match the node status borders
// (green-500 / red-500). Only EDGE_RUNNING is referenced outside this module
// (the compact node's live bar); the rest feed STATUS_COLOR + edgeColor here.
const EDGE_MUTED = "hsl(var(--muted-foreground))";
const EDGE_DONE = "#22c55e";
const EDGE_FAIL = "#ef4444";
export const EDGE_RUNNING = "hsl(var(--primary))";
export const STATUS_COLOR: Record<WfNodeStatus, string> = {
  queued: EDGE_MUTED,
  running: EDGE_RUNNING,
  succeeded: EDGE_DONE,
  failed: EDGE_FAIL,
};

/** An edge is colored by the status of the node it points AT, so the run's
 *  "front" lights up. Neutral for a not-yet-reached (queued) target or the
 *  static definition view (`undefined`). */
export function edgeColor(status: WfNodeStatus | undefined): string {
  switch (status) {
    case "running":
      return EDGE_RUNNING;
    case "succeeded":
      return EDGE_DONE;
    case "failed":
      return EDGE_FAIL;
    default:
      return EDGE_MUTED;
  }
}

export const STATUS_LABEL: Record<WfNodeStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
};

// Status badge colour. `running` reuses the primary accent (the card also
// pulses); succeeded/failed use the green/red palette already in the design
// system (see TONE + run-history coloring).
export const STATUS_BADGE: Record<WfNodeStatus, string> = {
  queued: "bg-surface-container-high text-muted-foreground",
  running: "bg-primary/15 text-primary",
  succeeded: "bg-green-600/10 text-green-600",
  failed: "bg-red-500/10 text-red-400",
};

/** Border/ring override applied ON TOP of the tone card when a node has live run
 *  state — so the running node reads live and terminal nodes read green/red at a
 *  glance. */
export function statusBorder(status: WfNodeStatus): string {
  switch (status) {
    case "running":
      // The soft glow (inline, per node) + the animated inbound edge carry the
      // "live" signal — no whole-card pulse, which would fade the text too.
      return "border-primary ring-1 ring-primary/40";
    case "succeeded":
      return "border-green-500";
    case "failed":
      return "border-red-500";
    default:
      return "opacity-70";
  }
}

/** Determinate progress fraction for a node's status: queued reads near-empty,
 *  running a partial (the caller pulses it), terminal full. Shared so every
 *  progress treatment (bar, footer, fill) maps status → fill identically. */
export function progressFill(status: WfNodeStatus): string {
  return status === "succeeded" || status === "failed"
    ? "100%"
    : status === "running"
      ? "58%"
      : "6%";
}

// One lucide glyph per action/trigger kind so a node's type reads at a glance.
export const KIND_ICON: Record<string, LucideIcon> = {
  schedule: Clock,
  provider_event: Webhook,
  trigger: Webhook,
  "agent.run": Sparkles,
  "integration.invoke": Cable,
  notify: Bell,
  parallel: Split,
  foreach: Repeat,
  "sandbox.spawn": Box,
};

/** The type icon in a tinted square, colored by tone. */
export function NodeIcon({
  kind,
  accent,
  box,
  glyph,
}: {
  kind?: string;
  accent: string;
  box: number;
  glyph: number;
}) {
  const Icon = (kind && KIND_ICON[kind]) || Circle;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-md"
      style={{
        width: box,
        height: box,
        background: `color-mix(in srgb, ${accent} 16%, transparent)`,
        color: accent,
      }}
    >
      <Icon size={glyph} strokeWidth={2} />
    </span>
  );
}

/** A compact key/value chip for the node's meta row. Truncates (with a title
 *  tooltip) so a long value — e.g. a provider-prefixed model id — can't overflow
 *  the fixed card width or wrap past the reserved meta rows. */
export function MetaChip({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-block max-w-[150px] truncate rounded bg-surface-container-high px-1.5 py-0.5 align-middle text-[10px] text-muted-foreground"
    >
      {children}
    </span>
  );
}
