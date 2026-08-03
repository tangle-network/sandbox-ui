// @vitest-environment jsdom
import type { Node, NodeProps } from "@xyflow/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  buildWorkflowGraph,
  COMPACT_TILE,
  ACTION_OUTPUT_ROWS,
  type WfNodeData,
  type WfNodeState,
} from "./model";
import type { WfFlowEdge } from "./flow-graph";
import { classifyOutput, NodeOutputBody } from "./node-output";
import {
  buildStyledEdges,
  ConnectableContext,
  DensityContext,
  DirectionContext,
  fitZoomCeiling,
  isEditableEdge,
  SelectedNodeContext,
  WorkflowGraph,
  WorkflowNode,
} from "./WorkflowGraph";

afterEach(cleanup);

const BASE: WfNodeData = {
  title: "AI Agent",
  kind: "agent.run",
  isRoot: false,
  tone: "action",
};

/** A non-agent action. An agent's card renders its answer as the card BODY —
 *  no caption, no frame — so the framed output WELL, and everything about how it
 *  clamps and labels itself, belongs to these kinds now. */
const ACTION: WfNodeData = {
  title: "Notify",
  kind: "notify",
  subtitle: "example.com",
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

describe("fitZoomCeiling", () => {
  it("lets a compact fit zoom past 1, and holds full cards at their size", () => {
    // Compact tiles are small by design — fitting them into the canvas
    // legitimately zooms in; full cards at 1 are already their designed size.
    // (How the reframe itself runs — the tween, and the reduced-motion instant
    // path — is covered in WorkflowGraphFitView.test.tsx.)
    expect(fitZoomCeiling(true)).toBeGreaterThan(1);
    expect(fitZoomCeiling(false)).toBe(1);
  });
});

/** The brand mark inside a node's tile. Queried off the DOM rather than by its
 *  accessible name: the tile is `aria-hidden` (the mark is decorative — see the test
 *  below), and `getByLabelText` does NOT prune an aria-hidden subtree, so a name-based
 *  query would assert something a screen reader never receives. */
function brandMark(container: HTMLElement, label: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[aria-label="${label}"]`)
}

describe("buildStyledEdges", () => {
  // Shaped as `buildFlowGraph` emits an inferred-spine edge: the built-in
  // renderer, and edge data carrying its kind.
  const edge = (source: string, target: string): WfFlowEdge => ({
    id: `${source}->${target}`,
    source,
    target,
    type: "smoothstep",
    data: { kind: "spine" },
  });

  it("colors an edge by its target's status and animates only the running hop", () => {
    const [done, running, unreached] = buildStyledEdges(
      [edge("a", "b"), edge("b", "c"), edge("c", "d")],
      { b: { status: "succeeded" }, c: { status: "running" } },
    );
    expect(done.style?.stroke).toBe("var(--surface-success-text)");
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
    // must therefore use a raw token.
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
  it("renders a parked decision as blocked on the viewer, not as in-flight", () => {
    // Without a `waiting` status a host had to map the parked run onto `running`,
    // so the step the run was STUCK on rendered as the live one — pulsing bar,
    // primary accent, "Running" pill — while it went nowhere without the viewer.
    renderNode({
      title: "Ship the release?",
      kind: "decision",
      subtitle: "approve / reject",
      isRoot: false,
      tone: "structural",
      state: { status: "waiting" },
    });
    expect(screen.getByText("Waiting on you")).toBeTruthy();
    expect(screen.queryByText("Running")).toBeNull();
    // The question and its options are both on the card.
    expect(screen.getByText("Ship the release?")).toBeTruthy();
    expect(screen.getByText("approve / reject")).toBeTruthy();
    // The bar sits where the run stopped and does NOT move — a moving bar would
    // say the workflow is working.
    const bar = screen.getByTestId("wf-node-progress");
    expect(bar.style.width).toBe("58%");
    expect(bar.className).not.toContain("animate-pulse");
  });

  it("animates the progress bar only for a running node", () => {
    // The counterpart: the ONE status that means "work is happening right now" is
    // the only one that moves.
    const { unmount } = renderNode({ ...BASE, state: { status: "running" } });
    expect(screen.getByTestId("wf-node-progress").className).toContain(
      "animate-pulse",
    );
    unmount();
    renderNode({ ...BASE, state: { status: "succeeded" } });
    expect(screen.getByTestId("wf-node-progress").className).not.toContain(
      "animate-pulse",
    );
  });

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
    // The live model names the step (it supersedes the requested one)…
    expect(screen.getByText("gpt-4o")).toBeTruthy();
    // …and the run's numbers read as ONE line, not a row of boxes.
    expect(screen.getByText("$0.0032")).toBeTruthy();
    expect(screen.getByText("4.2s")).toBeTruthy();
    expect(screen.getByText("partial answer")).toBeTruthy();
  });

  it("shows the model a run ACTUALLY used, shortened like the requested one", () => {
    // A fan-out branch / fallback can run a different model than the definition
    // asked for — and it must not grow a vendor prefix the definition's didn't.
    renderNode({
      ...BASE,
      subtitle: "claude-sonnet-5",
      state: { status: "running", model: "deepseek/deepseek-chat" },
    });
    expect(screen.getByText("deepseek-chat")).toBeTruthy();
    expect(screen.queryByText("claude-sonnet-5")).toBeNull();
  });

  it("trades an agent's prompt for its answer once the node has run", () => {
    renderNode({
      ...BASE,
      description: "Review the PR diff",
      state: {
        status: "running",
        model: "glm-5",
        rounds: 3,
        durationMs: 8200,
        outputPreview: "Found an uncapped retry loop in worker.ts",
      },
    });
    // Rounds are an agent progress signal, and they ride in the footer caption.
    expect(screen.getByText("3 rounds")).toBeTruthy();
    // The PROMPT is gone: it is authoring detail, and a reader who opened a run
    // came for what the agent said, not for what it was asked. The card is sized
    // for exactly this trade (nodeHeight reserves no description band for an
    // agent with run state), so rendering it here would overflow the box.
    expect(screen.queryByText("Review the PR diff")).toBeNull();
    expect(
      screen.getByText("Found an uncapped retry loop in worker.ts"),
    ).toBeTruthy();
  });

  it("keeps an agent's prompt on a DEFINITION card, which has no answer to show", () => {
    // The counterpart: with no run state there is nothing to trade the prompt
    // for, so it stays — and `nodeHeight` reserves the description band for it.
    renderNode({ ...BASE, description: "Review the PR diff" });
    expect(screen.getByText("Review the PR diff")).toBeTruthy();
  });

  it("renders an agent's answer as the card BODY, with no caption or well", () => {
    // Answer-first: the output is not an attribute of the node, it is what the
    // node produced. A caption over a framed well says the opposite, and costs
    // the rows that let the answer be five lines instead of three.
    const { container } = renderNode({
      ...BASE,
      state: { status: "succeeded", outputPreview: "the whole answer" },
    });
    expect(screen.queryByText("Output")).toBeNull();
    expect(screen.getByText("the whole answer")).toBeTruthy();
    // Set in the foreground token, not the muted one a well's body uses.
    const body = screen.getByText("the whole answer");
    expect(body.className).toContain("text-foreground");
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
              data: {
                ...BASE,
                description: "the prompt",
                state: { status: "running", model: "m" },
              },
            } as NodeProps<Node<WfNodeData>>)}
          />
        </DensityContext.Provider>
      </ReactFlowProvider>,
    );
    expect(screen.queryByText("Running")).toBeNull();
    // Name + subtitle only: a compact node is an icon and a name. The prompt and
    // the output stay behind the expand toggle / the node detail.
    expect(screen.getByText("AI Agent")).toBeTruthy();
    expect(screen.getByText("m")).toBeTruthy();
    expect(screen.queryByText("the prompt")).toBeNull();
  });

  it("marks an agent node with its model's brand", () => {
    const { container } = renderNode({
      ...BASE,
      model: "anthropic/claude-sonnet-4-5",
    });
    expect(brandMark(container, "Anthropic")).toBeTruthy();
  });

  it("does not announce the mark — the model is already read out as TEXT", () => {
    // The tile is DECORATIVE: it stands for the model, and the model is on the card
    // in words (the subtitle). A screen reader gets "AI Agent, claude-sonnet-4-5";
    // announcing the logo too would only say the same thing a second time, so the
    // tile stays out of the accessibility tree — the same treatment the kind glyph
    // and the provider icon get.
    //
    // Note the mark can only be found by querying the DOM directly: `getByLabelText`
    // would happily return it (Testing Library does not prune an aria-hidden
    // subtree), which is exactly the false comfort this test exists to deny.
    //
    // Built the way the graph builds it, so the subtitle under test is the real one
    // rather than a fixture that assumes the answer.
    const built = buildWorkflowGraph(`
do:
  - agent.run:
      model: anthropic/claude-sonnet-4-5
      prompt: Review it.
`).nodes.find((n) => n.id === "a0");
    const { container } = renderNode(built?.data as WfNodeData);

    expect(
      brandMark(container, "Anthropic")?.closest("[aria-hidden]"),
    ).toBeTruthy();
    // …and the thing it stands for IS announced, in words.
    expect(screen.getByText("claude-sonnet-4-5")).toBeTruthy();
  });

  it("marks the model the run ACTUALLY used, not the one it asked for", () => {
    // The subtitle already shows the actual model once a run is live (a router can
    // fall back to another lab). The mark has to agree with it, or the card shows
    // an Anthropic logo beside the words "gpt-5.4".
    const { container } = renderNode({
      ...BASE,
      model: "anthropic/claude-sonnet-4-5",
      state: { status: "succeeded", model: "openai/gpt-5.4" },
    });
    expect(brandMark(container, "OpenAI")).toBeTruthy();
    expect(brandMark(container, "Anthropic")).toBeNull();
  });

  it("steps a HOSTED model's two-mark stack down so it can't overflow the tile", () => {
    // One lab's own model is a single 28px mark and fills the expanded card's 34px
    // tile. A hosted model stacks host + lab, and that pair is 36px wide — wider
    // than the tile, so the lab chip would hang over the border.
    const { container } = renderNode({
      ...BASE,
      model: "openrouter/anthropic/claude-sonnet-4-5",
    });
    const stack = container.querySelector('[aria-label*="hosting"]');
    expect(stack).toBeTruthy();
    // The narrow stack (h-4 w-6 = 16×24), not the wide one (h-7 w-9 = 28×36).
    expect(stack?.className).toContain("w-6");
    expect(stack?.className).not.toContain("w-9");
  });

  it("keeps a single lab's mark at full size — it was never the one that overflowed", () => {
    const { container } = renderNode({
      ...BASE,
      model: "anthropic/claude-sonnet-4-5",
    });
    expect(container.querySelector('[aria-label="Anthropic"]')?.className).toContain(
      "h-7",
    );
  });

  it("leaves an integration node's PROVIDER mark alone", () => {
    // A model brand belongs to an agent. On an integration node the provider IS the
    // identity (n8n's rule, and what the title says), so it keeps its own logo — the
    // model brand must not take the tile from it.
    const { container } = renderNode({
      ...BASE,
      kind: "integration.invoke",
      provider: "github",
      model: "anthropic/claude-sonnet-4-5",
    });
    expect(container.querySelector('[aria-label="Anthropic"]')).toBeNull();
  });

  it("keeps the kind glyph for a model with no published mark", () => {
    // An unknown provider keeps the generic icon rather than getting an invented
    // logo.
    const { container } = renderNode({ ...BASE, model: "some-internal/model-x" });
    expect(brandMark(container, "Anthropic")).toBeNull();
    expect(brandMark(container, "OpenAI")).toBeNull();
  });

  it("anchors a compact node's handles to its TILE, not to the box that holds its name", () => {
    // The compact box spans the tile AND the name beneath it (so a name can't
    // collide with the node below). Left at the box's default center, the edges
    // would attach to empty canvas beside the label.
    const { container } = render(
      <ReactFlowProvider>
        <DensityContext.Provider value={true}>
          <WorkflowNode {...({ data: BASE } as NodeProps<Node<WfNodeData>>)} />
        </DensityContext.Provider>
      </ReactFlowProvider>,
    );
    const left = container.querySelector<HTMLElement>(
      ".react-flow__handle-left",
    );
    const right = container.querySelector<HTMLElement>(
      ".react-flow__handle-right",
    );
    // Every anchor is stated in ONE coordinate system (left/top + a centering
    // transform), so it lands exactly on the tile's edge midpoint — not half a
    // handle past it, which is where React Flow's own per-side offsets put the
    // Right/Bottom ones.
    expect(left?.style.left).toBe("46px"); // the tile's left edge…
    expect(left?.style.top).toBe("38px"); // …at its vertical middle
    expect(right?.style.left).toBe("122px"); // the tile's right edge
    expect(right?.style.right).toBe("auto");
    expect(right?.style.transform).toBe("translate(-50%, -50%)");
  });

  it("anchors a compact node's handles to the tile under TB too (top/bottom edges)", () => {
    // The vertical mirror of the LR case. `bottom: auto` is required to override
    // React Flow's bottom-anchored default.
    const { container } = render(
      <ReactFlowProvider>
        <DirectionContext.Provider value="TB">
          <DensityContext.Provider value={true}>
            <WorkflowNode {...({ data: BASE } as NodeProps<Node<WfNodeData>>)} />
          </DensityContext.Provider>
        </DirectionContext.Provider>
      </ReactFlowProvider>,
    );
    const top = container.querySelector<HTMLElement>(".react-flow__handle-top");
    const bottom = container.querySelector<HTMLElement>(
      ".react-flow__handle-bottom",
    );
    // In TB the tile sits at the box's LEADING edge and the name beside it, so the
    // handles are on the tile's own top/bottom, centered on its width (38) — and
    // the edge that leaves the bottom passes under the tile, never through the name.
    expect(top?.style.left).toBe("38px");
    expect(top?.style.top).toBe("0px");
    expect(bottom?.style.left).toBe("38px");
    expect(bottom?.style.top).toBe("76px");
    expect(bottom?.style.bottom).toBe("auto");
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

  it("starts compact and flips the density label when the toggle is clicked", () => {
    render(<WorkflowGraph yaml={YAML} variant="full" />);
    // Compact by DEFAULT (the graph is read structure-first) → the toggle offers
    // to expand.
    const toggle = screen.getByRole("button", { name: /expand/i });
    fireEvent.click(toggle);
    // Once expanded, the toggle offers to collapse again.
    expect(screen.getByRole("button", { name: /compact/i })).toBeTruthy();
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
    // The full payload is never rendered; only the bounded preview is. The bound
    // is OUTPUT_PREVIEW_CHARS — spelled out so a change to it is a deliberate
    // edit here too, since lowering it silently drops text the card has room for.
    expect(screen.queryByText(long)).toBeNull();
    expect(screen.getByText(`${"y".repeat(240)}…`)).toBeTruthy();
  });

  it("renders no error element for a failed node with no error, and suppresses its output", () => {
    const { container } = renderNode({
      ...BASE,
      state: { status: "failed", outputPreview: "suppressed while failed" },
    });
    expect(screen.getByText("Failed")).toBeTruthy();
    // No output/error block at all — neither its caption nor a body.
    expect(container.querySelector("p")).toBeNull();
    expect(screen.queryByText("Error")).toBeNull();
    // outputPreview is suppressed for a failed node (error channel only).
    expect(screen.queryByText("suppressed while failed")).toBeNull();
  });

  it("renders NO run band on a trigger — not the footer, the metrics, the output, nor the empty-slot line", () => {
    // The layout spaces a trigger by its STATIC height (`nodeHeight`, model.ts,
    // reserves the run rows only for an action) — a trigger only fires. So every
    // band a run adds must be absent here: rendered, it would have nowhere to go
    // and would overflow the box the layout gave it. This is the invariant that
    // ties the card's render rule to the model's reservation rule; if one moves,
    // this test is what says the other must.
    const { container } = renderNode({
      title: "Schedule",
      kind: "schedule",
      tone: "trigger",
      isRoot: true,
      subtitle: "Daily at 09:00",
      description: "0 9 * * *",
      state: {
        status: "succeeded",
        durationMs: 3200,
        costUsd: 0.004,
        outputPreview: "fired",
      },
    });
    // Its status still shows — in the header pill, which the static height covers.
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Daily at 09:00")).toBeTruthy();
    // …and nothing a run adds.
    expect(container.querySelector(".mt-auto")).toBeNull(); // no status footer
    expect(screen.queryByText("3.2s")).toBeNull(); // no elapsed
    expect(screen.queryByText("$0.0040")).toBeNull(); // no metrics line
    expect(screen.queryByText("fired")).toBeNull(); // no output block
    expect(screen.queryByText("No output")).toBeNull(); // no empty-slot line
  });

  it("says what an empty output slot means, rather than showing a void", () => {
    // The card is sized for the output it MAY yet have (the layout is computed
    // once, before any run state, so it can never reflow mid-run). A node with
    // nothing to report must therefore say so — a blank region reads as a broken
    // card. A running node is the exception: its output may still be on its way.
    const cases: [WfNodeState["status"], string | null][] = [
      ["queued", "Not run yet"],
      ["succeeded", "No output"],
      ["failed", "No error reported"],
      ["running", null],
    ];
    for (const [status, label] of cases) {
      const { unmount } = renderNode({ ...BASE, state: { status } });
      if (label) expect(screen.getByText(label)).toBeTruthy();
      for (const other of ["Not run yet", "No output", "No error reported"]) {
        if (other !== label) expect(screen.queryByText(other)).toBeNull();
      }
      unmount();
    }
  });

  it("shows the static badge and no run status when there is no state", () => {
    renderNode({ ...BASE, badge: "×3", state: undefined });
    expect(screen.getByText("×3")).toBeTruthy();
    expect(screen.queryByText("Running")).toBeNull();
    expect(screen.queryByText("Done")).toBeNull();
  });
});

describe("WorkflowNode — status footer + content-aware output", () => {
  it("renders a JSON output as key/value rows under an OUTPUT label, not one raw blob", () => {
    renderNode({
      ...ACTION,
      state: { status: "succeeded", outputPreview: '{"status":200,"id":4821}' },
    });
    // The block is labelled…
    expect(screen.getByText("Output")).toBeTruthy();
    // …and the JSON is split into keys and values, not dumped verbatim.
    expect(screen.getByText("status")).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
    expect(screen.getByText("id")).toBeTruthy();
    expect(screen.getByText("4821")).toBeTruthy();
    expect(screen.queryByText('{"status":200,"id":4821}')).toBeNull();
  });

  it("labels a failure's error block ERROR and renders the message", () => {
    renderNode({
      ...ACTION,
      state: { status: "failed", error: "provider 500: timed out" },
    });
    expect(screen.getByText("Error")).toBeTruthy();
    expect(screen.getByText("provider 500: timed out")).toBeTruthy();
  });

  it("pins the status footer to the bottom of a flex-column card", () => {
    const { container } = renderNode({
      ...BASE,
      state: { status: "running", rounds: 2, durationMs: 4200 },
    });
    // The bottom-pin only works if the card itself is a column flex container —
    // assert the wrapper's layout, not just that some .mt-auto element exists.
    const wrapper = container.querySelector(".overflow-hidden.rounded-xl");
    expect(wrapper).toBeTruthy();
    const wrapperClasses = (wrapper?.className ?? "").split(/\s+/);
    expect(wrapperClasses).toContain("flex");
    expect(wrapperClasses).toContain("flex-col");
    // The footer is a DIRECT child pinned via mt-auto, carrying rounds + elapsed.
    expect(wrapper?.querySelector(":scope > .mt-auto")).toBeTruthy();
    expect(screen.getByText("2 rounds")).toBeTruthy();
    expect(screen.getByText("4.2s")).toBeTruthy();
  });

  it("does not restate the status in the footer caption (the header pill owns it)", () => {
    // A non-agent failure has no rounds; the footer must not fall back to the
    // status word, which would duplicate the header pill.
    renderNode({
      ...BASE,
      title: "Notify",
      kind: "notify",
      state: { status: "failed", error: "boom", durationMs: 1400 },
    });
    // "Failed" appears exactly once (the header pill), not again in the footer.
    expect(screen.getAllByText("Failed")).toHaveLength(1);
  });

  it("keeps a wide JSON output within its line budget (entries + marker <= ACTION_OUTPUT_ROWS)", () => {
    // An object with more fields than fit must spend its LAST line on the
    // truncation marker, so it renders at most ACTION_OUTPUT_ROWS - 1 key rows. Rows and
    // marker together exceeding the budget is what clips the well or pushes it
    // into the footer of the fixed-height card.
    const { container } = renderNode({
      ...ACTION,
      state: {
        status: "succeeded",
        outputPreview: '{"a":1,"b":2,"c":3,"d":4,"e":5}',
      },
    });
    // Derived from ACTION_OUTPUT_ROWS rather than written as a literal, so retuning the
    // budget moves this expectation with it instead of failing for the wrong
    // reason — the invariant is "rows + marker fits", not "there are two rows".
    expect(container.querySelectorAll("dt")).toHaveLength(ACTION_OUTPUT_ROWS - 1);
    expect(screen.getByText("…")).toBeTruthy();
  });

  it("constrains a long JSON key so it can't overflow the fixed-width card", () => {
    const key = "aVeryLongUnbrokenKeyThatWouldOverflowTheCard";
    const { container } = renderNode({
      ...ACTION,
      state: { status: "succeeded", outputPreview: `{"${key}":"v"}` },
    });
    const dt = container.querySelector("dt");
    expect(dt).toBeTruthy();
    expect(dt?.className).toContain("truncate");
    expect(dt?.className).toContain("max-w-[45%]");
    // The full key stays available on hover even when the column truncates it.
    expect(dt?.getAttribute("title")).toBe(key);
  });

  it("renders a JSON-shaped error in the error tone, not neutral", () => {
    // A failure whose message is a JSON object must still read as an error, like a
    // prose one — not neutral key/value that looks like normal output. The color
    // is the semantic danger TOKEN, so it holds up in light and dark alike.
    const { container } = renderNode({
      ...ACTION,
      state: { status: "failed", error: '{"message":"timeout","code":504}' },
    });
    expect(screen.getByText("Error")).toBeTruthy();
    const danger = "var(--surface-danger-text)";
    expect(container.querySelector("dd")?.style.color).toBe(danger);
    expect(container.querySelector("dt")?.style.color).toBe(danger);
    expect(screen.getByText("timeout")).toBeTruthy();
  });

  it("suppresses the output block for whitespace-only host output, short and long", () => {
    // A whitespace-only preview must never render a bare "Output" label — including
    // when it is longer than the clamp limit, where clampPreview would otherwise
    // turn it into a lone "…".
    for (const ws of ["   \n  ", " ".repeat(300)]) {
      const { unmount } = renderNode({
        ...BASE,
        state: { status: "succeeded", outputPreview: ws },
      });
      expect(screen.queryByText("Output")).toBeNull();
      expect(screen.queryByText("…")).toBeNull();
      unmount();
    }
  });
});

describe("NodeOutputBody — line-clamp on code/text shapes", () => {
  it("clamps a code (<pre>) shape to two lines at the default row budget", () => {
    const { container } = render(
      <NodeOutputBody shape={classifyOutput('["a","b","c"]')} rows={2} />,
    );
    expect(container.querySelector("pre")?.className).toContain("line-clamp-2");
  });

  it("clamps a text (<p>) shape to two lines at the default row budget", () => {
    const { container } = render(
      <NodeOutputBody shape={classifyOutput("a fairly long prose output line")} rows={2} />,
    );
    expect(container.querySelector("p")?.className).toContain("line-clamp-2");
  });

  it("uses single-line truncate at a one-row budget, without a conflicting wrap class", () => {
    const { container } = render(
      <NodeOutputBody shape={classifyOutput('["a","b"]')} rows={1} />,
    );
    const pre = container.querySelector("pre");
    expect(pre?.className).toContain("truncate");
    expect(pre?.className).not.toContain("line-clamp-2");
    // `whitespace-pre-wrap` would override truncate's `nowrap` and re-wrap the line.
    expect(pre?.className).not.toContain("whitespace-pre-wrap");
  });

  it("honors a three-row budget on code and text shapes (not just JSON)", () => {
    const { container: codeC } = render(
      <NodeOutputBody shape={classifyOutput('["a","b","c","d"]')} rows={3} />,
    );
    expect(codeC.querySelector("pre")?.className).toContain("line-clamp-3");
    const { container: textC } = render(
      <NodeOutputBody shape={classifyOutput("a longer prose output to clamp")} rows={3} />,
    );
    expect(textC.querySelector("p")?.className).toContain("line-clamp-3");
  });

  describe('rows="none" — a container that scrolls or is sized by its content', () => {
    it("renders prose and code with no clamp class at all", () => {
      const { container: textC } = render(
        <NodeOutputBody shape={classifyOutput("a longer prose output")} rows="none" />,
      );
      const p = textC.querySelector("p");
      expect(p?.className).not.toMatch(/line-clamp|truncate/);
      const { container: codeC } = render(
        <NodeOutputBody shape={classifyOutput('["a","b","c"]')} rows="none" />,
      );
      expect(codeC.querySelector("pre")?.className).not.toMatch(
        /line-clamp|truncate/,
      );
    });

    it("renders EVERY recovered JSON entry, with no row budget to run out of", () => {
      // Six keys — more than any card's row budget, and exactly the case that
      // renders as one field and an ellipsis inside a card.
      const json = '{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6}';
      const { container } = render(
        <NodeOutputBody shape={classifyOutput(json)} rows="none" />,
      );
      expect(container.querySelectorAll("dt")).toHaveLength(6);
      // The marker is what `classifyOutput` dropped, and it dropped nothing.
      expect(container.textContent).not.toContain("…");
    });

    it("still marks entries the classifier itself capped", () => {
      // MAX_JSON_ENTRIES is 6, so a seventh key is gone before the body sees it —
      // unclamped or not, the reader has to be told something was dropped.
      const json = `{${Array.from({ length: 9 }, (_, i) => `"k${i}":${i}`).join(",")}}`;
      const { container } = render(
        <NodeOutputBody shape={classifyOutput(json)} rows="none" />,
      );
      expect(container.querySelectorAll("dt")).toHaveLength(6);
      expect(container.textContent).toContain("…");
    });
  });

  // A card that RESERVES n lines and then silently clamps to two shows a short
  // body in a tall well — the reservation and the render disagree, and nothing
  // fails. So every budget a card can reserve has to map to its own utility.
  it.each([4, 5, 6])("honors a %i-row budget rather than falling back to two", (rows) => {
    const { container: textC } = render(
      <NodeOutputBody shape={classifyOutput("a longer prose output to clamp")} rows={rows} />,
    );
    expect(textC.querySelector("p")?.className).toContain(`line-clamp-${rows}`);
    const { container: codeC } = render(
      <NodeOutputBody shape={classifyOutput('["a","b","c","d"]')} rows={rows} />,
    );
    expect(codeC.querySelector("pre")?.className).toContain(`line-clamp-${rows}`);
  });
});

describe("buildStyledEdges — declared topology", () => {
  const backEdge = (source: string, target: string): WfFlowEdge => ({
    id: `${source}->${target}`,
    source,
    target,
    type: "wfEdge",
    data: { kind: "spine", backEdge: true },
  });

  it("dashes a cycle-closing edge and never animates it", () => {
    // A back edge points at a node the run may re-enter, so its target can very
    // well be `running` — but animating the RETURN path would read as the run
    // travelling backwards along it.
    const [e] = buildStyledEdges([backEdge("a2", "a1")], {
      a1: { status: "running" },
    });
    expect(e.style?.strokeDasharray).toBe("6 3");
    expect(e.animated).toBe(false);
    // It still takes its target's color, so the loop reads as part of the run.
    expect(e.style?.stroke).toBe("hsl(var(--primary))");
  });

  it("stamps the visit budget onto cycle edges only", () => {
    const plain: WfFlowEdge = {
      id: "a0->a1",
      source: "a0",
      target: "a1",
      type: "smoothstep",
      data: { kind: "spine" },
    };
    const [loop, forward] = buildStyledEdges(
      [backEdge("a2", "a1"), plain],
      undefined,
      25,
    );
    expect(loop.data?.maxNodeVisits).toBe(25);
    // A forward edge has no loop to bound, so it carries no budget.
    expect(forward.data?.maxNodeVisits).toBeUndefined();
  });

  it("leaves a forward edge undashed", () => {
    const [e] = buildStyledEdges(
      [
        {
          id: "a0->a1",
          source: "a0",
          target: "a1",
          type: "smoothstep",
          data: { kind: "spine" },
        },
      ],
      { a1: { status: "running" } },
    );
    expect(e.style?.strokeDasharray).toBeUndefined();
    expect(e.animated).toBe(true);
  });
});

describe("WorkflowNode selection", () => {
  function renderWithSelection(
    id: string,
    selectedNodeId: string | undefined,
    data: WfNodeData = BASE,
  ) {
    return render(
      <ReactFlowProvider>
        <SelectedNodeContext.Provider value={selectedNodeId}>
          <WorkflowNode {...({ id, data } as NodeProps<Node<WfNodeData>>)} />
        </SelectedNodeContext.Provider>
      </ReactFlowProvider>,
    );
  }
  const ringed = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>("[style]")).some((el) =>
      (el.getAttribute("style") ?? "").includes("outline"),
    );

  it("rings the selected node and leaves its neighbours alone", () => {
    const selectedRender = renderWithSelection("a0", "a0");
    expect(ringed(selectedRender.container)).toBe(true);
    selectedRender.unmount();
    expect(ringed(renderWithSelection("a1", "a0").container)).toBe(false);
  });

  it("rings nothing when the host has no selection", () => {
    // The identity trap: an unset selection must not match a node whose id is
    // likewise unset, or "nothing selected" renders as "this one is".
    expect(ringed(renderWithSelection("a0", undefined).container)).toBe(false);
  });

  it("rings the TILE when compact, not the wider name box", () => {
    const { container } = render(
      <ReactFlowProvider>
        <DensityContext.Provider value={true}>
          <SelectedNodeContext.Provider value="a0">
            <WorkflowNode
              {...({ id: "a0", data: BASE } as NodeProps<Node<WfNodeData>>)}
            />
          </SelectedNodeContext.Provider>
        </DensityContext.Provider>
      </ReactFlowProvider>,
    );
    const outlined = Array.from(
      container.querySelectorAll<HTMLElement>("[style]"),
    ).find((el) => (el.getAttribute("style") ?? "").includes("outline"));
    // The compact node's box spans tile + name; the tile is the visual node, and
    // it is the one that carries the ring (its style pins the tile's own size).
    expect(outlined?.getAttribute("style")).toContain(`width: ${COMPACT_TILE}px`);
  });
});

describe("isEditableEdge", () => {
  it("accepts a declared edge between two steps", () => {
    expect(
      isEditableEdge({ source: "a0", data: { kind: "spine" } }),
    ).toBe(true);
  });

  it("refuses a fan-out edge", () => {
    // A fork edge is derived from a structural action's own config (a
    // parallel's branches, a foreach's template). It is not a row in anyone's
    // declared topology, so there is nothing for a delete to remove.
    expect(isEditableEdge({ source: "a0", data: { kind: "fork" } })).toBe(false);
  });

  it("refuses an edge out of any trigger", () => {
    // A trigger edge is what "nothing points at this node" RENDERS as — it is
    // synthesized, not declared. Deleting one would ask the host to remove an
    // edge the definition never contained.
    expect(isEditableEdge({ source: "trigger", data: { kind: "spine" } })).toBe(
      false,
    );
    // …including the later entries of a list-form `on:`.
    expect(
      isEditableEdge({ source: "trigger:2", data: { kind: "spine" } }),
    ).toBe(false);
  });

  it("does not mistake a step whose id merely starts with the trigger word", () => {
    expect(
      isEditableEdge({ source: "triggerish", data: { kind: "spine" } }),
    ).toBe(true);
  });
});

describe("WorkflowNode connection handles", () => {
  const handles = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>(".react-flow__handle"));

  function renderAt(connectable: boolean) {
    return render(
      <ReactFlowProvider>
        <ConnectableContext.Provider value={connectable}>
          <WorkflowNode
            {...({ id: "a0", data: BASE } as NodeProps<Node<WfNodeData>>)}
          />
        </ConnectableContext.Provider>
      </ReactFlowProvider>,
    );
  }

  it("hides its handles on a read-only canvas", () => {
    // The diagram reads as edges meeting the node body; a visible dot on every
    // node is noise when nothing can be dragged.
    const found = handles(renderAt(false).container);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((h) => h.className.includes("opacity-0"))).toBe(true);
  });

  it("shows them once the canvas can be edited", () => {
    // A handle you cannot see is a handle you cannot find, and dragging one IS
    // the connect gesture.
    const found = handles(renderAt(true).container);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((h) => h.className.includes("opacity-0"))).toBe(false);
    expect(found.every((h) => h.className.includes("opacity-100"))).toBe(true);
  });
});
