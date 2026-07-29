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
}

export type WfFlowEdge = Edge<WfFlowEdgeData>;

/** Edge type name for the custom renderer that draws guard chips and cycle
 *  badges. Used ONLY by edges that need one — everything else stays on the
 *  built-in `smoothstep`, so a graph without a declared topology renders
 *  exactly as it always has. */
export const WF_EDGE_TYPE = "wfEdge";

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
  /** Declared topology, replacing the inferred positional spine. Passed
   *  straight through to `buildWorkflowGraph` — see {@link WfEdgeSpec}. */
  edges?: readonly WfEdgeSpec[];
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
  // Every option key must be listed here. One that is missing makes an options
  // object fall through to the run-state test below, which it fails — so the
  // call silently loses ALL of its options rather than the one that was
  // forgotten. Adding an option to BuildFlowGraphOptions means adding it here.
  if (
    "nodeState" in arg ||
    "direction" in arg ||
    "compact" in arg ||
    "edges" in arg
  ) {
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
    ...(options.edges ? { edges: options.edges } : {}),
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
        // Fix the DOM box to the laid-out size so the card can't grow past its
        // reserved space and overlap a neighbour (see model.ts nodeHeight).
        style: { width: n.width, height: n.height },
        sourcePosition,
        targetPosition,
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
