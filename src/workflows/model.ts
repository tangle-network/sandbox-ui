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

import { parse as parseYaml } from "yaml";
import { providerLabel } from "./provider-label";

export type WfNodeTone = "trigger" | "structural" | "action";

export type WfNodeStatus = "queued" | "running" | "succeeded" | "failed";

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
export interface WfNodeData extends Record<string, unknown> {
  /** Headline for the node, e.g. "Run agent". */
  title: string;
  /** The action/trigger kind verbatim, e.g. "agent.run", "schedule". Set on every
   *  node `buildWorkflowGraph` produces so a card can label what it is regardless
   *  of which subtitle it shows; optional on the type so external consumers
   *  constructing `WfNodeData` directly aren't forced to supply it (the render
   *  guards its usage). */
  kind?: string;
  /** Secondary detail, e.g. an integration path or a cron expression. */
  subtitle?: string;
  /** Requested model (agent.run), shown as a chip even before a run. */
  model?: string;
  /** `integration.invoke` provider.method path. */
  path?: string;
  /** Notable config fields for the expand drawer (kept small + stringified). */
  detail?: Record<string, string>;
  /** The raw, UNTRUNCATED config for this node — the action/trigger config from
   *  the definition. The compact card reads {@link detail}; a full-detail view
   *  (e.g. a node drawer) reads this to render every field — the complete prompt,
   *  all profile/source/input keys — without the card-sized clamp. It is a
   *  JSON-safe deep copy of the config (cycles and non-JSON values normalized),
   *  so a consumer can serialize or render it freely. Omitted when the node has
   *  no config. */
  config?: Record<string, unknown>;
  /** Connector slug (e.g. `github`) for the provider chip, when one applies. */
  provider?: string;
  /** Small corner tag, e.g. "×3" for a parallel fan-out. */
  badge?: string;
  /** Whether this node fans out to branch leaves (renders a right handle). */
  hasBranches: boolean;
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
const NODE_W = 244;
/** Gap between successive layers along the main axis. */
const RANK_SEP = 76;
/** Gap between two nodes stacked in the same layer (branch leaves) along the
 *  cross axis. */
const CROSS_SEP = 22;
/** A card's fixed chrome: vertical padding (py-2) + top/bottom border. */
const CARD_CHROME = 22;
/** The always-present header row (type-icon box + title). */
const HEADER_ROW = 30;
/** A single-line text row (subtitle, provider chip). */
const TEXT_ROW = 20;
/** The meta-chip row, clamped to two lines (model/cost/token chips). */
const META_ROW = 46;
/** A two-line, line-clamped output/error preview. */
const PREVIEW_ROW = 36;
/** The run progress strip: a bar + a rounds/elapsed footer. */
const PROGRESS_ROW = 26;
/** Fixed dimensions of a compact (collapsed) node — icon + title + one-line
 *  summary, uniform so the collapsed graph reads as an even grid. */
export const COMPACT_NODE_SIZE = { width: 240, height: 64 };

/**
 * The card's box height. The React Flow node is PINNED to this height (the card
 * fills it via `h-full` inside a node sized to it) and clips overflow, so cards
 * can never overlap regardless of the consumer's fonts — this height IS the
 * layout, not an estimate of the DOM. The row constants are tuned for the
 * library's default token/font config; a consumer whose fonts render a row
 * taller just sees that content clamped within the fixed box, never a reflow.
 * `withRunState` reserves the rows live run state adds (the meta-chip row, the
 * output/error preview, and the progress strip) so the layout — computed ONCE,
 * before any run state is merged in — already leaves room for a node that later
 * runs, and the merge never reflows. A trigger only ever shows a status (no
 * metrics/output/progress), so it's spaced by its static height (`withRunState`
 * false) and the node component skips its progress strip to match.
 */
function nodeHeight(data: WfNodeData, withRunState: boolean): number {
  let h = CARD_CHROME + HEADER_ROW;
  if (data.subtitle) h += TEXT_ROW;
  // The meta row renders for a node with a model chip (pre-run) and for any node
  // once a run populates cost/tokens — reserve it whenever either can apply.
  if (withRunState || data.model) h += META_ROW;
  // A run overlay adds the output/error preview and the progress strip.
  if (withRunState) h += PREVIEW_ROW + PROGRESS_ROW;
  if (data.provider) h += TEXT_ROW;
  return h;
}

/** Main-axis flow direction: "LR" (left-to-right, default) suits the wide/short
 *  run-detail panel; "TB" (top-to-bottom) suits a narrow column. */
export type WfDirection = "LR" | "TB";

/** Options for {@link buildWorkflowGraph}. */
export interface BuildWorkflowGraphOptions {
  /**
   * Reserve space for the rows live run state adds to a node (the meta-chip row +
   * the output/error preview), so the RUN view never overlaps once a node starts
   * or terminates. The static/preview layout (no run overlay) leaves this off to
   * stay compact. Defaults to `false`.
   */
  reserveRunState?: boolean;
  /** Flow direction. Defaults to "LR". */
  direction?: WfDirection;
  /** Override the node dimensions the layout spaces by (and the card renders at).
   *  Defaults to a fixed width + {@link nodeHeight}. A caller with a different node
   *  design supplies its own sizing so the layout stays collision-free. */
  measure?: (
    data: WfNodeData,
    withRunState: boolean,
  ) => { width: number; height: number };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
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

/** Collect a small, stringified map of notable config for the expand drawer.
 *  Bounded to the named keys and short values so the drawer stays readable and
 *  the node data never carries an arbitrarily large payload. */
function pickDetail(
  cfg: Record<string, unknown>,
  keys: string[],
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = cfg[key];
    if (v === undefined || v === null) continue;
    const text =
      typeof v === "string"
        ? v
        : typeof v === "number" || typeof v === "boolean"
          ? String(v)
          : Array.isArray(v)
            ? `${v.length} item${v.length === 1 ? "" : "s"}`
            : "…";
    out[key] = text.length > 200 ? `${text.slice(0, 200)}…` : text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Build the card-facing node data for a single `do` leaf or top-level action:
 *  title, subtitle, and the compact `detail` map. The action object is a
 *  single-key map (`{ "integration.invoke": {...} }`), mirroring the YAML
 *  schema. Returns the base data WITHOUT the raw `config`. */
function describeActionBase(action: unknown): WfNodeData {
  const rec = asRecord(action);
  const [kind] = Object.keys(rec);
  const cfg = asRecord(rec[kind]);
  switch (kind) {
    case "sandbox.spawn":
      return {
        title: "Spawn sandbox",
        kind,
        subtitle: str(cfg.template),
        detail: pickDetail(cfg, ["template", "size", "region"]),
        hasBranches: false,
        isRoot: false,
        tone: "action",
      };
    case "integration.invoke": {
      const path = str(cfg.path);
      return {
        title: "Integration",
        kind,
        subtitle: path,
        path,
        provider: path?.split(".")[0],
        detail: pickDetail(cfg, ["path"]),
        hasBranches: false,
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
        detail: pickDetail(cfg, ["url"]),
        hasBranches: false,
        isRoot: false,
        tone: "action",
      };
    }
    case "agent.run":
      return {
        title: "Run agent",
        kind,
        // The prompt says what the agent does; the model is shown as its own
        // chip, so it's not duplicated here.
        subtitle: str(cfg.prompt) ?? str(cfg.profile),
        model: str(cfg.model),
        detail: pickDetail(cfg, [
          "profile",
          "model",
          "maxRounds",
          "size",
          "prompt",
        ]),
        hasBranches: false,
        isRoot: false,
        tone: "action",
      };
    case "parallel": {
      const branches = Array.isArray(cfg.branches) ? cfg.branches : [];
      return {
        title: "Parallel",
        kind,
        subtitle: `${branches.length} branch${branches.length === 1 ? "" : "es"}`,
        badge: branches.length > 0 ? `×${branches.length}` : undefined,
        hasBranches: branches.length > 0,
        isRoot: false,
        tone: "structural",
      };
    }
    case "foreach":
      return {
        title: "For each",
        kind,
        subtitle: typeof cfg.items === "string" ? cfg.items : "list",
        detail: pickDetail(cfg, ["items"]),
        // Only fans out when a `do` template is actually present.
        hasBranches: Boolean(cfg.do),
        isRoot: false,
        tone: "structural",
      };
    default:
      return {
        title: kind ? kind : "Action",
        kind: kind ?? "action",
        hasBranches: false,
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

/** Describe one action as node data, attaching the raw, untruncated `config` for
 *  a full-detail view on top of the card-facing summary from
 *  {@link describeActionBase}. Config is omitted when the action carries none. */
function describeAction(action: unknown): WfNodeData {
  const rec = asRecord(action);
  const [kind] = Object.keys(rec);
  return withConfig(describeActionBase(action), asRecord(rec[kind]));
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
    let subtitle = connection ? providerLabel(connection) : "Event";
    if (event) subtitle += ` · ${event}`;
    if (actions.length > 0) subtitle += ` (${actions.join("/")})`;
    if (repo) subtitle += ` on ${repo}`;
    return withConfig(
      {
        title: "Trigger",
        kind: "provider_event",
        subtitle,
        provider: connection,
        hasBranches: false,
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
        subtitle: cron ? (tz ? `${cron} (${tz})` : cron) : undefined,
        hasBranches: false,
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
      hasBranches: false,
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
function layoutLayers(nodes: LayoutNode[], direction: WfDirection): WfNode[] {
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
    cursor += Math.max(...byRank.get(r)!.map(mainSize)) + RANK_SEP;
  }

  const out: WfNode[] = [];
  for (const r of ranks) {
    const layer = byRank.get(r)!;
    const extent = Math.max(...layer.map(mainSize));
    const span =
      layer.reduce((s, n) => s + crossSize(n), 0) +
      CROSS_SEP * (layer.length - 1);
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
      cross += crossSize(n) + CROSS_SEP;
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
 *  picks the flow axis (default "LR"). */
export function buildWorkflowGraph(
  yaml: string,
  options?: BuildWorkflowGraphOptions,
): WfGraph {
  const reserveRunState = options?.reserveRunState ?? false;
  const direction = options?.direction ?? "LR";
  const measure = options?.measure;
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

  const addNode = (
    id: string,
    data: WfNodeData,
    rank: number,
    withRunState: boolean,
  ) => {
    const dims = measure
      ? measure(data, withRunState)
      : { width: NODE_W, height: nodeHeight(data, withRunState) };
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
      addEdge(from, id, from.includes("-b") ? "join" : "spine");
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

  return { nodes: layoutLayers(logical, direction), edges, error: null };
}
