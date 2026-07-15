// @vitest-environment jsdom
import type { Edge, Node, NodeProps } from "@xyflow/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildWorkflowGraph, type WfNodeData, type WfNodeState } from "./model";
import { classifyOutput, NodeOutputBody } from "./node-output";
import {
  buildStyledEdges,
  DensityContext,
  DirectionContext,
  fitViewOnLayoutChange,
  fitZoomCeiling,
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

// WorkflowNode renders React Flow <Handle>s, which read the flow store from
// context — wrap it in a provider so it renders standalone.
function renderNode(data: WfNodeData) {
  return render(
    <ReactFlowProvider>
      <WorkflowNode {...({ data } as NodeProps<Node<WfNodeData>>)} />
    </ReactFlowProvider>,
  );
}

describe("reframing the viewport when the layout changes", () => {
  // The density toggle re-frames the graph under a reader who is already looking at
  // it, so the viewport GLIDES to its new framing rather than jumping. A reader who
  // asked the system for less motion gets the framing without the glide.
  const prefersReducedMotion = (reduce: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      (query: string) => ({
        matches: reduce && query.includes("prefers-reduced-motion"),
        media: query,
      }),
    );

  afterEach(() => vi.unstubAllGlobals());

  it("glides by default", () => {
    prefersReducedMotion(false);
    expect(fitViewOnLayoutChange()).toHaveProperty("duration", 220);
  });

  it("reframes instantly for a reader who asked for less motion", () => {
    prefersReducedMotion(true);
    expect(fitViewOnLayoutChange()).not.toHaveProperty("duration");
  });

  it("does not move at all where the preference cannot be read", () => {
    // Motion is opt-OUT. Somewhere without matchMedia cannot tell us a reader
    // tolerates movement, so it does not get any.
    vi.stubGlobal("matchMedia", undefined);
    expect(fitViewOnLayoutChange()).not.toHaveProperty("duration");
  });

  it("keeps the SAME framing either way — only the transition differs", () => {
    prefersReducedMotion(true);
    const still = fitViewOnLayoutChange();
    prefersReducedMotion(false);
    const glide = fitViewOnLayoutChange();
    expect(glide.padding).toBe(still.padding);
    expect(glide.minZoom).toBe(still.minZoom);
  });

  it("lets a compact fit zoom past 1, and holds full cards at their size", () => {
    // Compact tiles are small by design — fitting them into the canvas
    // legitimately zooms in; full cards at 1 are already their designed size.
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

  it("surfaces the agent round count in the footer, alongside the prompt", () => {
    renderNode({
      ...BASE,
      description: "Review the PR diff",
      state: { status: "running", model: "glm-5", rounds: 3, durationMs: 8200 },
    });
    // Rounds are an agent progress signal; the prompt description is shown too.
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
      ...BASE,
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
      ...BASE,
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

  it("keeps a wide JSON output within the 2-line budget (entries + marker <= 2)", () => {
    // A 5-field object at the card's 2-line output budget must render at most one
    // key row plus the truncation marker — never two rows AND a marker (3 lines),
    // which would clip or push into the footer of the fixed-height card.
    const { container } = renderNode({
      ...BASE,
      state: {
        status: "succeeded",
        outputPreview: '{"a":1,"b":2,"c":3,"d":4,"e":5}',
      },
    });
    expect(container.querySelectorAll("dt")).toHaveLength(1);
    expect(screen.getByText("…")).toBeTruthy();
  });

  it("constrains a long JSON key so it can't overflow the fixed-width card", () => {
    const key = "aVeryLongUnbrokenKeyThatWouldOverflowTheCard";
    const { container } = renderNode({
      ...BASE,
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
      ...BASE,
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
});
