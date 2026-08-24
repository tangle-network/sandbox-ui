/**
 * React Flow node/edge construction for the workflow graph. Kept separate from
 * the React-Flow-agnostic parsing in `model.ts` and from the component itself so
 * the live `nodeState` merge — the load-bearing wiring of the run view — is pure
 * and unit-testable without rendering React Flow.
 */

import { Position, type Edge, type Node } from "@xyflow/react";
import {
  buildWorkflowGraph,
  type WfDirection,
  type WfEdgeKind,
  type WfEdgeSpec,
  type WfNodeData,
  type WfNodeState,
  type WfProblem,
  type WfSide,
  wfEdgeId,
  worstSeverity,
} from "./model";

/**
 * What an edge carries beyond its endpoints. Only a DECLARED topology produces
 * either extra: a positional spine has no guards and cannot loop, so its edges
 * keep the plain built-in renderer and this data is inert on them.
 */
export interface WfFlowEdgeData extends Record<string, unknown> {
  kind: WfEdgeKind;
  /** Already-human guard summary, placed verbatim (see {@link WfEdgeSpec}). */
  whenLabel?: string;
  /** This edge closes a cycle. */
  backEdge?: boolean;
  /** Per-node visit budget, rendered beside a back edge so the loop states its
   *  own bound. Merged in at style time by the component that knows it. */
  maxNodeVisits?: number;
  /** The AUTHORING problems anchored to this edge, already written for a reader.
   *  Folded on by the styling pass; absent on a run graph. */
  problems?: readonly WfProblem[];
  /** This edge offers the "insert a step here" control at its midpoint. */
  insertable?: boolean;
}

export type WfFlowEdge = Edge<WfFlowEdgeData>;

/** Edge type name for the custom renderer that draws guard chips and cycle
 *  badges. Used ONLY by edges that need one — everything else stays on the
 *  built-in `smoothstep`, so a graph without a declared topology renders
 *  exactly as it always has. */
export const WF_EDGE_TYPE = "wfEdge";

/** The layouter's compass sides in React Flow's terms — the one place the
 *  RF-agnostic layout vocabulary is translated. */
const SIDE_POSITION: Record<WfSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

export interface FlowGraph {
  nodes: Node<WfNodeData>[];
  edges: WfFlowEdge[];
  /** Set when the YAML couldn't be parsed into a renderable graph. */
  error: string | null;
}

/** Options for {@link buildFlowGraph}. */
export interface BuildFlowGraphOptions {
  /**
   * Live per-node run state (keyed by node id) merged onto the matching node's
   * data. Its mere presence — even an empty map, as the detail page passes before
   * the first run — also reserves run-state spacing so a node that later runs
   * never has to reflow. The static proposal preview passes nothing and stays
   * compact.
   */
  nodeState?: Record<string, WfNodeState>;
  /** Flow direction. Defaults to "LR". */
  direction?: WfDirection;
  /** Collapse nodes to the icon-tile density (logo + name). Defaults to `false`
   *  (the full, expanded card). */
  compact?: boolean;
  /** Fold a long single-file pipeline into rows rather than one unbounded line.
   *  Passed straight through to `buildWorkflowGraph`. Defaults to `false`. */
  wrap?: boolean;
  /** Declared topology, replacing the inferred positional spine. Passed
   *  straight through to `buildWorkflowGraph` — see {@link WfEdgeSpec}. */
  edges?: readonly WfEdgeSpec[];
  /** Reserve the layer gap an edge's insert control needs. Passed straight
   *  through to `buildWorkflowGraph`. */
  reserveEdgeInsert?: boolean;
}

/** A bare run-state map (`buildFlowGraph(yaml, { a0: { status: "running" } })`),
 *  recognized by what it CONTAINS: every value is a run state, i.e. an object with
 *  a `status`. */
function isNodeStateMap(arg: object): arg is Record<string, WfNodeState> {
  const values = Object.values(arg);
  return (
    values.length > 0 &&
    values.every(
      (v) => v !== null && typeof v === "object" && "status" in (v as object),
    )
  );
}

/**
 * Every key {@link BuildFlowGraphOptions} declares. An options object is
 * recognized by carrying one of them, so a key missing here makes the whole
 * object fall through to the run-state test below — which it fails, silently
 * losing ALL of its options rather than the one that was forgotten.
 *
 * The completeness assertion under it turns that into a BUILD error: adding an
 * option without adding it here stops compiling, rather than shipping a graph
 * that quietly ignores the caller. Written as a tuple whose membership the
 * option keys must be assignable to.
 */
