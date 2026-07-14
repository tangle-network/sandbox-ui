/**
 * Turns a workflow YAML definition into a positioned node/edge graph for the
 * visualizer. Pure and React-Flow-agnostic so the parsing + layout is unit
 * testable on its own; the component maps these shapes onto React Flow nodes.
 *
 * The workflow model is a linear spine (trigger → action → action …) with
 * one-level fan-out: a `parallel` action has N leaf branches and a `foreach`
 * action has one leaf template. Branches dangle to the right of their structural
 * node on the spine; they never continue the chain (the schema forbids nesting),
 * so the spine stays a single readable column.
 */

import { describeCron } from "./cron";
import { clampPreview } from "./format";
import {
  actionPathLabel,
  humanizeIdentifier,
  parseActionPath,
  shortModel,
} from "./naming";
import { providerLabel } from "./provider-label";
import { parse as parseYaml } from "yaml";

export type WfNodeTone = "trigger" | "structural" | "action";

/**
 * A node's live run status. `waiting` is NOT a variant of `running`: the run has
 * stopped at that node and makes no further progress until a human answers it (a
 * `decision` step). Collapsing it into `running` tells the viewer the workflow is
 * working when in fact it is blocked on THEM — so it gets its own colour, its own
 * label, and a progress bar that does not move.
 */
export type WfNodeStatus =
  | "queued"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed";

/**
 * Live RUN state for one node, supplied by the host (keyed by node id) and
 * merged onto {@link WfNodeData.state} at render time. Absent ⇒ the graph shows
 * the static definition only (the assistant-proposal preview path). Driven from
 * a workflow run's per-action results so the graph animates as the run executes.
 *
 * Keep every field PRIMITIVE: `sameRunState` (flow-graph.ts) shallow-compares
 * with `===` to decide whether a render tick changed a node. A nested object/
 * array field would compare by reference (a structurally-equal value reads as
 * changed → a harmless extra render, never a stale node) — if one is ever needed,
 * teach `sameRunState` to compare it.
 */
export interface WfNodeState {
  status: WfNodeStatus;
  /** Amount booked for this action, USD. */
  costUsd?: number;
  /** Wall-clock the action took, ms. */
  durationMs?: number;
  /** Model the action actually used (may differ from the requested model). */
  model?: string;
  /** Failure message, when the node failed. */
  error?: string;
  /** Short preview of the action's output (or a failure's partial text). */
  outputPreview?: string;
  /** Input/output token usage, when known. */
  inputTokens?: number;
  outputTokens?: number;
  /** Agent iteration count (agent.run only) — the number of reasoning/tool
   *  rounds the agent has taken, surfaced on the node's progress strip. */
  rounds?: number;
}

// Extends Record<string, unknown> so it satisfies React Flow's node-data
// constraint — letting the graph use the typed `Node<WfNodeData>` /
// `NodeProps<Node<WfNodeData>>` generics instead of unsafe `as unknown as` casts.
/**
 * A node's card-facing content. Three tiers, so both densities can show the
 * right amount without either re-deriving it:
 *
 *  - {@link title} — WHO the step is ("GitHub", "AI Agent", a decision's own
 *    title). Never a machine identifier.
 *  - {@link subtitle} — WHAT it does, in one short phrase ("create: pulls.reviews",
 *    the model, "Weekdays at 09:00", "3 branches").
 *  - {@link description} — the free-text detail worth reading when there's room
 *    (an agent's prompt, a notify URL, the events a trigger listens for).
 *
 * The compact node shows title + subtitle; the expanded node adds the
 * description, the run metrics, and the output. Any longer/raw values live in
 * {@link config} for the full-detail view.
 */
