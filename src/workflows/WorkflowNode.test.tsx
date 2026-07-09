// @vitest-environment jsdom
import type { Edge, Node, NodeProps } from "@xyflow/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { WfNodeData } from "./model";
import {
  buildStyledEdges,
  DensityContext,
  DirectionContext,
  WorkflowGraph,
  WorkflowNode,
} from "./WorkflowGraph";

afterEach(cleanup);

const BASE: WfNodeData = {
  title: "Run agent",
  kind: "agent.run",
  isRoot: false,
  tone: "action",
};

// WorkflowNode renders React Flow <Handle>s, which read the flow store from
// context — wrap it in a provider so it renders standalone.
function renderNode(data: WfNodeData) {
  return render(
    <ReactFlowProvider>
      <WorkflowNode {...({ data } as NodeProps<Node<WfNodeData>>)} />
    </ReactFlowProvider>,
  );
}

describe("buildStyledEdges", () => {
  const edge = (source: string, target: string): Edge => ({
    id: `${source}->${target}`,
    source,
    target,
    type: "smoothstep",
  });

  it("colors an edge by its target's status and animates only the running hop", () => {
    const [done, running, unreached] = buildStyledEdges(
      [edge("a", "b"), edge("b", "c"), edge("c", "d")],
      { b: { status: "succeeded" }, c: { status: "running" } },
    );
    expect(done.style?.stroke).toBe("#22c55e");
    expect(running.style?.stroke).toBe("hsl(var(--primary))");
    expect(running.animated).toBe(true);
    // An unreached (no-state) target is the muted neutral, animated off.
    expect(unreached.style?.stroke).toBe("hsl(var(--muted-foreground))");
    expect(unreached.animated).toBe(false);
  });

  it("renders every edge muted and non-animated in the static/preview path (no nodeState)", () => {
    // The definition/proposal-card preview passes no run state — all edges must
    // be the neutral muted token and static, never colored or animated.
    const edges = buildStyledEdges([edge("a", "b"), edge("b", "c")], undefined);
    expect(edges).toHaveLength(2);
    for (const e of edges) {
      expect(e.style?.stroke).toBe("hsl(var(--muted-foreground))");
      expect(e.animated).toBe(false);
    }
  });

  it("styles edges with RAW brand tokens, never a --color-* @theme alias", () => {
    // An inline `var(--color-*)` stroke resolves in this library's Storybook (its
    // @theme registers those aliases) but is UNDEFINED in a consumer that only
    // ships `tokens.css` (e.g. platform-web), where it silently computes to
    // `stroke: none` — the invisible unreached edges bug. Every edge/marker color
    // must therefore use a raw token or literal.
    const edges = buildStyledEdges(
      [edge("a", "b")],
      // exercise every status branch
      { a: { status: "queued" }, b: { status: "failed" } },
    );
    for (const s of [
      "queued",
      "running",
      "succeeded",
      "failed",
      undefined,
    ] as const) {
      const [e] = buildStyledEdges([edge("a", "b")], s ? { b: { status: s } } : {});
      const stroke = String(e.style?.stroke ?? "");
      const marker =
        typeof e.markerEnd === "object" ? String(e.markerEnd.color ?? "") : "";
      expect(stroke).not.toContain("var(--color-");
      expect(marker).not.toContain("var(--color-");
    }
    expect(edges[0].markerEnd).toBeTruthy();
  });
});

