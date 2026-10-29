/** Sandbox identity around the canonical Charts multi-agent topology. */
import { AgentGraph as ChartAgentGraph, type AgentGraphProps as ChartAgentGraphProps, type AgentGraphNode, type AgentGraphTool } from "@tangle-network/charts/react/agent-graph";
import { Bot, Wrench } from "lucide-react";
import { ModelBrandStack, modelBrandFor } from "../lib/model-brand";
import { ProviderIcon } from "../integrations/provider-logo";
import { KIND_ACCENT, NodeMark } from "./node-ui";

export interface AgentGraphProps extends ChartAgentGraphProps {}
export type { AgentGraphCall, AgentGraphCallKind, AgentGraphDirection, AgentGraphEvent, AgentGraphEdge, AgentGraphEdgeKind, AgentGraphNode, AgentGraphStatus, AgentGraphTool } from "@tangle-network/charts/react/agent-graph";

function agentMark(agent: AgentGraphNode, layout: "tree" | "hub", size: number) {
  if (layout === "tree") return <NodeMark kind="agent.run" model={agent.model ?? undefined} accent={KIND_ACCENT["agent.run"]} tile={size} />;
  const brand = agent.model ? modelBrandFor(agent.model) : null;
  return brand ? <span className="ag-model-mark"><ModelBrandStack identity={brand} size="sm" /></span> : <Bot size={16} aria-hidden />;
}
function toolMark(tool: AgentGraphTool | undefined, label: string, size: number) {
  return tool?.provider ? <ProviderIcon id={tool.provider} displayName={label} size={Math.round(size * .46)} className="ag-model-mark" /> : <Wrench size={size * .4} aria-hidden />;
}
export function AgentGraph(props: AgentGraphProps) {
  return <ChartAgentGraph renderAgentMark={agentMark} renderToolMark={toolMark} {...props} />;
}
