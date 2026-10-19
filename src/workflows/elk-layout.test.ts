import { describe, expect, it } from "vitest";
import fixtures from "../stories/workflows/template-fixtures.json";
import { layoutWithElk, wantsElkLayout } from "./elk-layout";
import { buildFlowGraph, type FlowGraph } from "./flow-graph";
import { COMPACT_TILE, type WfEdgeSpec } from "./model";

/**
 * The ELK pass over the platform's real gallery templates, run through the
 * real `elkjs`. These are laws of the layout rather than pictures of it: a
 * template that breaks one is a graph a user cannot read.
 */

interface Fixture {
  yaml: string;
  edges: WfEdgeSpec[];
}
const TEMPLATES = fixtures as Record<string, Fixture>;

async function laidOut(id: string, aspect = 2.2): Promise<FlowGraph> {
  const t = TEMPLATES[id];
  const base = buildFlowGraph(t.yaml, { compact: true, wrap: true, edges: t.edges });
  expect(base.error).toBeNull();
  expect(wantsElkLayout(base)).toBe(true);
  const graph = await layoutWithElk(base, "LR", true, aspect);
  if (!graph) throw new Error(`ELK returned no layout for ${id}`);
  return graph;
}

function box(n: FlowGraph["nodes"][number]) {
  return {
    x0: n.position.x,
    y0: n.position.y,
    x1: n.position.x + (n.width ?? 0),
    y1: n.position.y + (n.height ?? 0),
  };
}

describe.each(Object.keys(TEMPLATES))("ELK layout of %s", (id) => {
  it("places every node without overlapping another", async () => {
    const graph = await laidOut(id);
    expect(graph.engine).toBe("elk");
    const boxes = graph.nodes.map(box);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        expect(overlap, `${graph.nodes[i].id} overlaps ${graph.nodes[j].id}`).toBe(false);
      }
    }
  });

  it("routes every drawn edge orthogonally from its source to its target", async () => {
    const graph = await laidOut(id);
    const byId = new Map(graph.nodes.map((n) => [n.id, box(n)]));
    for (const edge of graph.edges) {
      if (edge.hidden) continue;
      const route = edge.data?.route;
      expect(route, `${edge.id} has no route`).toBeDefined();
      const points = route!.points;
      for (let i = 1; i < points.length; i += 1) {
        const straight =
          Math.abs(points[i].x - points[i - 1].x) < 0.5 ||
          Math.abs(points[i].y - points[i - 1].y) < 0.5;
        expect(straight, `${edge.id} has a diagonal run`).toBe(true);
      }
      // Leaves its source's trailing side and enters its target's leading one.
      const from = byId.get(edge.source)!;
      const to = byId.get(edge.target)!;
      expect(points[0].x).toBeCloseTo(from.x1, 0);
      expect(points.at(-1)!.x).toBeCloseTo(to.x0, 0);
      // At the compact tile's handle height, which is where the renderer
      // snaps the ends: a route at any other height would leave a jog.
      expect(points[0].y).toBeCloseTo(from.y0 + COMPACT_TILE / 2, 0);
      expect(points.at(-1)!.y).toBeCloseTo(to.y0 + COMPACT_TILE / 2, 0);
    }
  });
});

describe("what the layout buys the catalogue", () => {
  it("wraps the software factory to its canvas instead of one strip", async () => {
    const graph = await laidOut("software-factory");
    const boxes = graph.nodes.map(box);
    const width = Math.max(...boxes.map((b) => b.x1)) - Math.min(...boxes.map((b) => b.x0));
    const height = Math.max(...boxes.map((b) => b.y1)) - Math.min(...boxes.map((b) => b.y0));
    // A single band measured 5.1:1 before wrapping; the panel is 2.2:1.
    expect(width / height).toBeLessThanOrEqual(3);
  });

  it("folds the factory's failure handler into one caption", async () => {
    const graph = await laidOut("software-factory");
    const failed = graph.nodes.find((n) => n.data.config?.join === "any_failed");
    expect(failed?.data.subtitle).toMatch(/^If any of \d+ steps fails$/);
    const inputs = graph.edges.filter((e) => e.target === failed?.id);
    expect(inputs.length).toBeGreaterThan(4);
    expect(inputs.every((e) => e.hidden)).toBe(true);
  });

  it("frames the PR review's four reviewer lanes as one parallel group", async () => {
    const graph = await laidOut("pr-review");
    expect(graph.groups).toHaveLength(1);
    expect(graph.groups![0]).toMatchObject({ lanes: 4, agents: 8 });
  });

  it("frames the factory's parallel review cell", async () => {
    const graph = await laidOut("software-factory");
    expect(graph.groups?.some((g) => g.lanes === 4)).toBe(true);
  });
});

describe("a failure handler with a step after it", () => {
  it("stays in the flow instead of being laid out ahead of the steps that can fail", async () => {
    const yaml = `on:
  webhook: {}
do:
  - id: build
    agent.run: { prompt: build }
  - id: review
    needs: [build]
    agent.run: { prompt: review }
  - id: other
    needs: [build]
    agent.run: { prompt: other }
  - id: failed
    join: any_failed
    needs: [build, review]
    notify: { url: "https://example.com/failed" }
  - id: tell
    needs: [failed]
    notify: { url: "https://example.com/tell" }
`;
    const edges: WfEdgeSpec[] = [
      { from: "a0", to: "a1" },
      { from: "a0", to: "a2" },
      { from: "a0", to: "a3" },
      { from: "a1", to: "a3" },
      { from: "a3", to: "a4" },
    ];
    const base = buildFlowGraph(yaml, { compact: true, edges });
    const graph = await layoutWithElk(base, "LR", true);
    if (!graph) throw new Error("no layout");
    const x = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    expect(graph.edges.some((e) => e.hidden)).toBe(false);
    expect(x("a4")).toBeGreaterThan(x("a3"));
    expect(x("a3")).toBeGreaterThan(x("a0"));
  });
});
