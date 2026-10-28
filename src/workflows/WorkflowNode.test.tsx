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
  RunModeContext,
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
//
// `RunModeContext` says whether the GRAPH is showing a run, which is what decides
// whether a card renders its run bands (the graph reserves them for every action
// the moment it has any run state). Defaulted here to "this node has state",
// which is the case every test that passes one is describing; a test covering a
// node the host sent NO entry for in a live run passes it explicitly.
function renderNode(data: WfNodeData, runMode = data.state !== undefined) {
  return render(
    <ReactFlowProvider>
      <RunModeContext.Provider value={runMode}>
        <WorkflowNode {...({ data } as NodeProps<Node<WfNodeData>>)} />
      </RunModeContext.Provider>
    </ReactFlowProvider>,
  );
}

describe("fitZoomCeiling", () => {
  it("lets a compact fit zoom past 1, and holds full cards at their size", () => {
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
  const edge = (source: string, target: string): WfFlowEdge => ({
    id: `${source}->${target}`,
    source,
    target,
    type: "smoothstep",
    data: { kind: "spine" },
  });

  it("styles edges with RAW brand tokens, never a --color-* @theme alias", () => {
    // An inline `var(--color-*)` stroke resolves in this library's Storybook (its
    // @theme registers those aliases) but is UNDEFINED in a consumer that only
    // ships `tokens.css` (e.g. platform-web), where it silently computes to
    // `stroke: none` — the invisible unreached edges bug. Every edge/marker color
    // must therefore use a raw token.
    const edges = buildStyledEdges(
      [edge("a", "b")],
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
  it("animates the progress bar only for a running node", () => {
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
    expect(screen.getByText("AI Agent · gpt-4o")).toBeTruthy();
    expect(screen.getByText("$0.0032")).toBeTruthy();
    expect(screen.getByText("4.2s")).toBeTruthy();
    expect(screen.getByText("partial answer")).toBeTruthy();
  });

  it("shows the model a run ACTUALLY used, shortened like the requested one", () => {
    renderNode({
      ...BASE,
      subtitle: "claude-sonnet-5",
      state: { status: "running", model: "deepseek/deepseek-chat" },
    });
    expect(screen.getByText(/deepseek-chat/)).toBeTruthy();
    expect(screen.queryByText(/claude-sonnet-5/)).toBeNull();
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

  it("shows an agent's prompt while it has no answer yet, so a queued branch says what it will do", () => {
    renderNode({
      ...BASE,
      description: "Audit the change for security vulnerabilities.",
      subtitle: "deepseek-chat",
      state: { status: "queued" },
    });
    expect(
      screen.getByText("Audit the change for security vulnerabilities."),
    ).toBeTruthy();
    expect(screen.getByText("AI Agent · deepseek-chat")).toBeTruthy();
  });

  it("shows a failed decision WHY it failed, in the band its question had", () => {
    // A decision reserves a header, its question and a footer — and nothing
    // else. Rendering the error as an extra band would overflow that box, so it
    // takes the question's place instead: once the run has stopped on an error
    // nobody is going to answer the question, and the two never compete.
    renderNode({
      title: "Ship the release?",
      kind: "decision",
      subtitle: "approve / reject",
      description: "The reviewer flagged two medium-severity findings.",
      isRoot: false,
      tone: "structural",
      state: { status: "failed", error: "decision timed out after 24h" },
    });
    expect(screen.getByText("decision timed out after 24h")).toBeTruthy();
    expect(
      screen.queryByText("The reviewer flagged two medium-severity findings."),
    ).toBeNull();
    cleanup();
    renderNode({
      title: "Ship the release?",
      kind: "decision",
      subtitle: "approve / reject",
      description: "The reviewer flagged two medium-severity findings.",
      isRoot: false,
      tone: "structural",
      state: { status: "waiting" },
    });
    expect(
      screen.getByText("The reviewer flagged two medium-severity findings."),
    ).toBeTruthy();
  });

  it("orders the footer caption most- to least-important, so a squeeze sheds tokens first", () => {
    // The caption is one truncating span: rounds, cost and tokens joined. Measured
    // in the browser it does not overflow a 292px card at realistic values — a
    // 12-round, $12.48, 128000/32000 run renders well inside the 292px card — and
    // only clips on values far past that (a $1284 node with a million input
    // tokens). What matters is therefore not WHETHER it can clip but WHAT it
    // sheds when it does: `truncate` cuts the tail, so this order is what keeps
    // spend visible and drops the token counts. Reversing it would lose cost first.
    renderNode({
      ...BASE,
      state: {
        status: "succeeded",
        rounds: 12,
        costUsd: 12.4821,
        inputTokens: 128000,
        outputTokens: 32000,
        durationMs: 5_000_000,
      },
    });
    const caption = screen.getByText(/rounds/);
    expect(caption.textContent).toBe("12 rounds · $12.48 · 128000/32000 tok");
    expect(caption.className).toContain("truncate");
  });

  it("renders an agent's answer and its prompt at the SAME type size", () => {
    const { container: answer } = renderNode({
      ...BASE,
      state: { status: "succeeded", outputPreview: "the answer" },
    });
    const { container: prompt } = renderNode({
      ...BASE,
      description: "the prompt",
      state: { status: "queued" },
    });
    const size = (c: HTMLElement) =>
      (c.querySelector("p")?.className ?? "").match(/text-\[\d+px\]/)?.[0];
    expect(size(answer)).toBe("text-[11px]");
    expect(size(prompt)).toBe("text-[11px]");
  });

  it("says a FINISHED agent produced nothing, rather than falling back to its prompt", () => {
    renderNode({
      ...BASE,
      description: "Triage the change and decide what review it needs.",
      state: { status: "succeeded" },
    });
    expect(screen.getByText("No output")).toBeTruthy();
    expect(
      screen.queryByText("Triage the change and decide what review it needs."),
    ).toBeNull();
  });

  it("replaces that prompt with the answer as soon as one arrives", () => {
    renderNode({
      ...BASE,
      description: "Audit the change for security vulnerabilities.",
      state: { status: "succeeded", outputPreview: "2 high-severity findings." },
    });
    expect(screen.getByText("2 high-severity findings.")).toBeTruthy();
    expect(
      screen.queryByText("Audit the change for security vulnerabilities."),
    ).toBeNull();
  });

  it("renders a run card for a node the host sent no state for, matching what the layout reserved", () => {
    const { container } = renderNode({ ...ACTION, description: "post it" }, true);
    expect(container.querySelector(":scope > div > .mt-auto")).toBeTruthy();
  });

  it("renders NO run bands when the graph is not showing a run at all", () => {
    const { container } = renderNode({ ...ACTION, description: "post it" }, false);
    expect(container.querySelector(":scope > div > .mt-auto")).toBeNull();
    expect(screen.getByText("post it")).toBeTruthy();
  });

  it("keeps an agent's prompt on a DEFINITION card, which has no answer to show", () => {
    renderNode({ ...BASE, description: "Review the PR diff" });
    expect(screen.getByText("Review the PR diff")).toBeTruthy();
  });

  it("renders an agent's answer as the card BODY, with no caption or well", () => {
    const { container } = renderNode({
      ...BASE,
      state: { status: "succeeded", outputPreview: "the whole answer" },
    });
    expect(screen.queryByText("Output")).toBeNull();
    expect(screen.getByText("the whole answer")).toBeTruthy();
    const body = screen.getByText("the whole answer");
    expect(body.className).toContain("text-foreground");
  });

  it("renders the singular '1 round'", () => {
    renderNode({ ...BASE, state: { status: "running", rounds: 1 } });
    expect(screen.getByText("1 round")).toBeTruthy();
  });

  it("renders an explicit 'rounds: 0' rather than hiding it", () => {
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
    expect(screen.getByText("claude-sonnet-4-5")).toBeTruthy();
  });

  it("marks the model the run ACTUALLY used, not the one it asked for", () => {
    const { container } = renderNode({
      ...BASE,
      model: "anthropic/claude-sonnet-4-5",
      state: { status: "succeeded", model: "openai/gpt-5.4" },
    });
    expect(brandMark(container, "OpenAI")).toBeTruthy();
    expect(brandMark(container, "Anthropic")).toBeNull();
  });

  it("steps a HOSTED model's two-mark stack down so it can't overflow the tile", () => {
    const { container } = renderNode({
      ...BASE,
      model: "openrouter/anthropic/claude-sonnet-4-5",
    });
    const stack = container.querySelector('[aria-label*="hosting"]');
    expect(stack).toBeTruthy();
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
    const { container } = renderNode({
      ...BASE,
      kind: "integration.invoke",
      provider: "github",
      model: "anthropic/claude-sonnet-4-5",
    });
    expect(container.querySelector('[aria-label="Anthropic"]')).toBeNull();
  });

  it("keeps the kind glyph for a model with no published mark", () => {
    const { container } = renderNode({ ...BASE, model: "some-internal/model-x" });
    expect(brandMark(container, "Anthropic")).toBeNull();
    expect(brandMark(container, "OpenAI")).toBeNull();
  });

  it("anchors a compact node's handles to its TILE, not to the box that holds its name", () => {
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
    expect(left?.style.left).toBe("46px"); // the tile's left edge…
    expect(left?.style.top).toBe("38px"); // …at its vertical middle
    expect(right?.style.left).toBe("122px"); // the tile's right edge
    expect(right?.style.right).toBe("auto");
    expect(right?.style.transform).toBe("translate(-50%, -50%)");
  });

  it("anchors a compact node's handles to the tile under TB too (top/bottom edges)", () => {
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
    const toggle = screen.getByRole("button", { name: /expand/i });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /compact/i })).toBeTruthy();
  });

  it("does not show a token chip for a non-agent node", () => {
    renderNode({
      ...BASE,
      title: "Notify",
      kind: "notify",
      state: { status: "succeeded", inputTokens: 100, outputTokens: 20, durationMs: 300 },
    });
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
    expect(screen.queryByText(long)).toBeNull();
    expect(screen.getByText(`${"y".repeat(240)}…`)).toBeTruthy();
  });

  it("renders no error element for a failed node with no error, and suppresses its output", () => {
    const { container } = renderNode({
      ...BASE,
      state: { status: "failed", outputPreview: "suppressed while failed" },
    });
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(container.querySelector("p")).toBeNull();
    expect(screen.queryByText("Error")).toBeNull();
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
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Daily at 09:00")).toBeTruthy();
    expect(container.querySelector(".mt-auto")).toBeNull(); // no status footer
    expect(screen.queryByText("3.2s")).toBeNull(); // no elapsed
    expect(screen.queryByText("$0.0040")).toBeNull(); // no metrics line
    expect(screen.queryByText("fired")).toBeNull(); // no output block
    expect(screen.queryByText("No output")).toBeNull(); // no empty-slot line
  });

  it("says what an empty output slot means, rather than showing a void", () => {
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
    expect(screen.getByText("Output")).toBeTruthy();
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
    const wrapper = container.querySelector(".overflow-hidden.rounded-xl");
    expect(wrapper).toBeTruthy();
    const wrapperClasses = (wrapper?.className ?? "").split(/\s+/);
    expect(wrapperClasses).toContain("flex");
    expect(wrapperClasses).toContain("flex-col");
    expect(wrapper?.querySelector(":scope > .mt-auto")).toBeTruthy();
    expect(screen.getByText("2 rounds")).toBeTruthy();
    expect(screen.getByText("4.2s")).toBeTruthy();
  });

  it("does not restate the status in the footer caption (the header pill owns it)", () => {
    renderNode({
      ...BASE,
      title: "Notify",
      kind: "notify",
      state: { status: "failed", error: "boom", durationMs: 1400 },
    });
    expect(screen.getAllByText("Failed")).toHaveLength(1);
  });

  it("keeps a wide JSON output within its line budget (entries + marker <= ACTION_OUTPUT_ROWS)", () => {
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
    expect(dt?.getAttribute("title")).toBe(key);
  });

  it("renders a JSON-shaped error in the error tone, not neutral", () => {
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
      const json = '{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6}';
      const { container } = render(
        <NodeOutputBody shape={classifyOutput(json)} rows="none" />,
      );
      expect(container.querySelectorAll("dt")).toHaveLength(6);
      expect(container.textContent).not.toContain("…");
    });

    it("still marks entries the classifier itself capped", () => {
      const json = `{${Array.from({ length: 9 }, (_, i) => `"k${i}":${i}`).join(",")}}`;
      const { container } = render(
        <NodeOutputBody shape={classifyOutput(json)} rows="none" />,
      );
      expect(container.querySelectorAll("dt")).toHaveLength(6);
      expect(container.textContent).toContain("…");
    });
  });

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
    expect(isEditableEdge({ source: "a0", data: { kind: "fork" } })).toBe(false);
  });

  it("refuses an edge out of any trigger", () => {
    expect(isEditableEdge({ source: "trigger", data: { kind: "spine" } })).toBe(
      false,
    );
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
    const found = handles(renderAt(false).container);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((h) => h.className.includes("opacity-0"))).toBe(true);
  });

  it("shows them once the canvas can be edited", () => {
    const found = handles(renderAt(true).container);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((h) => h.className.includes("opacity-0"))).toBe(false);
    expect(found.every((h) => h.className.includes("opacity-100"))).toBe(true);
  });

  it("stacks a connectable handle above the node card, so it is draggable at all", () => {
    // The handle straddles the card's edge. Without an explicit z-index the
    // card paints over it and every pointerdown lands on the card — the
    // connect gesture can then never START, which no jsdom event test can
    // catch (verified in a live browser: `elementFromPoint` returned the card
    // at every pixel of the handle, and the identical drag landed once the
    // handle was raised). This pins the class by name because the defect is a
    // stacking fact jsdom cannot observe.
    const found = handles(renderAt(true).container);
    expect(found.every((h) => h.className.includes("!z-10"))).toBe(true);
  });
});
