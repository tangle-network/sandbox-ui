import { Position, type Node } from "@xyflow/react";
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

  it("accepts a legacy positional nodeState map as the second argument", () => {
    // `buildFlowGraph(yaml, { a0: state })` (no option keys) is normalized to a
    // nodeState map, so an older positional caller keeps its run state.
    const state: WfNodeState = { status: "running", model: "glm-5" };
    const { nodes } = buildFlowGraph(YAML, { a0: state });
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(byId.a0.data.state).toEqual(state);
    expect(byId.trigger.data.state).toBeUndefined();
  });

  it("orients handles and advances along the y axis for the TB direction", () => {
    const { nodes } = buildFlowGraph(YAML, { direction: "TB" });
    // Handles enter the top and leave the bottom (the mirror of LR's left/right),
    // so React Flow routes edges vertically.
    expect(nodes.every((n) => n.sourcePosition === Position.Bottom)).toBe(true);
    expect(nodes.every((n) => n.targetPosition === Position.Top)).toBe(true);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    // The spine advances DOWN (main axis = y), the transpose of the LR default.
    expect(byId.a0.position.y).toBeGreaterThan(byId.trigger.position.y);
    expect(byId.a1.position.y).toBeGreaterThan(byId.a0.position.y);
    // Cross axis is x: a linear spine shares one vertical centerline.
    const centerX = (n: Node<WfNodeData>) => n.position.x + (n.width ?? 0) / 2;
    expect(centerX(byId.a0)).toBeCloseTo(centerX(byId.a1), 1);
  });

  it("collapses to a single fixed node size for compact density", () => {
    const expanded = buildFlowGraph(YAML, { nodeState: {} }); // run overlay reserved
    const compact = buildFlowGraph(YAML, { compact: true });
    // Every compact node is the same fixed size (uniform icon tiles)...
    expect(new Set(compact.nodes.map((n) => n.height)).size).toBe(1);
    expect(new Set(compact.nodes.map((n) => n.width)).size).toBe(1);
    // ...and shorter than the tallest expanded (run-reserved) node.
    const compactHeight = compact.nodes[0].height ?? 0;
    const tallestExpanded = Math.max(...expanded.nodes.map((n) => n.height ?? 0));
    expect(compactHeight).toBeLessThan(tallestExpanded);
  });

  it("pitches compact layers tighter than expanded ones, so the tiles don't drift apart", () => {
    // A compact node's BOX is wider than its tile (the name underneath is), so a
    // layer separator sized for the expanded cards would leave a canyon between
    // two tiles. Density owns its own pitch.
    const compact = buildFlowGraph(YAML, { compact: true });
    const expanded = buildFlowGraph(YAML);
    const gap = (nodes: Node<WfNodeData>[]) => {
      const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
      return byId.a0.position.x - (byId.trigger.position.x + (byId.trigger.width ?? 0));
    };
    expect(gap(compact.nodes)).toBeLessThan(gap(expanded.nodes));
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
      data: { title: "Run agent", kind: "agent.run", isRoot: false, tone: "action" },
    },
    {
      id: "a1",
      type: "wfNode",
      position: { x: 0, y: 200 },
      data: { title: "Integration", kind: "integration.invoke", isRoot: false, tone: "action" },
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

  it("re-renders a node when only its round count changes", () => {
    const withR2 = mergeRunState(baseNodes, baseById, {
      a0: { status: "running", rounds: 2 },
    });
    const withR3 = mergeRunState(withR2, baseById, {
      a0: { status: "running", rounds: 3 },
    });
    // The round bump produces a fresh node object carrying the new count.
    expect(withR3[0]).not.toBe(withR2[0]);
    expect(withR3[0].data.state?.rounds).toBe(3);
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

  it("treats a rounds-only change as different (the generic compare covers rounds)", () => {
    // A live tick that only advances the agent's round count must re-render — the
    // comparison is over every key, so `rounds` is not silently ignored.
    expect(
      sameRunState(
        { status: "running", rounds: 2 },
        { status: "running", rounds: 3 },
      ),
    ).toBe(false);
    expect(
      sameRunState({ status: "running" }, { status: "running", rounds: 1 }),
    ).toBe(false);
    expect(
      sameRunState(
        { status: "running", rounds: 2 },
        { status: "running", rounds: 2 },
      ),
    ).toBe(true);
  });
});