export interface WfNodeData extends Record<string, unknown> {
  /** Human headline for the node, e.g. "GitHub", "AI Agent". */
  title: string;
  /** The action/trigger kind verbatim, e.g. "agent.run", "schedule". Set on every
   *  node `buildWorkflowGraph` produces so a consumer can dispatch on the node's
   *  type (icon, detail rendering) regardless of what its title says; optional on
   *  the type so external consumers constructing `WfNodeData` directly aren't
   *  forced to supply it (the render guards its usage). */
  kind?: string;
  /** The one-phrase qualifier under the title, e.g. "create: pulls.reviews". */
  subtitle?: string;
  /** Free-text detail (agent prompt, notify URL, trigger events) — shown only by
   *  the expanded node, which has the room to clamp it to two lines. */
  description?: string;
  /** Requested model (agent.run). A live run's ACTUAL model (`state.model`)
   *  supersedes it on the card. */
  model?: string;
  /** `integration.invoke` provider.method path. */
  path?: string;
  /** The raw, UNTRUNCATED config for this node — the action/trigger config from
   *  the definition. The card shows the summary above; a full-detail view (e.g. a
   *  node drawer) reads this to render every field — the complete prompt, all
   *  profile/source/input keys — without the card-sized clamp. It is a JSON-safe
   *  deep copy of the config (cycles and non-JSON values normalized), so a
   *  consumer can serialize or render it freely. Omitted when the node has no
   *  config. */
  config?: Record<string, unknown>;
  /** Connector slug (e.g. `github`) — drives the node's brand logo, so a provider
   *  step is recognizable before any text is read. */
  provider?: string;
  /** Small corner tag, e.g. "×3" for a parallel fan-out. */
  badge?: string;
  /** Whether this node is the spine root (no incoming/target handle). */
  isRoot: boolean;
  tone: WfNodeTone;
  /** Live run state, merged in by the host at render time (never from YAML). */
  state?: WfNodeState;
}

export interface WfNode {
  id: string;
  position: { x: number; y: number };
  /** Authoritative rendered size (px). The card renders at exactly this box
   *  (`h-full`/`w-full`) so the layout — which spaces nodes by these dims — is
   *  collision-free by construction, with no measure-then-reflow pass. */
  width: number;
  height: number;
  data: WfNodeData;
}

export type WfEdgeKind = "spine" | "fork" | "join";

export interface WfEdge {
  id: string;
  source: string;
  target: string;
  /** Spine = trigger→action→action; fork = fan-out into a branch leaf; join =
   *  a branch leaf reconverging onto the next spine node. Drives edge styling. */
  kind: WfEdgeKind;
}

export interface WfGraph {
  nodes: WfNode[];
  edges: WfEdge[];
  /** Set when the YAML couldn't be parsed into a renderable graph. */
  error: string | null;
}

// Layout geometry (px). A layered flow: the trigger→action spine advances along
// the MAIN axis (x for "LR", y for "TB"); a fan-out node's branch leaves occupy
// the next layer and stack along the CROSS axis, centered on the spine. Node
// dimensions here are AUTHORITATIVE — the card renders at exactly this box, so
// spacing is collision-free with no measure/reflow pass (see WfNode.height).
/** Fixed card width — uniform so every layer is evenly pitched and the cards read
 *  as one system. */
const NODE_W = 292;
/** Gap between successive layers along the main axis. */
const RANK_SEP = 72;
/** Gap between two nodes stacked in the same layer (branch leaves) along the
 *  cross axis. */
const CROSS_SEP = 24;
// Each band below is the row's RENDERED height, measured in the browser at the
// library's default font config — content height plus the `mt-2` that separates
// it from the band above. They are reservations, not estimates: the card's bands
// are `shrink-0` inside an `overflow-hidden` region, so a consumer whose fonts
// render a band taller sees that band CLIPPED within its fixed box — never a
// squeezed line of text, and never a reflow of the graph.
/** A card's fixed chrome: content padding (pt-2.5 + pb-2) + top/bottom border. */
const CARD_CHROME = 20;
/** The always-present header row — the type tile (34px), which is taller than the
 *  title + subtitle stacked beside it. */
const HEADER_ROW = 34;
// The text bands below carry 2px of headroom over their measured height: a
// rendered row is fractional (2 × 15.125px for a two-line clamp) and scales with
// the consumer's base line-height, so reserving the exact measurement leaves a
// band one rounding error from being cut.
/** The two-line, clamped description (agent prompt, notify URL, trigger events). */
const DESCRIPTION_ROW = 40;
/** The single-line run metrics (cost · tokens). */
const META_ROW = 27;
/** The output block: a framed well holding an "Output"/"Error" caption over a
 *  two-line, clamped content-aware body (JSON key/value, prose, or monospace). */
