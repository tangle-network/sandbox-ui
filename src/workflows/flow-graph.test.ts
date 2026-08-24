import { Position, type Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  buildFlowGraph,
  clearOfNodeBoxes,
  CLUSTER_HALF_SIZE,
  indexProblems,
  mergeRunState,
  sameRunState,
  WF_EDGE_TYPE,
  worstSeverity,
} from "./flow-graph";
import {
  actionNodeId,
  type WfNodeData,
  type WfNodeState,
  type WfProblemSeverity,
  wfEdgeId,
} from "./model";

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

  it("never reads an unrecognized option object as run state", () => {
    // The legacy positional form (`buildFlowGraph(yaml, { a0: state })`) is
    // recognized by what it CONTAINS. An object that is neither options nor run
    // states — a dropped option like `{ measure }`, a typo, a key from a newer
    // version — must be treated as NO options. Read as a run-state map instead, it
    // would make `nodeState` defined, which is the signal for "a run overlay is in
    // play": the graph would reserve run rows for a definition that has no run.
    const dropped = buildFlowGraph(YAML, {
      measure: () => ({ width: 1, height: 1 }),
    } as unknown as Record<string, WfNodeState>);
    const clean = buildFlowGraph(YAML);
    expect(dropped.nodes.map((n) => n.height)).toEqual(
      clean.nodes.map((n) => n.height),
    );
    expect(dropped.nodes.every((n) => n.data.state === undefined)).toBe(true);
  });

  it("still honors a bare run-state map (the legacy positional form)", () => {
    const { nodes } = buildFlowGraph(YAML, { a0: { status: "running" } });
    const a0 = nodes.find((n) => n.id === "a0");
    expect(a0?.data.state?.status).toBe("running");
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

describe("buildFlowGraph — declared topology", () => {
  const YAML_3 = `
on:
  webhook: {}
do:
  - agent.run:
      prompt: One
  - agent.run:
      prompt: Two
  - agent.run:
      prompt: Three
`;

  it("recognizes `edges` as an option instead of swallowing the whole call", () => {
    // The second argument is overloaded (options OR a bare run-state map), and
    // an option key missing from that check makes the object fail the run-state
    // test and fall through to `{}` — losing EVERY option, not just the new one.
    // So this asserts the topology actually took effect, not merely that the
    // call returned.
    const { edges } = buildFlowGraph(YAML_3, {
      edges: [{ from: actionNodeId(0), to: actionNodeId(2) }],
    });
    expect(edges.map((e) => e.id)).toContain("a0->a2");
    // The positional chain it replaced is gone.
    expect(edges.map((e) => e.id)).not.toContain("a1->a2");
  });

  it("routes only decorated edges through the custom renderer", () => {
    // The custom edge exists for guard chips and cycle badges. Every other edge
    // keeps the built-in `smoothstep`, so a graph with no declared topology
    // renders exactly as it always has.
    const { edges } = buildFlowGraph(YAML_3, {
      edges: [
        { from: actionNodeId(0), to: actionNodeId(1), whenLabel: "ok" },
        { from: actionNodeId(1), to: actionNodeId(2) },
        { from: actionNodeId(2), to: actionNodeId(1) },
      ],
    });
    const byId = new Map(edges.map((e) => [e.id, e]));
    expect(byId.get("a0->a1")?.type).toBe(WF_EDGE_TYPE); // guarded
    expect(byId.get("a2->a1")?.type).toBe(WF_EDGE_TYPE); // cycle
    expect(byId.get("a1->a2")?.type).toBe("smoothstep"); // plain
    expect(byId.get("a0->a1")?.data?.whenLabel).toBe("ok");
    expect(byId.get("a2->a1")?.data?.backEdge).toBe(true);
  });

  it("keeps every inferred-spine edge on the built-in renderer", () => {
    const { edges } = buildFlowGraph(YAML_3);
    expect(edges.every((e) => e.type === "smoothstep")).toBe(true);
    expect(edges.every((e) => e.data?.kind === "spine")).toBe(true);
  });
});

describe("buildFlowGraph — nodes are never canvas-deletable", () => {
  it("marks every node undeletable, in both densities and with a run overlay", () => {
    // A node is a `do` entry; removing one is a list edit, not a canvas gesture.
    // This is load-bearing on an EDITABLE canvas, where the delete key is armed
    // for edges: React Flow deletes a selected node together with every edge
    // touching it, so a deletable node would vanish from the canvas AND report
    // each of its edges through onEdgeDelete — asking the host to drop declared
    // edges nobody touched.
    for (const options of [
      undefined,
      { compact: true },
      { nodeState: { a0: { status: "running" as const } } },
    ]) {
      const { nodes } = buildFlowGraph(YAML, options);
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.every((n) => n.deletable === false)).toBe(true);
    }
  });
});

describe("authoring problems", () => {
  const nodeProblem = (node: string, severity: WfProblemSeverity, message: string) =>
    ({ anchor: "node", node, severity, message }) as const;
  const edgeProblem = (
    from: string,
    to: string,
    severity: WfProblemSeverity,
    message: string,
  ) => ({ anchor: "edge", from, to, severity, message }) as const;

  it("indexes by node id and by edge id, keeping every problem on one anchor", () => {
    const { byNode, byEdge } = indexProblems([
      nodeProblem("a0", "error", "model is required"),
      nodeProblem("a0", "warning", "no timeout set"),
      edgeProblem("a0", "a1", "error", "a1 cannot depend on a0"),
    ]);
    expect(byNode.get("a0")?.map((p) => p.message)).toEqual([
      "model is required",
      "no timeout set",
    ]);
    // The edge key is the id `buildWorkflowGraph` gives that pair — the coupling
    // that makes an anchor find its edge at all.
    expect(byEdge.get(wfEdgeId("a0", "a1"))).toHaveLength(1);
    expect(byEdge.get("a0->a1")).toHaveLength(1);
  });

  it("indexes an anchor the graph has no slot for rather than throwing", () => {
    // A draft is edited between the validation that produced a problem and the
    // graph drawn from it, so a stale anchor is normal traffic. It simply never
    // gets looked up.
    const { byNode } = indexProblems([nodeProblem("a9", "error", "gone")]);
    expect(byNode.get("a9")).toHaveLength(1);
    expect(byNode.get("a0")).toBeUndefined();
  });

  it("reads one error among warnings as an error", () => {
    expect(
      worstSeverity([
        nodeProblem("a0", "warning", "w"),
        nodeProblem("a0", "error", "e"),
      ]),
    ).toBe("error");
    expect(worstSeverity([nodeProblem("a0", "warning", "w")])).toBe("warning");
    expect(worstSeverity([])).toBeNull();
    expect(worstSeverity(undefined)).toBeNull();
  });
});

describe("reserveEdgeInsert", () => {
  /** The gap between the first two layers, which is what the insert control
   *  has to fit into. */
  const layerGap = (options: Parameters<typeof buildFlowGraph>[1]) => {
    const { nodes } = buildFlowGraph(YAML, options);
    const [first, second] = nodes;
    return second.position.x - (first.position.x + (first.width ?? 0));
  };

  it("widens the gap between layers so an insert control has room", () => {
    expect(layerGap({ compact: true })).toBeLessThan(44);
    expect(
      layerGap({ compact: true, reserveEdgeInsert: true }),
    ).toBeGreaterThanOrEqual(44);
  });
});

describe("clearOfNodeBoxes", () => {
  const CONTROL = CLUSTER_HALF_SIZE.control;
  const CHIP = CLUSTER_HALF_SIZE.chip;
  // A layer of two stacked cards, as the layouter pitches them: same x band,
  // separated on the cross axis.
  const upper = { x: 300, y: 100, width: 292, height: 80 };
  const lower = { x: 300, y: 200, width: 292, height: 80 };

  it("leaves a point that is already clear where it is", () => {
    // The common case: an adjacent-layer edge, whose midpoint sits in the
    // corridor the layout reserved for it.
    expect(clearOfNodeBoxes({ x: 250, y: 140 }, [upper, lower], "LR", CONTROL)).toBe(0);
  });

  it("moves a point off the card it landed inside, the short way", () => {
    // Nearer the box's top edge, so it leaves upwards.
    const up = clearOfNodeBoxes({ x: 400, y: 115 }, [upper], "LR", CONTROL);
    expect(up).toBeLessThan(0);
    expect(115 + up).toBeLessThan(upper.y);
    // Nearer the bottom edge, so it leaves downwards.
    const down = clearOfNodeBoxes({ x: 400, y: 170 }, [upper], "LR", CONTROL);
    expect(down).toBeGreaterThan(0);
    expect(170 + down).toBeGreaterThan(upper.y + upper.height);
  });

  it("escapes a STACK rather than stepping into the next card", () => {
    // Deep inside the upper card, with the lower one just below: walking down
    // must clear both, not stop between them where the second box begins.
    const offset = clearOfNodeBoxes({ x: 400, y: 175 }, [upper, lower], "LR", CONTROL);
    const landed = 175 + offset;
    for (const box of [upper, lower]) {
      const inside = landed >= box.y && landed <= box.y + box.height;
      expect(inside).toBe(false);
    }
  });

  it("ignores boxes the point never crosses on the flow axis", () => {
    // Same cross-axis band, a different layer: not in the way at all.
    expect(clearOfNodeBoxes({ x: 50, y: 140 }, [upper], "LR", CONTROL)).toBe(0);
  });

  it("clears along the other axis for a top-to-bottom flow", () => {
    const box = { x: 100, y: 300, width: 80, height: 292 };
    const offset = clearOfNodeBoxes({ x: 115, y: 400 }, [box], "TB", CONTROL);
    expect(offset).toBeLessThan(0);
    expect(115 + offset).toBeLessThan(box.x);
  });

  it("clears the control's whole footprint, not just its centre point", () => {
    // A centre a few units outside the card is NOT clear: the control is a 20px
    // square in flow units at every zoom, so half of it is still over the card.
    const justOutside = upper.y - 4;
    const offset = clearOfNodeBoxes({ x: 400, y: justOutside }, [upper], "LR", CONTROL);
    expect(offset).not.toBe(0);
    expect(justOutside + offset).toBeLessThan(upper.y - 12);
  });

  it("still leaves a control with real clearance alone", () => {
    // Far enough out that the whole control is off the card — no nudge, or the
    // control would drift away from its own edge for no reason.
    expect(clearOfNodeBoxes({ x: 400, y: upper.y - 40 }, [upper], "LR", CONTROL)).toBe(0);
  });

  it("clears a CHIP by its own width, which the control's size does not cover", () => {
    // A problem chip truncates at `max-w-40` — 160 units, eight times the
    // control — so a cluster carrying one laps over the cards either side of a
    // corridor the control would have fitted in. It takes the pointer, so over
    // a card it swallows that node's clicks.
    const corridorCentre = { x: upper.x - 22, y: upper.y + 20 };
    expect(clearOfNodeBoxes(corridorCentre, [upper], "LR", CONTROL)).toBe(0);
    expect(clearOfNodeBoxes(corridorCentre, [upper], "LR", CHIP)).not.toBe(0);
  });

  it("reads a chip's width as the CROSS extent in a top-to-bottom flow", () => {
    // Same chip, same card, rotated layout: the width that spanned the corridor
    // in "LR" is now the axis that has to clear the card.
    const tall = { x: 100, y: 300, width: 80, height: 292 };
    const beside = { x: tall.x - 30, y: 400 };
    expect(clearOfNodeBoxes(beside, [tall], "TB", CONTROL)).toBe(0);
    expect(clearOfNodeBoxes(beside, [tall], "TB", CHIP)).not.toBe(0);
  });

  /** A `parallel` fanning out this many ways stacks that many boxes in one
   *  layer, so the walk has to cope with a column far deeper than two. */
  const deepStack = (count: number, height: number) =>
    Array.from({ length: count }, (_, i) => ({
      x: 300,
      y: 100 + i * height,
      width: 292,
      height,
    }));

  it("escapes a deep layer when the way out is within reach", () => {
    const stack = deepStack(12, 24);
    const nearTheEdge = { x: 400, y: stack[1].y + 10 };
    const offset = clearOfNodeBoxes(nearTheEdge, stack, "LR", CONTROL);
    expect(offset).not.toBe(0);
    const landed = nearTheEdge.y + offset;
    for (const box of stack) {
      expect(landed >= box.y && landed <= box.y + box.height).toBe(false);
    }
  });

  it("keeps its place when a deep layer cannot be escaped inside the budget", () => {
    // Buried in the middle of a tall stack, every way out costs more than a
    // control may be moved. Giving up is the documented answer — a control
    // flung that far no longer reads as belonging to its edge, and the raised
    // label layer keeps an overlapping one clickable. This is the LIMIT that
    // decides such a case; the walk never runs long enough for a step count to
    // be what stops it.
    const stack = deepStack(40, 24);
    const buried = { x: 400, y: stack[20].y + 10 };
    expect(clearOfNodeBoxes(buried, stack, "LR", CONTROL)).toBe(0);
  });

  it("gives up rather than dragging a control far from its own edge", () => {
    // A box taller than the nudge budget either way: moving the control clear
    // would put it somewhere that no longer reads as belonging to this edge, so
    // it keeps its place and stays usable through the raised label layer.
    const wall = { x: 300, y: 0, width: 292, height: 600 };
    expect(clearOfNodeBoxes({ x: 400, y: 300 }, [wall], "LR", CONTROL)).toBe(0);
  });
});
