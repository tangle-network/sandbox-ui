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
  const graph = buildWorkflowGraph(yaml);
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
