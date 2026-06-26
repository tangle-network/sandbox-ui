/**
 * React Flow node/edge construction for the workflow graph. Kept separate from
 * the React-Flow-agnostic parsing in `model.ts` and from the component itself so
 * the live `nodeState` merge — the load-bearing wiring of the run view — is pure
 * and unit-testable without rendering React Flow.
 */

import type { Edge, Node } from "@xyflow/react";
import {
  buildWorkflowGraph,
  type WfNodeData,
  type WfNodeState,
} from "./model";

export interface FlowGraph {
  nodes: Node<WfNodeData>[];
  edges: Edge[];
  /** Set when the YAML couldn't be parsed into a renderable graph. */
  error: string | null;
}

/**
 * Build the React Flow nodes/edges from workflow YAML, merging any live
 * `nodeState` (keyed by node id) onto the matching node's data so the node
 * component renders status/cost/output without a separate channel. A node with
 * no entry in `nodeState` keeps its static data object unchanged (same
 * reference), so the static-definition preview path is untouched.
 */
export function buildFlowGraph(
  yaml: string,
  nodeState?: Record<string, WfNodeState>,
): FlowGraph {
  // A run overlay is in play whenever `nodeState` is supplied (even an empty map,
  // as the detail page passes before the first run) — reserve the spine spacing a
  // running node needs. The static proposal preview passes nothing and stays
  // compact.
  const graph = buildWorkflowGraph(yaml, {
    reserveRunState: nodeState !== undefined,
  });
  return {
    error: graph.error,
    nodes: graph.nodes.map(
      (n): Node<WfNodeData> => ({
        id: n.id,
        type: "wfNode",
        position: n.position,
        data: nodeState?.[n.id]
          ? { ...n.data, state: nodeState[n.id] }
          : n.data,
      }),
    ),
    edges: graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      type: "smoothstep",
    })),
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