const OUTPUT_ROW = 72;
/** The run status FOOTER pinned to the card's bottom: a top border (1px), the
 *  progress bar (`h-1`, 4px), and a `py-1` caption row whose line box is pinned
 *  (so a node with no rounds/elapsed to report keeps the same footer as one that
 *  has both — otherwise the band's height would drift with its content). */
const FOOTER_ROW = 28;

/**
 * A compact node is an n8n-style ICON TILE with its name alongside: the tile is
 * the visual node (bordered, the logo/glyph centered in it) and the name sits
 * next to it, unboxed, on the canvas. The box the layout spaces by covers BOTH —
 * so a name can never collide with its neighbour — while the edges attach to the
 * TILE, not the box (the node component offsets its handles onto the tile's edges
 * using the constants here).
 *
 * WHICH side the name sits on is the flow direction's business, and it is not
 * cosmetic. An edge leaves the tile's trailing edge — the right in LR, the BOTTOM
 * in TB — so a name placed under the tile in TB would have every outgoing edge
 * drawn straight through it. The name therefore goes UNDER the tile in LR (edges
 * pass left and right of it) and BESIDE the tile in TB (edges pass above and
 * below it). Either way, no edge ever crosses a word.
 */
export const COMPACT_TILE = 76;
/** The gap between the tile and its name, either axis. */
export const COMPACT_GAP = 8;
/** The name block's width when it sits BESIDE the tile (TB). */
export const COMPACT_LABEL_W = 152;
/** LR: the tile, the gap, and a two-line name block (title + subtitle) beneath it
 *  — plus one more line of run metrics once a run is in play, reserved up front so
 *  the merge never reflows. */
export const COMPACT_NODE_SIZE = {
  width: 168,
  height: COMPACT_TILE + COMPACT_GAP + 34,
};
export const COMPACT_NODE_SIZE_RUN = {
  width: 168,
  height: COMPACT_TILE + COMPACT_GAP + 34 + 15,
};
/** TB: the name sits beside the tile, so the box is the tile's height — the name
 *  block (2-3 short lines) is shorter than the tile it sits next to, run state or
 *  not, which is why TB needs no separate run-reserved size. */
export const COMPACT_NODE_SIZE_TB = {
  width: COMPACT_TILE + COMPACT_GAP + COMPACT_LABEL_W,
  height: COMPACT_TILE,
};

/**
 * The card's box height. The React Flow node is PINNED to this height (the card
 * fills it via `h-full` inside a node sized to it) and clips overflow, so cards
 * can never overlap regardless of the consumer's fonts — this height IS the
 * layout, not an estimate of the DOM. The row constants are tuned for the
 * library's default token/font config; a consumer whose fonts render a row
 * taller just sees that content clamped within the fixed box, never a reflow.
 * `withRunState` reserves the rows live run state adds (the metrics line, the
 * output block, and the bottom status footer) so the layout — computed ONCE,
 * before any run state is merged in — already leaves room for a node that later
 * runs, and the merge never reflows. A trigger only ever shows a status (no
 * metrics/output/progress), so it's spaced by its static height (`withRunState`
 * false) and the node component skips its footer to match.
 */
function nodeHeight(data: WfNodeData, withRunState: boolean): number {
  let h = CARD_CHROME + HEADER_ROW;
  if (data.description) h += DESCRIPTION_ROW;
  // Metrics (cost · tokens) and the output block exist only once a run does.
  if (withRunState) h += META_ROW + OUTPUT_ROW + FOOTER_ROW;
  return h;
}

/** Main-axis flow direction: "LR" (left-to-right, default) suits the wide/short
 *  run-detail panel; "TB" (top-to-bottom) suits a narrow column. */
export type WfDirection = "LR" | "TB";

/** Options for {@link buildWorkflowGraph}. */
export interface BuildWorkflowGraphOptions {
  /**
   * Reserve space for the rows live run state adds to a node (the metrics line,
   * the output/error preview, the status footer), so the RUN view never overlaps
   * once a node starts or terminates. The static/preview layout (no run overlay)
   * leaves this off to stay compact. Defaults to `false`.
   */
  reserveRunState?: boolean;
  /** Flow direction. Defaults to "LR". */
  direction?: WfDirection;
  /** Collapse every node to the fixed icon-tile size, and pitch the layers for
   *  it. Defaults to `false` (the full, expanded card). */
  compact?: boolean;
}