describe("WorkflowNode", () => {
  it("renders the live status, model, cost, duration, and output once a run state is present", () => {
    renderNode({
      ...BASE,
      state: {
        status: "running",
        model: "gpt-4o",
        costUsd: 0.0032,
        durationMs: 4200,
        outputPreview: "partial answer",
      },
    });
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText("gpt-4o")).toBeTruthy();
    expect(screen.getByText("$0.0032")).toBeTruthy();
    expect(screen.getByText("4.2s")).toBeTruthy();
    expect(screen.getByText("partial answer")).toBeTruthy();
  });

  it("surfaces the agent round count on the progress strip", () => {
    renderNode({
      ...BASE,
      subtitle: "Review the PR diff",
      state: { status: "running", model: "glm-5", rounds: 3, durationMs: 8200 },
    });
    // Rounds are an agent progress signal; the prompt subtitle is shown too.
    expect(screen.getByText("3 rounds")).toBeTruthy();
    expect(screen.getByText("Review the PR diff")).toBeTruthy();
  });

  it("renders the singular '1 round'", () => {
    renderNode({ ...BASE, state: { status: "running", rounds: 1 } });
    expect(screen.getByText("1 round")).toBeTruthy();
  });

  it("renders an explicit 'rounds: 0' rather than hiding it", () => {
    // A just-started agent reports 0 completed rounds — show it, don't drop it.
    renderNode({ ...BASE, state: { status: "running", rounds: 0 } });
    expect(screen.getByText("0 rounds")).toBeTruthy();
  });

  it("consumes DensityContext: renders the compact tile (a status dot, not the pill)", () => {
    // The compact layout shows a status DOT, not the "Running" text pill the
    // expanded card renders — a direct check that the node reads DensityContext.
    render(
      <ReactFlowProvider>
        <DensityContext.Provider value={true}>
          <WorkflowNode
            {...({
              data: { ...BASE, state: { status: "running", model: "m" } },
            } as NodeProps<Node<WfNodeData>>)}
          />
        </DensityContext.Provider>
      </ReactFlowProvider>,
    );
    expect(screen.queryByText("Running")).toBeNull();
    expect(screen.getByText("m")).toBeTruthy();
  });

  it("consumes DirectionContext: places handles top/bottom under TB", () => {
    const { container } = render(
      <ReactFlowProvider>
        <DirectionContext.Provider value="TB">
          <WorkflowNode {...({ data: BASE } as NodeProps<Node<WfNodeData>>)} />
        </DirectionContext.Provider>
      </ReactFlowProvider>,
    );
    // TB routes edges vertically: target handle on top, source on bottom.
    expect(container.querySelector(".react-flow__handle-top")).toBeTruthy();
    expect(container.querySelector(".react-flow__handle-bottom")).toBeTruthy();
    expect(container.querySelector(".react-flow__handle-left")).toBeNull();
  });
});

describe("WorkflowGraph density toggle", () => {
  const YAML = `on:
  schedule:
    cron: "0 0 * * *"
do:
  - notify:
      url: https://example.com
`;

  it("flips the density label when the toggle button is clicked", () => {
    render(<WorkflowGraph yaml={YAML} variant="full" />);
    // Expanded by default → the toggle offers "Compact".
    const toggle = screen.getByRole("button", { name: /compact/i });
    fireEvent.click(toggle);
    // After collapsing, the toggle offers "Expand".
    expect(screen.getByRole("button", { name: /expand/i })).toBeTruthy();
  });

  it("does not show a token chip for a non-agent node", () => {
    renderNode({
      ...BASE,
      title: "Notify",
      kind: "notify",
      state: { status: "succeeded", inputTokens: 100, outputTokens: 20, durationMs: 300 },
    });
    // Tokens are an agent.run concern only.
    expect(screen.queryByText("100/20 tok")).toBeNull();
  });

  it("renders a failed run's error preview", () => {
    renderNode({
      ...BASE,
      state: { status: "failed", error: "boom: provider 500" },
    });
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("boom: provider 500")).toBeTruthy();
  });

  it("renders a succeeded node's output preview (output is not running-only)", () => {
    renderNode({
      ...BASE,
      state: { status: "succeeded", outputPreview: "final answer" },
    });
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("final answer")).toBeTruthy();
  });

  it("clamps an over-long output preview before it reaches the DOM", () => {
    const long = "y".repeat(500);
    renderNode({ ...BASE, state: { status: "succeeded", outputPreview: long } });
    // The full payload is never rendered; only the bounded preview is.
    expect(screen.queryByText(long)).toBeNull();
    expect(screen.getByText(`${"y".repeat(200)}…`)).toBeTruthy();
  });

  it("renders no error element for a failed node with no error, and suppresses its output", () => {
    const { container } = renderNode({
      ...BASE,
      state: { status: "failed", outputPreview: "suppressed while failed" },
    });
    expect(screen.getByText("Failed")).toBeTruthy();
    // The red error <p> is only rendered when a failed node carries an error
    // (the failed status badge is a <span>, so scope the query to <p>).
    expect(container.querySelector("p.text-red-400")).toBeNull();
    // outputPreview is suppressed for a failed node (error channel only).
    expect(screen.queryByText("suppressed while failed")).toBeNull();
  });

  it("shows a trigger's status but no progress strip (a trigger only fires)", () => {
    // The trigger reserves no run-state rows, so it must NOT render the progress
    // strip — doing so would clip. Its status shows in the header pill instead.
    renderNode({
      title: "Schedule",
      kind: "schedule",
      tone: "trigger",
      isRoot: true,
      subtitle: "0 9 * * *",
      state: { status: "succeeded", durationMs: 3200 },
    });
    expect(screen.getByText("Done")).toBeTruthy();
    // Elapsed only ever appears in the progress strip; absent for a trigger.
    expect(screen.queryByText("3.2s")).toBeNull();
  });

  it("shows the static badge and no run status when there is no state", () => {
    renderNode({ ...BASE, badge: "×3", state: undefined });
    expect(screen.getByText("×3")).toBeTruthy();
    expect(screen.queryByText("Running")).toBeNull();
    expect(screen.queryByText("Done")).toBeNull();
  });
});
