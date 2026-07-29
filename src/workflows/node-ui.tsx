/**
 * Shared presentational atoms for a workflow graph node — the type glyph, the
 * status color/label/badge maps, and the edge coloring. One source of truth so
 * the node card and the edges that point at it read as one system.
 *
 * Colors resolve to the SEMANTIC surface tokens (`--surface-success-text`,
 * `--surface-danger-text`, …), which carry a light AND a dark value tuned for
 * contrast against the card. A literal palette hex (`#22c55e`) or a stock
 * Tailwind shade (`text-red-400`) carries ONE value, so it can only ever hold its
 * contrast in one of the two themes — never use one for a status color.
 *
 * Inline `style` colors here use the RAW brand tokens (`hsl(var(--primary))`,
 * `var(--surface-…)`) — NOT the `--color-*` @theme aliases, which are undefined
 * in a consumer that only imports `tokens.css` (e.g. platform-web), where a
 * `var(--color-*)` would silently resolve to nothing. See the edge-color test.
 */

import {
  Bell,
  Box,
  Cable,
  Camera,
  Circle,
  Clock,
  Code,
  GitBranch,
  type LucideIcon,
  Repeat,
  ScanSearch,
  Sparkles,
  UserCheck,
  Webhook,
  Zap,
} from "lucide-react";
import { ProviderIcon } from "../integrations/provider-logo";
import { ModelBrandStack, modelBrandFor } from "../lib/model-brand";
import type { WfNodeStatus, WfNodeTone } from "./model";
import { providerLabel } from "./provider-label";

// Tone accent color (theme-reactive, resolving against the raw brand vars):
// trigger = primary indigo; structural (parallel/foreach/decision control flow) =
// warning amber; action = neutral. Drives a node's glyph tint and its resting
// border.
export const TONE_ACCENT: Record<WfNodeTone, string> = {
  trigger: "hsl(var(--primary))",
  structural: "var(--surface-warning-text)",
  action: "hsl(var(--muted-foreground))",
};

// Status colors, shared by the node (dot/progress/border) and the edges so a node
// and the hop pointing at it read as one. Each is a semantic token with a
// per-theme value, so the run state is legible in light and dark alike.
const STATUS_QUEUED = "hsl(var(--muted-foreground))";
const STATUS_DONE = "var(--surface-success-text)";
const STATUS_FAILED = "var(--surface-danger-text)";
export const STATUS_RUNNING = "hsl(var(--primary))";
/** A run blocked on a human borrows the warning surface — the same amber the
 *  design system uses for "needs attention". It must never read as the primary
 *  "running" accent: the workflow is not working, it is waiting on the viewer. */
const STATUS_WAITING = "var(--surface-warning-text)";
export const STATUS_COLOR: Record<WfNodeStatus, string> = {
  queued: STATUS_QUEUED,
  running: STATUS_RUNNING,
  waiting: STATUS_WAITING,
  succeeded: STATUS_DONE,
  failed: STATUS_FAILED,
};

/** An edge is colored by the status of the node it points AT, so the run's
 *  "front" lights up. Neutral for a not-yet-reached (queued) target or the
 *  static definition view (`undefined`). */
export function edgeColor(status: WfNodeStatus | undefined): string {
  return status ? STATUS_COLOR[status] : STATUS_QUEUED;
}

export const STATUS_LABEL: Record<WfNodeStatus, string> = {
  queued: "Queued",
  running: "Running",
  waiting: "Waiting on you",
  succeeded: "Done",
  failed: "Failed",
};

/** Status pill styling — a tinted well in the status color. Built from the
 *  semantic surface trio (bg/border/text) so the pill keeps its contrast in both
 *  themes rather than washing out in one of them. */
export const STATUS_PILL: Record<
  WfNodeStatus,
  { background: string; color: string; borderColor: string }
> = {
  queued: {
    background: "color-mix(in srgb, hsl(var(--muted-foreground)) 12%, transparent)",
    color: "hsl(var(--muted-foreground))",
    borderColor: "color-mix(in srgb, hsl(var(--muted-foreground)) 28%, transparent)",
  },
  running: {
    background: "color-mix(in srgb, hsl(var(--primary)) 14%, transparent)",
    color: "hsl(var(--primary))",
    borderColor: "color-mix(in srgb, hsl(var(--primary)) 40%, transparent)",
  },
  waiting: {
    background: "var(--surface-warning-bg)",
    color: "var(--surface-warning-text)",
    borderColor: "var(--surface-warning-border)",
  },
  succeeded: {
    background: "var(--surface-success-bg)",
    color: "var(--surface-success-text)",
    borderColor: "var(--surface-success-border)",
  },
  failed: {
    background: "var(--surface-danger-bg)",
    color: "var(--surface-danger-text)",
    borderColor: "var(--surface-danger-border)",
  },
};