/**
 * The node box + the layer/lane separators for one density, resolved ONCE per
 * graph. The two travel together: a compact box is much wider than the tile it
 * draws (the name underneath it is), so the separator is only part of the gap a
 * reader actually sees — the box's own margin supplies the rest. Its layers
 * therefore pitch much tighter than the expanded cards', to land at a comparable
 * VISUAL gap rather than a comparable numeric one.
 *
 * `runMode` is the GRAPH's — not the individual node's. Every compact tile is
 * the same box even though a trigger shows no metrics line, because the tile sits
 * at the top of its box: a shorter trigger box would ride its tile up out of line
 * with the row it belongs to. (An expanded card, whose content starts at the top
 * edge either way, is free to be exactly as tall as it needs — see nodeHeight.)
 */
function geometry(compact: boolean, runMode: boolean, direction: WfDirection) {
  if (compact) {
    // TB lays the name beside the tile (see COMPACT_NODE_SIZE_TB), so its box is
    // one tile tall whether or not a run is on — and its layers, which advance
    // DOWN past that short box, need a little more air between them than LR's do.
    if (direction === "TB") {
      return { size: COMPACT_NODE_SIZE_TB, rankSep: 34, crossSep: 24 };
    }
    return {
      size: runMode ? COMPACT_NODE_SIZE_RUN : COMPACT_NODE_SIZE,
      rankSep: 20,
      crossSep: 20,
    };
  }
  return { size: undefined, rankSep: RANK_SEP, crossSep: CROSS_SEP };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/** A free-text field as a node DESCRIPTION: bounded, because the card clamps it
 *  to two lines and hangs it in a tooltip — an 8k prompt has no business in
 *  either. The untruncated value stays on `config` for the detail view. */
function describeText(v: unknown): string | undefined {
  const text = str(v);
  return text ? clampPreview(text.trim(), 220) : undefined;
}

/** Host of an https URL for a compact `notify` subtitle; the raw value if it
 *  isn't a parseable URL (e.g. a `${...}` expression). */
function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * The keys a `do` entry may carry ALONGSIDE its one action key: the guard, the
 * retry policy, and the failure policy. They are not actions and never name a
 * node.
 */
const CONTROL_FLOW_KEYS = ["if", "retry", "onError"] as const;
const CONTROL_FLOW = new Set<string>(CONTROL_FLOW_KEYS);

/**
 * The action kind a `do` entry declares. A `do` entry is a one-key action map
 * that may also carry the control-flow siblings above, and YAML preserves the
 * author's key order — so `- if: … / agent.run: …` puts `if` first. The kind can
 * therefore never be "the first key": that names a guarded step after its guard.
 *
 * It is whatever is NOT control flow — chosen by EXCLUSION, not by matching a list
 * of kinds we happen to know. An allowlist would silently start naming steps after
 * their guard again the moment the API adds a kind (`agent.review`), since an
 * unknown kind would fall out of the list and the guard would win by position.
 */
function actionKind(rec: Record<string, unknown>): string | undefined {
  return Object.keys(rec).find((k) => !CONTROL_FLOW.has(k));
}

/** The SHAPE of an id the platform minted for a stored profile: `ap_` followed by 16
 *  base64url characters (what 12 random bytes encode to). Shape only — it says
 *  nothing about the bytes behind it, and nothing about whether such a profile
 *  exists; the host holds the catalog that could answer either.
 *
 *  What it buys is a title. A minted id names the profile to a DATABASE, not to a
 *  reader — humanising it yields noise ("ap_NROQux-n7dC7Ll30" → "Ap nro qux n7d c7
 *  ll30") — so a node named by one is titled generically instead.
 *
 *  The length is pinned rather than open-ended: `{8,}` would also swallow a slug a
 *  person wrote that happens to start with `ap_` ("ap_code_review"), replacing their
 *  name with a generic one. */
const MINTED_PROFILE_ID = /^ap_[A-Za-z0-9_-]{16}$/;

/** The agent's name: a profile named by a readable slug reads as the role it plays
 *  ("pr-reviewer" → "PR reviewer"). An inline profile object, or one named only by
 *  a minted catalog id, has no readable name here — the node is the generic agent
 *  rather than a mangled identifier. */
function agentTitle(profile: unknown): string {
  const named = str(profile);
  if (!named || MINTED_PROFILE_ID.test(named)) return "AI Agent";
  return humanizeIdentifier(named);
}

/** Build the card-facing node data for a single `do` leaf or top-level action.
 *  The action object is a single-key map (`{ "integration.invoke": {...} }`),
 *  mirroring the YAML schema, optionally alongside control-flow siblings.
 *  Returns the base data WITHOUT the raw `config`. */
function describeActionBase(action: unknown): WfNodeData {
  const rec = asRecord(action);
  const kind = actionKind(rec);
  const cfg = asRecord(kind ? rec[kind] : undefined);
  switch (kind) {
    case "sandbox.spawn":
      return {
        title: "Sandbox",
        kind,
        subtitle: str(cfg.template) ?? "Provision",
        description: describeText(cfg.prompt),
        isRoot: false,
        tone: "action",
      };
    case "integration.invoke": {
      const path = str(cfg.path);
      const parts = path ? parseActionPath(path) : null;
      return {
        // The provider IS the node's identity, exactly as in n8n — its logo and
        // its name. What it does with it goes in the subtitle.
        title: parts ? providerLabel(parts.provider) : "Integration",
        kind,
        subtitle: path ? actionPathLabel(path) : undefined,
        path,
        provider: parts?.provider,
        isRoot: false,
        tone: "action",
      };
    }
    case "notify": {
      const url = str(cfg.url);
      return {
        title: "Notify",
        kind,
        subtitle: url ? urlHost(url) : undefined,
        description: describeText(url),
        isRoot: false,
        tone: "action",
      };
    }
    case "agent.run": {
      const model = str(cfg.model);
      return {
        title: agentTitle(cfg.profile),
        kind,
        // The model is the agent's defining trait, so it names the step; the
        // prompt — the long part — is the description the expanded card clamps.
        subtitle: model ? shortModel(model) : "Agent",
        description: describeText(cfg.prompt),
        model,
        isRoot: false,
        tone: "action",
      };
    }
    case "parallel": {
      const branches = Array.isArray(cfg.branches) ? cfg.branches : [];
      return {
        title: "Parallel",
        kind,
        subtitle: `${branches.length} branch${branches.length === 1 ? "" : "es"}`,
        badge: branches.length > 0 ? `×${branches.length}` : undefined,
        isRoot: false,
        tone: "structural",
      };
    }
    case "foreach":
      return {
        title: "For each",
        kind,
        subtitle: "Repeat per item",
        description: typeof cfg.items === "string" ? cfg.items : "Literal list",
        // Only fans out when a `do` template is actually present.
        isRoot: false,
        tone: "structural",
      };
    case "decision": {
      const options = Array.isArray(cfg.options)
        ? cfg.options.filter((o): o is string => typeof o === "string")
        : [];
      return {
        // A decision is the one step whose author already wrote it a human title.
        title: str(cfg.title) ?? "Decision",
        kind,
        subtitle:
          options.length > 0
            ? describeText(options.join(" / "))
            : "Waits for a human",
        description: describeText(cfg.prompt),
        isRoot: false,
        tone: "structural",
      };
    }
    default:
      return {
        // An action kind this version doesn't model yet still gets a readable
        // name ("agent.review" → "Agent review") rather than its raw identifier.
        title: kind ? humanizeIdentifier(kind) : "Action",
        kind: kind ?? "action",
        isRoot: false,
        tone: "action",
      };
  }
}

/** Max nesting depth {@link toJsonSafe} descends before returning a marker. A
 *  real workflow config is a handful of levels deep; this bounds the recursion
 *  far below the JS stack limit so a pathologically deep config yields a marker
 *  instead of a `RangeError`, keeping {@link buildWorkflowGraph}'s no-throw
 *  contract intact (node-building runs outside the parse try/catch). */
const MAX_CONFIG_DEPTH = 100;

/** Deep-copy a parsed-config value into a JSON-safe tree for the public `config`
 *  surface. The result is owned by the caller (no references back into the parsed
 *  definition) and is always serializable: cycles — reachable via recursive YAML
 *  anchors — collapse to `"[Circular]"`, nesting beyond {@link MAX_CONFIG_DEPTH}
 *  collapses to `"[Max depth exceeded]"`, and non-JSON values (undefined,
 *  functions, symbols, bigints) are dropped, so a consumer can `JSON.stringify`,
 *  diff, or recursively render the config without throwing. Total by
 *  construction — it never throws, preserving {@link buildWorkflowGraph}'s
 *  no-throw contract. */
function toJsonSafe(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): unknown {
  if (value === null) return null;
  // Non-finite numbers (YAML `.nan`/`.inf`) are not JSON values — normalize to
  // null, matching JSON.stringify, so the tree stays genuinely JSON-safe.
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value !== "object") return undefined; // function, symbol, bigint
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_CONFIG_DEPTH) return "[Max depth exceeded]";
  seen.add(value);
  let out: unknown;
  if (Array.isArray(value)) {
    // A non-JSON array element becomes null (matching JSON.stringify), since an
    // array slot cannot be omitted.
    out = value.map((v) => {
      const s = toJsonSafe(v, seen, depth + 1);
      return s === undefined ? null : s;
    });
  } else {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const s = toJsonSafe(v, seen, depth + 1);
      if (s !== undefined) obj[k] = s; // drop non-JSON object values
    }
    out = obj;
  }
  seen.delete(value);
  return out;
}

