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
  actionNodeId,
  branchNodeId,
  type BuildWorkflowGraphOptions,
  buildWorkflowGraph,
  TRIGGER_NODE_ID,
  triggerNodeId,
  triggerNodeIndex,
  type WfEdge,
  type WfEdgeKind,
  type WfEdgeSpec,
  type WfGraph,
  type WfNode,
  type WfNodeData,
  type WfNodeState,
  type WfNodeStatus,
  type WfNodeTone,
  type WfProblem,
  type WfProblemSeverity,
} from "./model";
// Only the LAZY wrapper is exported as a value: it defers the `@xyflow/react`
// import (and its CSS) to render time, so importing this entry — e.g. for the
// pure `buildWorkflowGraph` — never eagerly loads the optional peer. The eager
// WorkflowGraph component is reached only through the lazy wrapper's import().
export type { WorkflowGraphProps } from "./WorkflowGraph";
export { WorkflowGraph as WorkflowGraphLazy } from "./WorkflowGraphLazy";

// The brand mark of the model a node ran on. The graph's own node cards resolve and
// render these (node-ui.tsx), so a host labelling a node OUTSIDE the canvas — a side
// panel, a run row — reaches for the same two symbols. Exported here so it can have
// them without importing the dashboard entry, which drags the whole widget
// surface in behind them.
export {
  type ModelBrandIdentity,
  ModelBrandStack,
  modelBrandFor,
} from "../lib/model-brand";

// The node's visual atoms, for a host that draws a run OUTSIDE the canvas — a
// run page's pipeline strip, its step headers — and must read as the same system
// as the graph: one glyph per kind, one colour and one word per status.
// `StatusPill` is exported as `NodeStatusPill` because the root entry already
// exports the generic `StatusPill` primitive under that name.
export {
  KIND_ICON,
  NodeMark,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_PILL,
  STATUS_TONE,
  StatusPill as NodeStatusPill,
} from "./node-ui";
// The naming rules the graph labels nodes with, so a host titles a step the way
// the graph does: `github.pulls.reviews.create` reads as "Create pull request
// review", not as the identifier.
export {
  type ActionPathParts,
  actionPathLabel,
  humanizeIdentifier,
  type LeadCase,
  parseActionPath,
  shortModel,
} from "./naming";
// The node's output classifier and body: a shallow JSON object as key/value rows,
// text as a condensed preview. A host rendering a step's result falls back to the
// same reading the canvas gives it.
export {
  classifyOutput,
  condenseText,
  NodeOutputBody,
  type OutputShape,
} from "./node-output";