const FLOW_GRAPH_OPTION_KEYS = [
  "nodeState",
  "direction",
  "compact",
  "wrap",
  "edges",
  "reserveEdgeInsert",
] as const;

type ListedOptionKey = (typeof FLOW_GRAPH_OPTION_KEYS)[number];
// `never` — and so a type error on the assignment — the moment an option key is
// not in the list above.
const _everyOptionKeyIsListed: keyof BuildFlowGraphOptions extends ListedOptionKey
  ? true
  : never = true;
void _everyOptionKeyIsListed;

/**
 * Accept either an options object or a bare `nodeState` map as the second arg, so
 * an older positional caller keeps working instead of silently losing its run
 * state.
 *
 * Both branches are POSITIVE tests — known option keys, or values that are run
 * states. Nothing falls through to "must be a node-state map", because that is how
 * an argument the graph doesn't understand (a dropped option, a typo, a key from a
 * newer version) gets read as run state: `nodeState` would then be defined, which
 * is the signal for "a run overlay is in play", and the graph would silently
 * reserve run rows for a definition that has no run at all. An unrecognized shape
 * is no options, not imaginary run state.
 */
function normalizeFlowGraphOptions(
  arg: BuildFlowGraphOptions | Record<string, WfNodeState> | undefined,
): BuildFlowGraphOptions {
  if (!arg) return {};
  if (FLOW_GRAPH_OPTION_KEYS.some((key) => key in arg)) {
    return arg as BuildFlowGraphOptions;
  }
  return isNodeStateMap(arg) ? { nodeState: arg } : {};
}

/**
 * Build the React Flow nodes/edges from workflow YAML, merging any live
 * `nodeState` (keyed by node id) onto the matching node's data so the node
 * component renders status/cost/output without a separate channel. A node with
 * no entry in `nodeState` keeps its static data object unchanged (same
 * reference), so the static-definition preview path is untouched. Each node
 * carries its authoritative size and orientation-driven handle sides so the
 * card renders at exactly the laid-out box and edges enter/leave the right edge.
 */
export function buildFlowGraph(
  yaml: string,
  optionsOrNodeState?: BuildFlowGraphOptions | Record<string, WfNodeState>,
): FlowGraph {
  const options = normalizeFlowGraphOptions(optionsOrNodeState);
  const nodeState = options.nodeState;
  const direction = options.direction ?? "LR";
  const compact = options.compact ?? false;
  const graph = buildWorkflowGraph(yaml, {
    reserveRunState: nodeState !== undefined,
    direction,
    compact,
    ...(options.wrap ? { wrap: true } : {}),
    ...(options.edges ? { edges: options.edges } : {}),
    ...(options.reserveEdgeInsert ? { reserveEdgeInsert: true } : {}),
  });
  const isLR = direction === "LR";
  const sourcePosition = isLR ? Position.Right : Position.Bottom;
  const targetPosition = isLR ? Position.Left : Position.Top;
  return {
    error: graph.error,
    nodes: graph.nodes.map(
      (n): Node<WfNodeData> => ({
        id: n.id,
        type: "wfNode",
        position: n.position,
        width: n.width,
        height: n.height,
        // A node is a `do` entry, and removing one is a list edit — never a
        // canvas gesture. This matters most on an EDITABLE canvas, where the
        // delete key is armed for edges: React Flow deletes a selected node
        // together with every edge touching it, so a node left deletable would
        // vanish from the canvas AND report each of its edges as removed,
        // asking the host to drop declared edges nobody touched.
        deletable: false,
        // Fix the DOM box to the laid-out size so the card can't grow past its
        // reserved space and overlap a neighbour (see model.ts nodeHeight).
        style: { width: n.width, height: n.height },
        // A folded layout names each node's own sides (a mirrored row, a corner
        // that leaves downward); a straight one names none and takes the
        // direction's answer for every node.
        sourcePosition: n.sourceSide ? SIDE_POSITION[n.sourceSide] : sourcePosition,
        targetPosition: n.targetSide ? SIDE_POSITION[n.targetSide] : targetPosition,
        data: nodeState?.[n.id]
          ? { ...n.data, state: nodeState[n.id] }
          : n.data,
      }),
    ),
    edges: graph.edges.map((e): WfFlowEdge => {
      // A guard chip or a cycle badge needs the custom renderer; nothing else
      // does, so nothing else pays for it. Both are declared-topology-only, so
      // an inferred spine keeps the built-in edge it has always used.
      const decorated = e.whenLabel !== undefined || e.backEdge === true;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: decorated ? WF_EDGE_TYPE : "smoothstep",
        data: {
          kind: e.kind,
          ...(e.whenLabel !== undefined ? { whenLabel: e.whenLabel } : {}),
          ...(e.backEdge === true ? { backEdge: true } : {}),
        },
      };
    }),
  };
}