/** Attach the raw, untruncated `config` to node data for the full-detail view,
 *  but only when non-empty — an empty config is omitted (never `config: {}`), so
 *  action and trigger nodes honor the same "omitted when no config" contract.
 *  The config is normalized to a JSON-safe deep copy ({@link toJsonSafe}) so the
 *  node owns it outright and a consumer can always serialize/render it. */
function withConfig(base: WfNodeData, cfg: Record<string, unknown>): WfNodeData {
  return Object.keys(cfg).length > 0
    ? { ...base, config: toJsonSafe(cfg) as Record<string, unknown> }
    : base;
}

/**
 * Describe one action as node data, attaching the raw, untruncated `config` for a
 * full-detail view on top of the card-facing summary from
 * {@link describeActionBase}.
 *
 * The config carries the action's own fields PLUS any control-flow the entry
 * declares (`if`/`retry`/`onError`), under those names. A step that may be skipped
 * by a guard, or that retries three times, is not the same step as one that does
 * neither — dropping the envelope would leave the two indistinguishable in the
 * detail view, which is the one place that promises every field.
 */
function describeAction(action: unknown): WfNodeData {
  const rec = asRecord(action);
  const kind = actionKind(rec);
  const base = describeActionBase(action);
  // Normalize the action's config on its OWN — never a shallow copy of it. A copy
  // is a different object than the one a recursive YAML anchor points back at, so
  // `toJsonSafe` would no longer recognize the cycle on its first repeat and would
  // unroll one level of it before collapsing.
  const config = toJsonSafe(asRecord(kind ? rec[kind] : {})) as Record<
    string,
    unknown
  >;
  // The control-flow envelope rides alongside the action's fields, each value
  // normalized in its own right.
  for (const key of CONTROL_FLOW_KEYS) {
    if (rec[key] !== undefined) config[key] = toJsonSafe(rec[key]);
  }
  return Object.keys(config).length > 0 ? { ...base, config } : base;
}

