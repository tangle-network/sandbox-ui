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

/** Which edge of a node box an edge attaches to. Named in plain compass terms
 *  rather than React Flow's `Position` so the layouter stays free of it. */
export type WfSide = "left" | "right" | "top" | "bottom";

export interface WfNode {
  id: string;
  position: { x: number; y: number };
  /** Authoritative rendered size (px). The card renders at exactly this box
   *  (`h-full`/`w-full`) so the layout — which spaces nodes by these dims — is
   *  collision-free by construction, with no measure-then-reflow pass. */
  width: number;
  height: number;
  data: WfNodeData;
  /**
   * Where this node's edges attach, when the LAYOUT decides rather than the
   * flow direction. A straight layer flow has one answer for every node (edges
   * enter the leading edge and leave the trailing one, per `direction`), so it
   * sets neither and the renderer derives both. A folded layout does not — a row
   * that runs right-to-left mirrors them. Absent ⇒ derive from `direction`.
   */
  sourceSide?: WfSide;
  targetSide?: WfSide;
}

/**
 * Node ids are PUBLIC contract, not an internal detail. A host keys its live
 * `nodeState` by them, points the graph's `selectedNodeId` at one, and — once it
 * supplies a declared topology — names its own edge endpoints with them. They
 * are bare strings, so a host that re-derives the format at the call site gets
 * no type error when the format changes here; the graph simply renders without
 * edges. The format is therefore written in exactly one place (these helpers)
 * and read everywhere else through them.
 */

/** The workflow's first (or only) trigger. */
export const TRIGGER_NODE_ID = "trigger";

const TRIGGER_NODE_ID_PATTERN = new RegExp(`^${TRIGGER_NODE_ID}:(\\d+)$`);

/** The node for the `index`th entry of a list-form `on:`. Entry 0 IS
 *  {@link TRIGGER_NODE_ID}, so a single-trigger graph — the overwhelmingly
 *  common one — keeps the plain id a host may already have persisted.
 *
 *  `index` is a position in the definition's `on:` list: a non-negative
 *  integer. Anything else formats an id no node bears, which a declared
 *  topology then rejects by name ("…names "trigger:NaN", which this definition
 *  has no step for") — reported there rather than thrown from here, because
 *  {@link buildWorkflowGraph} calls this and must never throw. */
export function triggerNodeId(index: number): string {
  return index === 0 ? TRIGGER_NODE_ID : `${TRIGGER_NODE_ID}:${index}`;
}

/** The `on:` entry a trigger node stands for, or null when the id names
 *  anything else — so a host can tell a trigger from an action without
 *  matching the id format itself. */
export function triggerNodeIndex(nodeId: string): number | null {
  if (nodeId === TRIGGER_NODE_ID) return 0;
  const match = TRIGGER_NODE_ID_PATTERN.exec(nodeId);
  return match ? Number(match[1]) : null;
}

/** The node for the `do` entry at `index`. */
export function actionNodeId(index: number): string {
  return `a${index}`;
}

/** The node for the `branchIndex`th fan-out leaf of the `do` entry at
 *  `actionIndex` — a `parallel` branch or a `foreach` template. */
export function branchNodeId(actionIndex: number, branchIndex: number): string {
  return `${actionNodeId(actionIndex)}-b${branchIndex}`;
}

export type WfEdgeKind = "spine" | "fork" | "join";

export interface WfEdge {
  id: string;
  source: string;
  target: string;
  /** Spine = trigger→action→action; fork = fan-out into a branch leaf; join =
   *  a branch leaf reconverging onto the next spine node. Drives edge styling.
   *
   *  A DECLARED edge ({@link BuildWorkflowGraphOptions.edges}) is a `spine`
   *  edge: it is the flow. Fork edges survive a declared topology unchanged (a
   *  branch leaf is this module's own node, which no declared spec addresses);
   *  join edges do not exist under one, because what follows a fan-out is then
   *  declared rather than inferred from list position. */
  kind: WfEdgeKind;
  /** Short, already-human summary of the edge's guard, when it carries one.
   *  Supplied by {@link WfEdgeSpec.whenLabel} — this module never interprets a
   *  condition, it only places the label its host wrote. */
  whenLabel?: string;
  /** True when this edge closes a cycle: it points back at a node that is
   *  already on the path reaching it. Rendered distinctly (dashed, with the
   *  visit budget) because such an edge is the one that can run a node twice. */
  backEdge?: boolean;
}

