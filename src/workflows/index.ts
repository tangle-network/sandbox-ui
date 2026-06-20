/**
 * `@tangle-network/sandbox-ui/workflows` — workflow visualisation. The
 * node-graph view (`@xyflow/react`-backed, an optional peer) renders a workflow
 * YAML definition; use the lazy wrapper to keep the graph dependency out of the
 * initial bundle until a graph is actually shown (e.g. wired as the assistant
 * proposal card's `renderGraph`).
 */

export {
  buildWorkflowGraph,
  type WfEdge,
  type WfGraph,
  type WfNode,
  type WfNodeData,
  type WfNodeTone,
} from "./model";
export { WorkflowGraph, type WorkflowGraphProps } from "./WorkflowGraph";
export { WorkflowGraph as WorkflowGraphLazy } from "./WorkflowGraphLazy";