/** Describe the `on:` trigger as the spine's root node. */
function describeTrigger(on: unknown): WfNodeData {
  const rec = asRecord(on);
  if (rec.provider_event) {
    const ev = asRecord(rec.provider_event);
    const connection = str(ev.connection);
    const event = str(ev.event);
    const actions = Array.isArray(ev.actions)
      ? ev.actions.filter((a): a is string => typeof a === "string")
      : [];
    const repo = str(ev.repo);
    // The event the workflow wakes on reads as a sentence — "On pull request" —
    // with the narrowing (which sub-actions, which repo) as the detail below it.
    const description = describeText(
      [actions.length > 0 ? actions.join(", ") : undefined, repo]
        .filter(Boolean)
        .join(" · "),
    );
    return withConfig(
      {
        title: connection ? providerLabel(connection) : "Trigger",
        kind: "provider_event",
        subtitle: event
          ? `On ${humanizeIdentifier(event, "lower")}`
          : "On an event",
        description,
        provider: connection,
        isRoot: true,
        tone: "trigger",
      },
      ev,
    );
  }
  if (rec.schedule) {
    const sch = asRecord(rec.schedule);
    const cron = str(sch.cron);
    const tz = str(sch.timezone);
    return withConfig(
      {
        title: "Schedule",
        kind: "schedule",
        // The cron in English; the expression itself stays in the description (and
        // in full in the config) so the exact timetable is never hidden.
        subtitle: cron ? describeCron(cron) : "On a timetable",
        description: cron ? (tz ? `${cron} · ${tz}` : cron) : undefined,
        isRoot: true,
        tone: "trigger",
      },
      sch,
    );
  }
  // Unknown/custom trigger kind: still surface its raw config so the full-detail
  // view stays consistent with provider_event/schedule (and with actions, which
  // expose config for every kind).
  const [kind] = Object.keys(rec);
  return withConfig(
    {
      title: "Trigger",
      kind: "trigger",
      subtitle: kind ? humanizeIdentifier(kind) : undefined,
      isRoot: true,
      tone: "trigger",
    },
    asRecord(kind ? rec[kind] : undefined),
  );
}