/** Shallow-equal two run states, so an unchanged node can be skipped on a tick.
 *  Compares over the union of keys rather than a hand-listed field set, so a new
 *  WfNodeState field can't be silently ignored here (which would leave a node
 *  stale when only that field changed). WfNodeState is a flat record of
 *  primitives, so a shallow compare is exact. */
export function sameRunState(a?: WfNodeState, b?: WfNodeState): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a) as (keyof WfNodeState)[];
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

/**
 * Merge live `nodeState` onto an EXISTING React Flow node list, returning a new
 * list that updates only each node's `data` and preserves its identity (object
 * reference), position, and React-Flow-measured size. The static structure comes
 * from `baseDataById` (the definition-only node data, keyed by id), NOT from the
 * previous node, so `state` never accumulates across ticks. A node whose state is
 * unchanged is returned AS-IS (same reference) so React Flow doesn't re-render or
 * re-measure it — this is what keeps a poll/SSE tick from blanking the canvas.
 */
export function mergeRunState(
  prev: Node<WfNodeData>[],
  baseDataById: Map<string, WfNodeData>,
  nodeState: Record<string, WfNodeState> | undefined,
): Node<WfNodeData>[] {
  return prev.map((n) => {
    const base = baseDataById.get(n.id) ?? n.data;
    const s = nodeState?.[n.id];
    const nextData = s ? { ...base, state: s } : base;
    // Skip (return the same node) when the state is unchanged. `sameRunState`
    // covers both paths: a fresh `nextData` whose state equals the prior one, and
    // a node already at base whose state is `undefined` either side.
    return sameRunState(n.data.state, nextData.state)
      ? n
      : { ...n, data: nextData };
  });
}

/**
 * The authoring problems a graph was handed, indexed by what they are anchored
 * to. Built once per problem list rather than scanned per node/edge, and built
 * even for an anchor the graph has no slot for — a draft the author is still
 * typing legitimately produces a problem naming a step that has just been
 * renamed away, and the lookup simply never asks for it.
 */
export interface ProblemIndex {
  byNode: ReadonlyMap<string, readonly WfProblem[]>;
  byEdge: ReadonlyMap<string, readonly WfProblem[]>;
}

/** Group problems by node id and by edge id (see {@link wfEdgeId}). */
export function indexProblems(
  problems: readonly WfProblem[] | undefined,
): ProblemIndex {
  const byNode = new Map<string, WfProblem[]>();
  const byEdge = new Map<string, WfProblem[]>();
  for (const problem of problems ?? []) {
    const [into, key] =
      problem.anchor === "node"
        ? ([byNode, problem.node] as const)
        : ([byEdge, wfEdgeId(problem.from, problem.to)] as const);
    const at = into.get(key);
    if (at) at.push(problem);
    else into.set(key, [problem]);
  }
  return { byNode, byEdge };
}

/** A laid-out node's box in flow coordinates. */
export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far past a node's edge a cluster's own EDGE must sit to clear the card. */
const INSERT_CLEARANCE = 8;

/**
 * Half the box a cluster occupies, in flow units, by what it carries.
 *
 * The label layer lives inside the zoomed viewport, so a 20px control is 20
 * units at every zoom and these numbers hold at any scale. They are bounds
 * rather than measurements: the control is a fixed 20px square, and the chip
 * TRUNCATES at Tailwind's `max-w-40`, so 160 is the widest it can ever render.
 * Nothing here has to be measured, which is what keeps the placement
 * collision-free by construction rather than by a measure-then-reflow pass.
 *
 * Both axes are given because the cluster is not square and the flow direction
 * decides which of them is the cross axis: a chip is wide and short, so in "LR"
 * its width spans the corridor while in "TB" that same width is what has to
 * clear the cards.
 */
