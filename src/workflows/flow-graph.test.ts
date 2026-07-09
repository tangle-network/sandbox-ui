import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { buildFlowGraph, mergeRunState, sameRunState } from "./flow-graph";
import type { WfNodeData, WfNodeState } from "./model";

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
    const { nodes } = buildFlowGraph(YAML, { nodeState: { a0: state } });
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

describe("mergeRunState", () => {
  // The structural nodes the run view starts from (definition-only data, no
  // state), as React Flow would hold them.
  const baseNodes: Node<WfNodeData>[] = [
    {
      id: "a0",
      type: "wfNode",
      position: { x: 0, y: 0 },
      data: { title: "Run agent", kind: "agent.run", hasBranches: false, isRoot: false, tone: "action" },
    },
    {
      id: "a1",
      type: "wfNode",
      position: { x: 0, y: 200 },
      data: { title: "Integration", kind: "integration.invoke", hasBranches: false, isRoot: false, tone: "action" },
    },
  ];
  const baseById = new Map(baseNodes.map((n) => [n.id, n.data]));

  it("merges state onto the matching node and preserves the others' identity", () => {
    const state: WfNodeState = { status: "running", model: "glm-5" };
    const next = mergeRunState(baseNodes, baseById, { a0: state });
    const byId = Object.fromEntries(next.map((n) => [n.id, n]));
    // The touched node gets a fresh object carrying the state — but keeps its
    // SAME position reference (so React Flow never re-measures/re-lays-it-out).
    expect(byId.a0.data.state).toEqual(state);
    expect(byId.a0.position).toBe(baseNodes[0].position);
    // The untouched node is returned AS-IS (same reference) → no re-render.
    expect(byId.a1).toBe(baseNodes[1]);
  });

  it("returns the SAME node references when the run state is unchanged", () => {
    const withState = mergeRunState(baseNodes, baseById, {
      a0: { status: "running" },
    });
    // A second tick carrying an equal-but-new state object must not churn nodes —
    // this is the invariant that stops the graph blanking on every poll/SSE tick.
    const again = mergeRunState(withState, baseById, {
      a0: { status: "running" },
    });
    expect(again[0]).toBe(withState[0]);
    expect(again[1]).toBe(withState[1]);
  });

  it("does not let state accumulate: clearing nodeState strips the node back to base", () => {
    const withState = mergeRunState(baseNodes, baseById, {
      a0: { status: "succeeded", outputPreview: "done" },
    });
    const cleared = mergeRunState(withState, baseById, {});
    // Base data is read from baseById, never the previous node, so the prior
    // state can't linger once the overlay drops it.
    expect(cleared[0].data.state).toBeUndefined();
    expect(cleared[0].data).toBe(baseById.get("a0"));
  });
});

describe("sameRunState", () => {
  it("treats deep-equal states as equal and any differing field as not", () => {
    expect(sameRunState(undefined, undefined)).toBe(true);
    expect(sameRunState({ status: "running" }, { status: "running" })).toBe(true);
    expect(sameRunState({ status: "running" }, { status: "succeeded" })).toBe(false);
    expect(sameRunState({ status: "running" }, undefined)).toBe(false);
    expect(
      sameRunState(
        { status: "running", outputPreview: "a" },
        { status: "running", outputPreview: "ab" },
      ),
    ).toBe(false);
  });

  it("compares over the union of keys, so an extra field is not equal", () => {
    // Guards the generic shallow-equal: one side carrying a field the other lacks
    // must read as changed (a hand-listed comparator that forgot the field wouldn't).
    expect(
      sameRunState({ status: "running" }, { status: "running", costUsd: 1 }),
    ).toBe(false);
    expect(
      sameRunState(
        { status: "succeeded", inputTokens: 10, outputTokens: 5 },
        { status: "succeeded", inputTokens: 10, outputTokens: 5 },
      ),
    ).toBe(true);
  });
});