/** A logical node before positioning: its layer (rank) and authoritative dims.
 *  Each spine node is its own layer; a fan-out node's branch leaves share the
 *  layer immediately after it. */
interface LayoutNode {
  id: string;
  data: WfNodeData;
  width: number;
  height: number;
  rank: number;
}

/**
 * Position the logical nodes as a layered flow: advance layers along the MAIN
 * axis (x for "LR", y for "TB") and stack each layer's nodes along the CROSS
 * axis, centered on the spine (cross = 0) so a fan-out fans symmetrically and
 * reconverges cleanly. Because dims are authoritative and each layer is pitched
 * by its widest/tallest node plus a separator, layers can never overlap.
 */
function layoutLayers(
  nodes: LayoutNode[],
  direction: WfDirection,
  rankSep: number,
  crossSep: number,
): WfNode[] {
  const isLR = direction === "LR";
  const mainSize = (n: LayoutNode) => (isLR ? n.width : n.height);
  const crossSize = (n: LayoutNode) => (isLR ? n.height : n.width);

  const byRank = new Map<number, LayoutNode[]>();
  for (const n of nodes) {
    const arr = byRank.get(n.rank);
    if (arr) arr.push(n);
    else byRank.set(n.rank, [n]);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // Main-axis start of each layer: cumulative widest/tallest node + separator.
  const mainStart = new Map<number, number>();
  let cursor = 0;
  for (const r of ranks) {
    mainStart.set(r, cursor);
    cursor += Math.max(...byRank.get(r)!.map(mainSize)) + rankSep;
  }

  const out: WfNode[] = [];
  for (const r of ranks) {
    const layer = byRank.get(r)!;
    const extent = Math.max(...layer.map(mainSize));
    const span =
      layer.reduce((s, n) => s + crossSize(n), 0) +
      crossSep * (layer.length - 1);
    let cross = -span / 2;
    for (const n of layer) {
      // Center each node within its layer's main extent — a no-op for LR's
      // uniform widths, but it keeps a TB layer of unequal heights aligned.
      const main = mainStart.get(r)! + (extent - mainSize(n)) / 2;
      out.push({
        id: n.id,
        position: isLR ? { x: main, y: cross } : { x: cross, y: main },
        width: n.width,
        height: n.height,
        data: n.data,
      });
      cross += crossSize(n) + crossSep;
    }
  }

  // Shift into the positive quadrant for a tidy origin (fitView re-centers, but
  // a positive box is friendlier to size measurement and screenshots).
  const minX = Math.min(...out.map((n) => n.position.x));
  const minY = Math.min(...out.map((n) => n.position.y));
  for (const n of out) {
    n.position = { x: n.position.x - minX, y: n.position.y - minY };
  }
  return out;
}

/** Build a positioned graph from a workflow YAML string. Never throws —
 *  malformed YAML or an empty definition returns an `error` the UI can fall
 *  back on (e.g. show the raw YAML while authoring). `reserveRunState` leaves
 *  room for the rows live run state adds (see {@link nodeHeight}); `direction`
 *  picks the flow axis (default "LR"); `compact` collapses nodes to icon tiles. */
export function buildWorkflowGraph(
  yaml: string,
  options?: BuildWorkflowGraphOptions,
): WfGraph {
  const reserveRunState = options?.reserveRunState ?? false;
  const direction = options?.direction ?? "LR";
  const compact = options?.compact ?? false;
  if (!yaml || yaml.trim() === "") {
    return { nodes: [], edges: [], error: "No definition" };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(yaml);
  } catch {
    return { nodes: [], edges: [], error: "Invalid YAML" };
  }
  const def = asRecord(parsed);
  const actions = Array.isArray(def.do) ? def.do : [];
  if (!def.on && actions.length === 0) {
    return { nodes: [], edges: [], error: "Empty workflow" };
  }

  const logical: LayoutNode[] = [];
  const edges: WfEdge[] = [];
  const geo = geometry(compact, reserveRunState, direction);

  const addNode = (
    id: string,
    data: WfNodeData,
    rank: number,
    withRunState: boolean,
  ) => {
    const dims = geo.size ?? {
      width: NODE_W,
      height: nodeHeight(data, withRunState),
    };
    logical.push({ id, data, width: dims.width, height: dims.height, rank });
  };
  const addEdge = (source: string, target: string, kind: WfEdgeKind) => {
    edges.push({ id: `${source}->${target}`, source, target, kind });
  };

  let rank = 0;
  // The node ids the NEXT spine node reconverges from: the current action, or —
  // once it fans out — each of its branch leaves, so a fan-out visibly rejoins
  // the spine instead of dead-ending.
  let prevExits: string[] = [];
  // Branch leaf ids, tracked explicitly so a reconvergence edge is classified as
  // a join by membership — not by string-matching the id format.
  const branchLeafIds = new Set<string>();

  if (def.on) {
    // A trigger only shows a status (no metrics/output/progress), so it's spaced
    // by its static height — the node component skips its progress strip to match.
    addNode("trigger", describeTrigger(def.on), rank, false);
    prevExits = ["trigger"];
    rank += 1;
  }

  actions.forEach((action, i) => {
    const id = `a${i}`;
    const data = describeAction(action);
    // With no `on:` trigger, the first action IS the spine root, so it shows no
    // inbound handle (nothing points at it).
    if (i === 0 && !def.on) data.isRoot = true;
    addNode(id, data, rank, reserveRunState);
    for (const from of prevExits) {
      // An edge arriving from a branch leaf is a join (reconvergence); from a
      // spine node or the trigger it's the spine itself.
      addEdge(from, id, branchLeafIds.has(from) ? "join" : "spine");
    }

    const rec = asRecord(action);
    const children: unknown[] =
      "parallel" in rec
        ? Array.isArray(asRecord(rec.parallel).branches)
          ? (asRecord(rec.parallel).branches as unknown[])
          : []
        : "foreach" in rec
          ? // A foreach with no `do` template has no child to render.
            [asRecord(rec.foreach).do].filter(Boolean)
          : [];

    if (children.length > 0) {
      const branchRank = rank + 1;
      const branchIds: string[] = [];
      children.forEach((child, j) => {
        const cid = `${id}-b${j}`;
        addNode(cid, describeAction(child), branchRank, reserveRunState);
        addEdge(id, cid, "fork");
        branchIds.push(cid);
        branchLeafIds.add(cid);
      });
      // Downstream reconverges from the leaves; the fan-out node itself no longer
      // links straight to the next spine node.
      prevExits = branchIds;
      rank = branchRank + 1;
    } else {
      prevExits = [id];
      rank += 1;
    }
  });

  return {
    nodes: layoutLayers(logical, direction, geo.rankSep, geo.crossSep),
    edges,
    error: null,
  };
}