export const CLUSTER_HALF_SIZE = {
  /** The insert control alone: a 20-unit square. */
  control: { width: 10, height: 10 },
  /**
   * A problem chip — and, since the two stack in one column, the chip WITH the
   * control under it, which is the taller of the two and so the one the bound
   * has to cover. Measured on the rendered page at 160 x 38.5 flow units (the
   * chip's `max-w-40` cap, over chip + gap + control), and rounded outward: a
   * bound that understates is a bound that lets the cluster lap over a card.
   */
  chip: { width: 80, height: 20 },
} as const;

/** Half a cluster's extent along each axis. */
export interface ClusterHalfSize {
  width: number;
  height: number;
}
/**
 * How many cards a cluster may step past before the nudge is abandoned.
 *
 * A BOX COUNT rather than a distance, because what has to be cleared scales with
 * the layout: a node is 292 units across, so in "TB" — where that width is the
 * cross axis — moving a control off the card it sits on costs over 160, while
 * the same node in "LR" costs about 50. Any fixed distance is therefore either
 * too small to clear one standard card in one orientation, or too loose to mean
 * anything in the other. Counting cards says what was actually meant: clearing
 * the card you are on is the whole point, the next one is its neighbour in a
 * stacked layer and is cheap, and past that the cluster is crossing a dense
 * fan-out and would end up nowhere near the edge it belongs to — where leaving
 * it overlapping, still clickable through the raised label layer, is the better
 * of two bad answers.
 */
const INSERT_MAX_CARDS_CROSSED = 2;

/**
 * The CROSS-axis shift that moves a point off whatever node boxes it lands in,
 * or 0 when it is already clear (or cannot be cleared within the bound).
 *
 * An edge spanning more than one layer runs THROUGH the layer it skips, so its
 * midpoint — where a control would otherwise sit — is inside an unrelated card.
 * The reserved corridor only ever clears an adjacent-layer edge, because that is
 * the only gap the layout can widen. Nudging along the cross axis keeps the
 * control beside its own edge and off the card it was covering.
 *
 * Both directions are walked, so a stack of cards in the skipped layer is
 * escaped rather than jumped into; the smaller shift wins, and a point that
 * cannot be cleared inside {@link INSERT_MAX_CARDS_CROSSED} keeps its place, and
 * says so by answering null rather than an offset.
 */
export function clearOfNodeBoxes(
  point: { x: number; y: number },
  boxes: readonly NodeBox[],
  direction: WfDirection,
  half: ClusterHalfSize,
): number | null {
  const isLR = direction === "LR";
  const base = isLR ? point.y : point.x;
  const main = isLR ? point.x : point.y;
  // The cluster's own half-extent ALONG each axis, which is what turns "is this
  // point inside a card" into "does any of this cluster lap over one".
  const padMain = isLR ? half.width : half.height;
  const padCross = isLR ? half.height : half.width;
  // Only the boxes the point could ever be inside — those it already overlaps on
  // the axis the flow advances along. Inflated, like the cross-axis test below,
  // so a control whose centre sits beside a card but whose body laps over it is
  // still treated as covered.
  const column = boxes.filter((b) => {
    const lo = (isLR ? b.x : b.y) - padMain;
    const size = (isLR ? b.width : b.height) + padMain * 2;
    return main >= lo && main <= lo + size;
  });
  if (column.length === 0) return 0;

  const walk = (sign: 1 | -1): number | null => {
    let at = base;
    // One iteration per card it may cross, plus the step that finds nothing left
    // to cross. Each step clears the box it hit and cannot return to it, so the
    // walk always terminates well inside this.
    for (let crossed = 0; crossed <= INSERT_MAX_CARDS_CROSSED; crossed += 1) {
      const hit = column.find((b) => {
        const lo = (isLR ? b.y : b.x) - padCross;
        const size = (isLR ? b.height : b.width) + padCross * 2;
        return at >= lo && at <= lo + size;
      });
      if (!hit) return at - base;
      if (crossed === INSERT_MAX_CARDS_CROSSED) return null;
      const lo = isLR ? hit.y : hit.x;
      const size = isLR ? hit.height : hit.width;
      at =
        sign > 0
          ? lo + size + padCross + INSERT_CLEARANCE
          : lo - padCross - INSERT_CLEARANCE;
    }
    return null;
  };

  const up = walk(-1);
  const down = walk(1);
  // Null, not zero. Zero means "already clear"; a caller has to be able to tell
  // that from "still on a card, and I could not move it off" — because a cluster
  // that stays on a card must at least stop taking that card's clicks.
  if (up === null && down === null) return null;
  if (up === null) return down;
  if (down === null) return up;
  return Math.abs(up) <= Math.abs(down) ? up : down;
}
