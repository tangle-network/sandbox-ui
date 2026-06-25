import { describe, expect, it } from "vitest";
import { buildFlowGraph } from "./flow-graph";
import type { WfNodeState } from "./model";

const YAML = `
on:
  schedule:
    cron: "0 0 * * *"
do:
  - agent.run:
      model: gpt-4
  - notify:
      url: https://example.com
`;

describe("buildFlowGraph", () => {
  it("builds wfNode nodes and smoothstep edges from YAML", () => {
    const { nodes, edges, error } = buildFlowGraph(YAML);
    expect(error).toBeNull();
    expect(nodes.map((n) => n.id)).toEqual(["trigger", "a0", "a1"]);
    expect(nodes.every((n) => n.type === "wfNode")).toBe(true);
    expect(edges.every((e) => e.type === "smoothstep")).toBe(true);
  });

  it("leaves every node static when no nodeState is given", () => {
    const { nodes } = buildFlowGraph(YAML);
    expect(nodes.every((n) => n.data.state === undefined)).toBe(true);
  });

  it("merges live state onto the matching node id and leaves the others static", () => {
    const state: WfNodeState = {
      status: "running",
      costUsd: 0.0032,
      durationMs: 4200,
      model: "gpt-4o",
      outputPreview: "partial answer",
    };
    const { nodes } = buildFlowGraph(YAML, { a0: state });
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    // The matching node carries the live state — this is both the render source
    // and the payload handed to onNodeClick(node.id, node.data).
    expect(byId.a0.data.state).toEqual(state);
    // Unchanged nodes stay static: no state is merged in.
    expect(byId.trigger.data.state).toBeUndefined();
    expect(byId.a1.data.state).toBeUndefined();
  });

  it("reports a parse error and no nodes for empty YAML", () => {
    const { nodes, error } = buildFlowGraph("");
    expect(error).toBeTruthy();
    expect(nodes).toHaveLength(0);
  });
});