/** The card's border + ring once a node has live run state, so the running node
 *  and the terminal ones read at a glance. Returned as inline style (not classes)
 *  because the status colors are semantic tokens, not palette shades. */
export function statusBorder(status: WfNodeStatus): {
  borderColor: string;
  boxShadow?: string;
} {
  const color = STATUS_COLOR[status];
  switch (status) {
    case "running":
    case "waiting":
      // The soft glow (plus, for `running`, the animated inbound edge) carries the
      // "look here" signal — no whole-card pulse, which would fade the text along
      // with it. `waiting` gets the SAME treatment because the parked node is the
      // one the viewer has to act on: it must be at least as prominent as the live
      // one. It just must not read as live — hence the amber `color`, the still
      // progress bar, and the un-animated edge.
      return {
        borderColor: color,
        boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 45%, transparent), 0 0 24px -6px ${color}`,
      };
    case "queued":
      // A not-yet-reached node stays quiet: the resting border, no accent.
      return { borderColor: "hsl(var(--border))" };
    default:
      return {
        borderColor: color,
        boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
      };
  }
}

/** Determinate progress fraction for a node's status: queued reads near-empty,
 *  running and waiting a partial (the run reached this node but has not finished
 *  it), terminal full. Shared so every progress treatment (bar, footer, fill) maps
 *  status → fill identically. A `waiting` bar is deliberately NOT animated by its
 *  callers: the run is stopped there, and a moving bar would say otherwise. */
export function progressFill(status: WfNodeStatus): string {
  return status === "succeeded" || status === "failed"
    ? "100%"
    : status === "running" || status === "waiting"
      ? "58%"
      : "6%";
}

// One lucide glyph per action/trigger kind, for the steps that have no provider
// logo to show. A kind we don't model yet falls back to a neutral dot.
export const KIND_ICON: Record<string, LucideIcon> = {
  schedule: Clock,
  provider_event: Webhook,
  trigger: Zap,
  "agent.run": Sparkles,
  "integration.invoke": Cable,
  notify: Bell,
  parallel: GitBranch,
  foreach: Repeat,
  decision: UserCheck,
  "sandbox.spawn": Box,
  "sandbox.snapshot": Camera,
  "script.run": Code,
  "trace.analyze": ScanSearch,
};

/**
 * A node's MARK, centered in a tile the caller sizes: the provider's brand logo
 * when the step runs against a connector — the way n8n makes a node recognizable
 * before a word of it is read — else the kind's glyph, tinted by tone. Both
 * densities render the same mark at different sizes, so a node looks like itself
 * whether it's an icon tile or a full card.
 */
export function NodeMark({
  kind,
  provider,
  model,
  accent,
  tile,
}: {
  kind?: string;
  provider?: string;
  /** The model an agent runs, e.g. "anthropic/claude-sonnet-4-5". Its lab/host
   *  brand mark identifies the node far faster than a generic sparkle. */
  model?: string;
  accent: string;
  /** Edge length of the square the mark is centered in. */
  tile: number;
}) {
  const Icon = (kind && KIND_ICON[kind]) || Circle;
  // An agent is identified by WHO runs it. A published brand mark says that at a
  // glance; a model with no mark keeps the kind glyph rather than an invented one.
  const brand = !provider && model ? modelBrandFor(model) : null;
  // A logo is a full-bleed image, so it fills more of the tile than a line glyph,
  // which needs the surrounding air to stay legible.
  const mark = Math.round(tile * (provider ? 0.58 : 0.5));
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border"
      style={{
        width: tile,
        height: tile,
        background: `color-mix(in srgb, ${accent} 10%, hsl(var(--card)))`,
      }}
    >
      {provider ? (
        <ProviderIcon
          id={provider}
          displayName={providerLabel(provider)}
          size={mark}
          className="rounded-[3px]"
        />
      ) : brand ? (
        // One lab's own model draws ONE mark (28px at `md`) and fills the tile. A
        // HOSTED model draws two — host behind, lab in front — and that stack is
        // 36px wide, which would push the lab chip past the border of an expanded
        // card's 34px tile. So the stacked pair steps down unless the tile can hold
        // it; the single mark never has to.
        <ModelBrandStack
          identity={brand}
          size={brand.combined || tile >= 38 ? "md" : "sm"}
        />
      ) : (
        <Icon size={mark} strokeWidth={1.75} style={{ color: accent }} />
      )}
    </span>
  );
}
