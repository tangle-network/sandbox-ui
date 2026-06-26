/**
 * `@tangle-network/sandbox-ui/workflows` — workflow visualisation.
 *
 * Optional-peer contract: `buildWorkflowGraph` and importing this entry need NO
 * extra dependency. RENDERING the graph requires the `@xyflow/react` optional
 * peer to be installed — `WorkflowGraphLazy` defers its `import('@xyflow/react')`
 * (and the React Flow CSS) to render time, so the import stays cheap and the peer
 * is needed only if/when a graph is actually shown (e.g. wired as the assistant
 * proposal card's `renderGraph`). A host that renders the graph without the peer
 * installed gets a clear module-load error at that point, by design.
 */

export {
  type BuildWorkflowGraphOptions,
  buildWorkflowGraph,
  type WfEdge,
  type WfGraph,
  type WfNode,
  type WfNodeData,
  type WfNodeState,
  type WfNodeStatus,
  type WfNodeTone,
} from "./model";
// Only the LAZY wrapper is exported as a value: it defers the `@xyflow/react`
// import (and its CSS) to render time, so importing this entry — e.g. for the
// pure `buildWorkflowGraph` — never eagerly loads the optional peer. The eager
// WorkflowGraph component is reached only through the lazy wrapper's import().
export type { WorkflowGraphProps } from "./WorkflowGraph";
export { WorkflowGraph as WorkflowGraphLazy } from "./WorkflowGraphLazy";