/**
 * One edge of a DECLARED topology — the caller's answer to "what actually
 * connects to what", replacing the positional spine this module would otherwise
 * infer from `do`-list order.
 *
 * Endpoints are node ids from THIS graph, so name them with {@link actionNodeId}
 * / {@link branchNodeId} / {@link TRIGGER_NODE_ID} rather than by hand. Edges
 * into a node that has none are how a root is identified: every trigger node
 * gets an edge to every root, so the caller declares only the topology it owns
 * and never has to restate what the trigger connects to.
 *
 * The guard arrives PRE-SUMMARIZED (`whenLabel`). A condition's schema belongs
 * to the system that compiles and evaluates it — this library renders graphs and
 * has no business owning a second, drifting interpretation of one. The same
 * summary the host writes here is then the one it can show elsewhere (a skipped
 * step's row), which is what keeps the two readings identical.
 */
export interface WfEdgeSpec {
  from: string;
  to: string;
  whenLabel?: string;
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
/**
 * The layer gap a graph uses once its edges carry labels (a guard summary, a
 * cycle badge). An edge label sits in the corridor BETWEEN two layers, so the
 * corridor has to be wide enough to hold one — at the ordinary separations (72
 * expanded, 20 compact) a chip is several times the gap it sits in and spills
 * across the nodes either side.
 *
 * Reserved for the same reason node heights are: the layout renders the label,
 * so the layout owes it room. Sized to the chip's own max width (`max-w-40`,
 * 160px — the chips stack rather than sit side by side, so the widest possible
 * group is one chip) plus breathing space. Applied only to graphs that actually
 * have labelled edges, so nothing else spreads out.
 */
const EDGE_LABEL_LANE = 180;

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
/**
 * Lines of output body a card shows, per kind, and the reservations that hold
 * them. Each pair is ONE decision written twice — the card clamps to the row
 * count and the layout reserves for exactly that many — so they live together.
 * Raise a clamp without its reservation and the extra line renders into a box
 * with no room for it: the card claims N lines and shows N-1.
 *
 * WHY PER KIND. A workflow graph is laid out once, from the YAML, before any run
 * state exists, so whatever a card reserves is paid by every node of its kind
 * whether or not that node fills it. A single budget therefore has to be the
 * worst case, and every other node pays for it: a `parallel` books no cost and
 * emits no output, and a queued node has neither yet, yet both were given the
 * full metrics + 3-line-well + footer stack — a ~238px box holding one line.
 *
 * What a reservation may key on is anything STRUCTURAL: the node's `kind`,
 * whether it declares a description, whether the graph has a run at all. All of
 * it is fixed when the YAML is parsed and constant for the whole run, so keying
 * on it never reflows. It may NOT key on live state — a node's status, the
 * length of its output, whether it failed — which changes on a tick.
 */
/**
 * An agent's answer is the thing a reader opens a run to see, so it gets the
 * card's BODY rather than a well in the corner of one, and the most rows the
 * data can actually fill.
 *
 * Five because that is the ceiling, not a preference: the host caps the preview
 * at {@link OUTPUT_PREVIEW_CHARS} characters and a {@link NODE_W}-wide card
 * holds roughly 45 a line, so a sixth row would draw blank. Showing more needs
 * the host to send more first.
 */
export const AGENT_BODY_ROWS = 5;
/** Every other action — an integration response, a notify result, a sandbox
 *  summary. A well rather than a body: for these the output is an attribute of
 *  the step, not the point of it, and the full value is one click away in the
 *  host's node panel. */
export const ACTION_OUTPUT_ROWS = 3;
/** Control flow routes the run; it does no work. The only thing it ever has to
 *  report is a failure, and one line carries that. */
export const STRUCTURAL_OUTPUT_ROWS = 1;

// Rendered heights inside a framed well, measured in the browser at the
// library's default font config. A well holds one of two bodies, and they do NOT
// have the same height: prose runs solid, while the JSON key/value rows are
// separated by `space-y-0.5`.
const WELL_PROSE_LINE = 15.125;
const WELL_JSON_LINE = 14.4375;
const WELL_JSON_GAP = 2;
/** Caption + `mb-1`, `py-1.5`, the border, and the `mt-2` above the well. */
const WELL_CHROME = 39.5;
/**
 * Reservation for a well holding `rows` lines, with ~3px of headroom — the same
 * the neighbouring text bands carry against a fractional rendered line.
 *
 * Sized to the TALLER of the two bodies rather than to prose alone. JSON wins
 * from three rows up despite its smaller type, because its gaps accumulate where
 * prose has none (3 rows: 47.3px json vs 45.4px prose) — so sizing off the prose
 * case, which is the one that comes to mind, under-reserves exactly where the
 * card is most crowded.
 */
function wellRow(rows: number): number {
  const body = Math.max(
    rows * WELL_PROSE_LINE,
    rows * WELL_JSON_LINE + (rows - 1) * WELL_JSON_GAP,
  );
  return Math.ceil(WELL_CHROME + body) + 3;
}
/**
 * The agent card's identity STRIP — a small mark, the model, the status pill.
 * Demoted from a full header row because on a finished node the answer, not the
 * label, is what identifies the step.
 *
 * Measured at 19px in the browser, and it is the PILL that sets that height, not
 * the 18px mark beside it — so shrinking the mark alone would not buy anything
 * back. 22 carries the same ~3px headroom the other bands do against a
 * fractional rendered line.
 */
const SLIM_HEADER_ROW = 22;
/**
 * Rendered line height of the answer body.
 *
 * The same 11px/15.125px a well's prose body uses, because it IS the same
 * element: `NodeOutputBody` sets the type size itself, so a container that asks
 * for another one does not get it. Sizing this band off a font the answer never
 * renders at reserves for lines that are not there.
 */
const BODY_LINE = 15.125;
/** The answer body: {@link AGENT_BODY_ROWS} lines plus the `mt-2` above it. */
const AGENT_BODY_ROW = Math.ceil(8 + AGENT_BODY_ROWS * BODY_LINE);
/** Control flow's one-line failure slot, plus the `mt-1.5` above it. */
const CHIP_SLOT_ROW = 22;
/**
 * A decision's header, which STACKS where every other kind's sits on one row:
 * the title takes the full width, and the options share the line below it with
 * the status pill. "Waiting on you" is the widest pill in the set, and on one
 * row beside a 34px mark it left roughly 120px of a {@link NODE_W} card for the
 * question — which truncated both the question and the options on the one node
 * whose whole purpose is to be read and answered.
 *
 * Measured at 42px in the browser: the title's line (16), the `mt-0.5` under it,
 * and an options/pill row that the pill sets at 24 — its text is 10px but its
 * padding and border are not. 45 carries the same ~3px headroom the other bands
 * do against a fractional rendered line.
 */
const DECISION_HEADER_ROW = 45;
/**
 * Kinds that route the run rather than do work. `decision` is deliberately NOT
 * here: it carries the same `structural` tone, but it is the one node that stops
 * the run to ask the reader something, and its card has to hold the question.
 */
const STRUCTURAL_KINDS = new Set(["parallel", "foreach"]);
export function isStructuralKind(kind: string | undefined): boolean {
  return kind !== undefined && STRUCTURAL_KINDS.has(kind);
}
/**
 * Characters of host-supplied preview the card admits before the line clamp gets
 * it. This bound exists to keep an oversized payload out of the DOM, NOT to
 * decide what is visible — the line clamp does that.
 *
 * It matches the cap the host itself applies, which is what makes it the real
 * ceiling on every card design rather than a safety valve: no reservation can
 * show text the host never sent.
 */
export const OUTPUT_PREVIEW_CHARS = 240;
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
  // A definition card has no answer to show, so it shows what the step IS: the
  // header and, where there is one, the description. A trigger only ever fires,
  // so it is spaced this way even in a run graph (see `runBands` in the node).
  if (!withRunState || data.tone === "trigger") {
    return (
      CARD_CHROME + HEADER_ROW + (data.description ? DESCRIPTION_ROW : 0)
    );
  }
  // A decision's description is the QUESTION it is asking, and nothing
  // supersedes it: a parked decision has no output to show instead, and it is
  // the one node the reader has to act on. So it keeps its text where an agent
  // trades its prompt away. It shares control flow's TONE, which is why the
  // split here is on `kind` — keying this off tone drops the question.
  if (data.kind === "decision") {
    return CARD_CHROME + DECISION_HEADER_ROW + DESCRIPTION_ROW + FOOTER_ROW;
  }
  if (isStructuralKind(data.kind)) {
    return CARD_CHROME + HEADER_ROW + CHIP_SLOT_ROW + FOOTER_ROW;
  }
  if (data.kind === "agent.run") {
    return CARD_CHROME + SLIM_HEADER_ROW + AGENT_BODY_ROW + FOOTER_ROW;
  }
  // Every other action. The prompt/URL is authoring detail a run's reader did
  // not come for, so the description band is not reserved — the subtitle already
  // says what was invoked, and the node panel holds the rest.
  return (
    CARD_CHROME + HEADER_ROW + wellRow(ACTION_OUTPUT_ROWS) + FOOTER_ROW
  );
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
  /**
   * Fold a long single-file pipeline into rows instead of one unbounded line,
   * so it occupies both axes of the panel rather than running off one edge.
   * Only a straight chain folds — a graph with any fan-out keeps its layered
   * flow, whose branches need the cross axis. "LR" only. Defaults to `false`.
   */
  wrap?: boolean;
  /**
   * The graph's DECLARED topology. Omit — the default — and edges are inferred
   * from `do`-list order: a linear spine, which is exactly right for a workflow
   * that runs as one, and wrong for any workflow whose definition declares its
   * own edges (`needs`, guards, cycles). Supply it and the inferred spine is
   * replaced wholesale by these edges, the layout is re-ranked to the shape they
   * describe (so a diamond reads as a diamond rather than a chain drawn over
   * one), and cycle-closing edges are marked {@link WfEdge.backEdge}.
   *
   * An edge naming a node this graph has no slot for is an ERROR
   * ({@link WfGraph.error}), never a quiet fall back to the positional spine:
   * the two disagreeing means the topology and the definition came from
   * different places, and a graph that draws edges the run will not take is
   * worse than one that says it cannot be drawn.
   */
  edges?: readonly WfEdgeSpec[];
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
    case "script.run": {
      const connections = Array.isArray(cfg.connections)
        ? cfg.connections.filter((c): c is string => typeof c === "string")
        : [];
      return {
        title: "Script",
        kind,
        // What the box is GRANTED is the thing that distinguishes one script
        // step from another at a glance; the timeout is a bound, and bounds read
        // in the detail view with the rest of the config.
        subtitle:
          connections.length > 0
            ? `TypeScript · ${connections.length} connection${connections.length === 1 ? "" : "s"}`
            : "TypeScript",
        // The head of the module — the same role the prompt plays on an agent:
        // the text that says what this particular step actually does.
        description: describeText(cfg.source),
        isRoot: false,
        tone: "action",
      };
    }
    case "sandbox.snapshot":
      return {
        title: "Snapshot",
        kind,
        // WHICH sandbox is the only thing separating one snapshot step from
        // another, and it is usually a `${steps…}` reference — so the subtitle
        // reads as the step whose disk is being captured.
        subtitle: str(cfg.sandbox) ?? "Capture a sandbox",
        isRoot: false,
        tone: "action",
      };
    case "trace.analyze": {
      const kinds = Array.isArray(cfg.kinds)
        ? cfg.kinds.filter((k): k is string => typeof k === "string")
        : [];
      return {
        title: "Trace analysis",
        kind,
        // The analysts that run ARE the step. The model it runs them on is
        // incidental here (unlike agent.run, where the model IS the identity),
        // so it stays in the config for the detail view and the node keeps its
        // own glyph rather than borrowing a lab's brand mark.
        subtitle:
          kinds.length > 0
            ? describeText(
                kinds.map((k) => humanizeIdentifier(k, "lower")).join(", "),
              )
            : "Default analysts",
        description: describeText(cfg.trace),
        isRoot: false,
        tone: "action",
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

/**
 * A trigger's `scope` in a phrase: which of the provider's things it fires on.
 *
 * The dimension key is the only name available here (the human label lives in
 * the provider catalog, server-side), so it is used as written — `repository`,
 * `channel`. Both directions read as what they mean: a denylist is "all but",
 * an allowlist names its members when there are few enough to be worth naming.
 *
 * Dimensions are read in key order, not in the order the author happened to
 * write them: `Object.entries` follows insertion order, so the same logical
 * scope would otherwise label the node differently depending on how its YAML
 * was typed. Sorted here for the same reason the platform sorts keys when it
 * canonicalises a scope — one scope, one rendering.
 *
 * Compared by code unit rather than `localeCompare`: a dimension id is a
 * machine identifier (`repository`, `channel`), not prose to collate for a
 * reader, and locale-aware ordering would make the rendering depend on the
 * runtime's locale — reintroducing, per viewer, exactly the instability the
 * sort exists to remove.
 */
function describeScope(scope: unknown): string | undefined {
  const rec = asRecord(scope);
  const parts: string[] = [];
  for (const [dimension, raw] of Object.entries(rec).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const selection = asRecord(raw);
    const except = Array.isArray(selection.except)
      ? selection.except.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (except.length === 0) continue;
    // Two or fewer are named; past that a bare count would read as an id, so
    // it says what the number counts.
    const named =
      except.length <= 2 ? except.join(", ") : `${except.length} selected`;
    parts.push(
      selection.default === "exclude"
        ? `${dimension}: ${named}`
        : `${dimension}: all but ${named}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
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
    // with the narrowing (which sub-actions, which repositories) as the detail
    // below it. A `scope` narrows just as much as a `repo` does, so leaving it
    // out would draw a trigger that fires on two repositories identically to one
    // that fires on all of them.
    const description = describeText(
      [
        actions.length > 0 ? actions.join(", ") : undefined,
        repo,
        describeScope(ev.scope),
      ]
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
  if (rec.webhook !== undefined) {
    // The generic inbound hook: a signed per-workflow URL whose request body
    // becomes the trigger payload. Its config is empty by schema, so the node
    // has only its name to carry — which is exactly why it needs one, rather
    // than falling to the generic "Trigger" that names no way of starting.
    return withConfig(
      {
        title: "Webhook",
        kind: "webhook",
        subtitle: "On an inbound POST",
        isRoot: true,
        tone: "trigger",
      },
      asRecord(rec.webhook),
    );
  }
  // Unknown/custom trigger kind: still surface its raw config so the full-detail
  // view stays consistent with provider_event/schedule/webhook (and with
  // actions, which expose config for every kind).
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
 * The shape a folded layout aims for: roughly the proportions of the panels
 * these graphs are shown in (a wide, half-height card). Folding to a target
 * SHAPE rather than a target width is what keeps the layouter free of the
 * canvas — it never measures anything, so a resize can never trigger a
 * relayout, and the framing math still does the fitting.
 */
const WRAP_TARGET_ASPECT = 742 / 480;

/**
 * How many times wider than {@link WRAP_TARGET_ASPECT} a single row must get
 * before it is worth folding. A short pipeline reads best as what it is — one
 * line, left to right — and folding three steps into an L buys legibility
 * nobody needed while making the order something you have to work out. Past
 * this the line is several panels wide and the trade reverses: at four nodes a
 * row still frames at a readable size, at five it does not.
 *
 * The value has to clear a WINDOW, not just land on the right side of one case:
 * a compact node is 118px tall as a definition and 133px once run rows are
 * reserved, which moves a four-node row's aspect between 6.20 and 5.50 and a
 * five-node row's between 7.80 and 6.92. Anything in (6.20, 6.92) — i.e. a
 * multiplier in (4.01, 4.48) — folds the same graph the same way whether or not
 * a run is in play. Sitting at 4.0 does not, and a graph that re-folds the
 * moment a run starts is worse than one that never folds.
 */
const WRAP_ASPECT_TRIGGER = 4.2;

/** The corridor a row change needs. A layer separator is sized for two nodes
 *  standing side by side; stacked rows need enough air that the return bracket
 *  reads as a turn rather than a collision. */
const WRAP_ROW_GAP = 28;

/** How many columns fold `count` equal cells closest to {@link
 *  WRAP_TARGET_ASPECT}. Compared in LOG space so being twice too wide and half
 *  too wide are penalised the same — a linear error would always prefer the
 *  wide side. */
function foldColumns(
  count: number,
  cellW: number,
  cellH: number,
  colSep: number,
  rowSep: number,
): number {
  let best = count;
  let bestError = Number.POSITIVE_INFINITY;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const width = cols * cellW + (cols - 1) * colSep;
    const height = rows * cellH + (rows - 1) * rowSep;
    const error = Math.abs(Math.log(width / height / WRAP_TARGET_ASPECT));
    if (error < bestError) {
      bestError = error;
      best = cols;
    }
  }
  return best;
}

/**
 * Fold a single-file pipeline into ROWS that read boustrophedon — left to
 * right, then right to left on the row below — so consecutive steps stay
 * adjacent and no edge ever travels back across the canvas.
 *
 * One unbounded row is why a long workflow cannot fit its panel: it grows along
 * a single axis while the other sits empty, so framing it whole means zooming
 * until the nodes are specks, and refusing to zoom that far means clipping it.
 * Folding spends the idle axis instead — the eleven steps that need a 2048px
 * row occupy a 732x439 block, which a 742x480 panel frames nearly full size.
 *
 * Returns null unless the graph is a plain LINE, on two counts. Any layer
 * holding more than one node is a fan-out, whose branches already occupy the
 * cross axis the fold needs. And every edge must join one layer to the next: a
 * declared topology may name a shortcut past a step, and mirroring only keeps
 * CONSECUTIVE steps adjacent — a skip that reads as one hop in a straight line
 * becomes a stroke across the middle of a grid. Re-ranking either shape is a
 * different problem from folding a line.
 */
function layoutSerpentine(
  nodes: LayoutNode[],
  edges: readonly WfEdge[],
  colSep: number,
  laneSep: number,
): WfNode[] | null {
  const rowSep = Math.max(laneSep, WRAP_ROW_GAP);
  const byRank = new Map<number, LayoutNode[]>();
  for (const n of nodes) {
    const arr = byRank.get(n.rank);
    if (arr) arr.push(n);
    else byRank.set(n.rank, [n]);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  if (ranks.some((r) => byRank.get(r)!.length !== 1)) return null;

  const rankOf = new Map(nodes.map((n) => [n.id, n.rank]));
  const joinsNextLayer = (e: WfEdge) => {
    const from = rankOf.get(e.source);
    const to = rankOf.get(e.target);
    return from !== undefined && to !== undefined && to === from + 1;
  };
  if (!edges.every(joinsNextLayer)) return null;

  const ordered = ranks.map((r) => byRank.get(r)![0]);
  const count = ordered.length;
  // A uniform cell keeps the fold a true grid: rows line up column-for-column,
  // so the turn between them is a straight drop rather than a dogleg.
  const cellW = Math.max(...ordered.map((n) => n.width));
  const cellH = Math.max(...ordered.map((n) => n.height));
  // Still a shape a panel can frame — keep the line, which reads its order for
  // free.
  const lineAspect = (count * cellW + (count - 1) * colSep) / cellH;
  if (lineAspect <= WRAP_TARGET_ASPECT * WRAP_ASPECT_TRIGGER) return null;

  const cols = foldColumns(count, cellW, cellH, colSep, rowSep);
  // Already the best shape available — leave it as the straight line it is.
  if (cols >= count) return null;

  return ordered.map((node, i) => {
    const row = Math.floor(i / cols);
    const indexInRow = i % cols;
    const leftToRight = row % 2 === 0;
    // Mirroring odd rows puts the last cell of one row directly above the first
    // cell of the next, so every row change is a vertical drop in one column.
    const col = leftToRight ? indexInRow : cols - 1 - indexInRow;
    return {
      id: node.id,
      position: {
        x: col * (cellW + colSep) + (cellW - node.width) / 2,
        y: row * (cellH + rowSep) + (cellH - node.height) / 2,
      },
      width: node.width,
      height: node.height,
      data: node.data,
      // Every node leaves the way its row travels and is entered from behind —
      // including the one that turns the corner. Mirroring puts the last cell
      // of a row directly above the first cell of the next, so a turn is
      // source-right into target-right (or left into left): the renderer draws
      // it as a bracket in the margin beside the column. Routing it through the
      // BOTTOM instead would have to start below the name that sits under the
      // tile, leaving the arrow floating clear of the node it comes from.
      targetSide: leftToRight ? ("left" as const) : ("right" as const),
      sourceSide: leftToRight ? ("right" as const) : ("left" as const),
    };
  });
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

/**
 * The edges that close a cycle, by edge id — an edge whose target is already on
 * the path that reached it, which is the one edge in a loop that can make a node
 * run twice.
 *
 * The walk starts at the graph's ENTRY POINTS and only then at whatever they
 * miss. Both orders find a correct back edge for every cycle (any DFS does), but
 * only this one picks the edge a reader would point at: entering `a→b→c→a` from
 * its entry marks `c→a`, while starting mid-cycle would just as validly mark
 * `a→b`. Nodes no entry point reaches — a loop closed entirely on itself — are
 * walked afterwards, so every edge is classified either way.
 */
function classifyBackEdges(
  orderedIds: readonly string[],
  edges: readonly WfEdge[],
): Set<string> {
  const outgoing = new Map<string, WfEdge[]>();
  const hasIncoming = new Set<string>();
  for (const e of edges) {
    const list = outgoing.get(e.source);
    if (list) list.push(e);
    else outgoing.set(e.source, [e]);
    hasIncoming.add(e.target);
  }
  const walkOrder = [
    ...orderedIds.filter((id) => !hasIncoming.has(id)),
    ...orderedIds.filter((id) => hasIncoming.has(id)),
  ];

  const back = new Set<string>();
  // 0 = unvisited, 1 = on the current path, 2 = finished. An edge into a node at
  // 1 points back into the walk that is still in progress: a cycle.
  const color = new Map<string, 0 | 1 | 2>(orderedIds.map((id) => [id, 0]));
  for (const start of walkOrder) {
    if (color.get(start) !== 0) continue;
    color.set(start, 1);
    // An explicit stack rather than recursion. Depth here is the graph's, not a
    // constant, and this module's contract is that it never throws — a
    // RangeError on a pathologically deep definition would break that.
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const out = outgoing.get(frame.id);
      if (!out || frame.next >= out.length) {
        color.set(frame.id, 2);
        stack.pop();
        continue;
      }
      const edge = out[frame.next];
      frame.next += 1;
      const target = color.get(edge.target);
      if (target === 1) {
        back.add(edge.id);
      } else if (target === 0) {
        color.set(edge.target, 1);
        stack.push({ id: edge.target, next: 0 });
      }
    }
  }
  return back;
}

/**
 * Layer each node by its LONGEST path from an entry point. Longest, not
 * shortest, is what makes a diamond's two arms meet again in one column: the
 * node both arms lead to sits past the later of them, instead of a layer short
 * with an edge reaching forward over its neighbour.
 *
 * Back edges are excluded — they are what makes the graph cyclic, and layering
 * is defined only on an acyclic one. Removing every DFS back edge always leaves
 * a DAG, so the sweep below drains completely and no node is left unranked.
 */
function rankByTopology(
  orderedIds: readonly string[],
  edges: readonly WfEdge[],
  backEdgeIds: ReadonlySet<string>,
): Map<string, number> {
  const outgoing = new Map<string, WfEdge[]>();
  const indegree = new Map<string, number>(orderedIds.map((id) => [id, 0]));
  for (const e of edges) {
    if (backEdgeIds.has(e.id)) continue;
    const list = outgoing.get(e.source);
    if (list) list.push(e);
    else outgoing.set(e.source, [e]);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  const rank = new Map<string, number>(orderedIds.map((id) => [id, 0]));
  const queue = orderedIds.filter((id) => indegree.get(id) === 0);
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head];
    for (const e of outgoing.get(id) ?? []) {
      rank.set(e.target, Math.max(rank.get(e.target) ?? 0, (rank.get(id) ?? 0) + 1));
      const remaining = (indegree.get(e.target) ?? 0) - 1;
      indegree.set(e.target, remaining);
      if (remaining === 0) queue.push(e.target);
    }
  }
  return rank;
}

/** Build a positioned graph from a workflow YAML string. Never throws —
 *  malformed YAML or an empty definition returns an `error` the UI can fall
 *  back on (e.g. show the raw YAML while authoring). `reserveRunState` leaves
 *  room for the rows live run state adds (see {@link nodeHeight}); `direction`
 *  picks the flow axis (default "LR"); `compact` collapses nodes to icon tiles;
 *  `edges` replaces the inferred positional spine with a declared topology. */
export function buildWorkflowGraph(
  yaml: string,
  options?: BuildWorkflowGraphOptions,
): WfGraph {
  const reserveRunState = options?.reserveRunState ?? false;
  const direction = options?.direction ?? "LR";
  const compact = options?.compact ?? false;
  const declared = options?.edges;
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
  // `on:` is ONE trigger or a LIST of them (OR semantics — any one starts the
  // same body). Both shapes normalize to a list here so each entry becomes its
  // own node: read as a single node, a three-subscription workflow would draw
  // one unlabelled "Trigger" and hide two of the three ways it can start.
  const triggers: unknown[] = !def.on
    ? []
    : Array.isArray(def.on)
      ? def.on
      : [def.on];
  if (triggers.length === 0 && actions.length === 0) {
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
  const edgeIds = new Set<string>();
  const addEdge = (
    source: string,
    target: string,
    kind: WfEdgeKind,
    whenLabel?: string,
  ) => {
    const id = `${source}->${target}`;
    // One edge per ordered pair. A declared topology can name the same pair
    // twice (two `needs` rows that resolve to it), and two identical lines are
    // one line plus a duplicate React Flow key.
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({
      id,
      source,
      target,
      kind,
      ...(whenLabel ? { whenLabel } : {}),
    });
  };

  let rank = 0;
  // The node ids the NEXT spine node reconverges from: the current action, or —
  // once it fans out — each of its branch leaves, so a fan-out visibly rejoins
  // the spine instead of dead-ending. Positional wiring only; a declared
  // topology says what connects to what and never consults this.
  let prevExits: string[] = [];
  // Branch leaf ids, tracked explicitly so a reconvergence edge is classified as
  // a join by membership — not by string-matching the id format.
  const branchLeafIds = new Set<string>();
  const triggerIds = triggers.map((_, i) => triggerNodeId(i));

  triggers.forEach((trigger, i) => {
    // A trigger only shows a status (no metrics/output/progress), so it's spaced
    // by its static height — the node component skips its progress strip to match.
    addNode(triggerNodeId(i), describeTrigger(trigger), rank, false);
  });
  if (triggers.length > 0) {
    prevExits = [...triggerIds];
    rank += 1;
  }

  actions.forEach((action, i) => {
    const id = actionNodeId(i);
    const data = describeAction(action);
    // With no `on:` trigger, the first action IS the spine root, so it shows no
    // inbound handle (nothing points at it). Under a declared topology this is
    // recomputed below from what actually points at each node.
    if (i === 0 && triggers.length === 0) data.isRoot = true;
    addNode(id, data, rank, reserveRunState);
    if (!declared) {
      for (const from of prevExits) {
        // An edge arriving from a branch leaf is a join (reconvergence); from a
        // spine node or the trigger it's the spine itself.
        addEdge(from, id, branchLeafIds.has(from) ? "join" : "spine");
      }
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
        const cid = branchNodeId(i, j);
        addNode(cid, describeAction(child), branchRank, reserveRunState);
        // Fan-out survives a declared topology unchanged: a branch leaf is this
        // module's own node, derived from the structural action's config, and no
        // declared spec addresses it.
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

  if (declared) {
    const known = new Set(logical.map((n) => n.id));
    for (const spec of declared) {
      const missing = !known.has(spec.from)
        ? spec.from
        : !known.has(spec.to)
          ? spec.to
          : null;
      if (missing !== null) {
        return {
          nodes: [],
          edges: [],
          error: `Declared topology names "${missing}", which this definition has no step for`,
        };
      }
      addEdge(spec.from, spec.to, "spine", spec.whenLabel);
    }
    // Every trigger starts every ROOT. A node nothing points at is precisely
    // what "the workflow begins here" means, and OR-semantics triggers each
    // begin the whole body — so this is the model's edge to draw, not something
    // the caller should have to restate in a topology that describes only the
    // steps it owns.
    const rootward = new Set(edges.map((e) => e.target));
    for (const n of logical) {
      if (triggerNodeIndex(n.id) !== null) continue;
      if (rootward.has(n.id)) continue;
      for (const triggerId of triggerIds) addEdge(triggerId, n.id, "spine");
    }

    const orderedIds = logical.map((n) => n.id);
    const backEdgeIds = classifyBackEdges(orderedIds, edges);
    for (const e of edges) {
      if (backEdgeIds.has(e.id)) e.backEdge = true;
    }
    const rankById = rankByTopology(orderedIds, edges, backEdgeIds);
    // `isRoot` now means what it says — nothing points at this node — rather
    // than the positional stand-in for it, so a declared graph whose entry is
    // not the first `do` entry renders its handles correctly.
    const incoming = new Set(edges.map((e) => e.target));
    for (const n of logical) {
      n.rank = rankById.get(n.id) ?? 0;
      n.data = { ...n.data, isRoot: !incoming.has(n.id) };
    }
  }

  // A labelled edge needs a corridor it fits in — see EDGE_LABEL_LANE. Decided
  // here, after classification, because a back edge is only known by then and
  // it is one of the two things that puts a chip on the canvas.
  const labelled = edges.some(
    (e) => e.whenLabel !== undefined || e.backEdge === true,
  );
  const rankSep = labelled
    ? Math.max(geo.rankSep, EDGE_LABEL_LANE)
    : geo.rankSep;

  // A folded layout turns corners, and a guard chip sits ON the corridor a
  // straight run reserves for it — so a labelled graph keeps its single file.
  const folded =
    options?.wrap && direction === "LR" && !labelled
      ? layoutSerpentine(logical, edges, rankSep, geo.crossSep)
      : null;

  return {
    nodes: folded ?? layoutLayers(logical, direction, rankSep, geo.crossSep),
    edges,
    error: null,
  };
}
