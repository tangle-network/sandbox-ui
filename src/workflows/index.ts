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
// Only the LAZY wrapper is exported as a value: it defers the `@xyflow/react`
// import (and its CSS) to render time, so importing this entry — e.g. for the
// pure `buildWorkflowGraph` — never eagerly loads the optional peer. The eager
// WorkflowGraph component is reached only through the lazy wrapper's import().
export type { WorkflowGraphProps } from "./WorkflowGraph";
export { WorkflowGraph as WorkflowGraphLazy } from "./WorkflowGraphLazy";
