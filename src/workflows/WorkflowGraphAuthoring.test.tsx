// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * What the AUTHORING decorations actually render — the problem marks a node and
 * an edge wear, the insert control an edge draws, and the trigger's own remove
 * control — against the real node and edge components.
 *
 * Which gestures the canvas arms, and on which edges, is the flow-level concern
 * next door in WorkflowGraphEditing.test.tsx.
 *
 * Only two React Flow pieces are stubbed. `EdgeLabelRenderer` portals into a
 * container the measured canvas owns, so outside a live canvas it renders
 * NOTHING — and everything an edge says lives inside it. `BaseEdge` draws an
 * SVG path that needs the same canvas. The node's own `Handle`s are left real,
 * reading the store from `ReactFlowProvider` as they do elsewhere in this suite.
 */
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="edge-labels">{children}</div>
    ),
    BaseEdge: () => <path data-testid="edge-path" />,
  };
});

const { MarkerType, Position, ReactFlowProvider } = await import(
  "@xyflow/react"
);
const { ProblemMessages } = await import("./node-ui");
const {
  decorateAuthoringEdges,
  DensityContext,
  EdgeInsertContext,
  NodeBoxesContext,
  NodeProblemsContext,
  RunModeContext,
  TriggerDeleteContext,
  WfEdgeRenderer,
  WorkflowNode,
} = await import("./WorkflowGraph");
const { indexProblems, WF_EDGE_TYPE } = await import("./flow-graph");
const { actionNodeId, TRIGGER_NODE_ID } = await import("./model");
type WfFlowEdge = import("./flow-graph").WfFlowEdge;
type WorkflowNodeProps = Parameters<typeof WorkflowNode>[0];

afterEach(cleanup);

const ACTION = {
  title: "Notify",
  kind: "notify",
  subtitle: "example.com",
  isRoot: false,
  tone: "action",
} as const;

const TRIGGER = {
  title: "Webhook",
  kind: "webhook",
  isRoot: true,
  tone: "trigger",
} as const;

function renderNode({
  id = actionNodeId(0),
  data = ACTION,
  problems = [],
  onTriggerDelete = null,
  compact = false,
  runMode = false,
}: {
  id?: string;
  data?: Record<string, unknown>;
  problems?: Parameters<typeof indexProblems>[0];
  onTriggerDelete?: ((nodeId: string) => void) | null;
  compact?: boolean;
  runMode?: boolean;
} = {}) {
  return render(
    <ReactFlowProvider>
      <RunModeContext.Provider value={runMode}>
        <DensityContext.Provider value={compact}>
          <NodeProblemsContext.Provider value={indexProblems(problems).byNode}>
            <TriggerDeleteContext.Provider value={onTriggerDelete}>
              <WorkflowNode {...({ id, data } as WorkflowNodeProps)} />
            </TriggerDeleteContext.Provider>
          </NodeProblemsContext.Provider>
        </DensityContext.Provider>
      </RunModeContext.Provider>
    </ReactFlowProvider>,
  );
}

const problem = (
  node: string,
  severity: "error" | "warning",
  message: string,
) => ({ anchor: "node", node, severity, message }) as const;

describe("a node carrying authoring problems", () => {
  it("says WHICH step is broken and WHY, in both densities", () => {
    for (const compact of [false, true]) {
      cleanup();
      renderNode({
        problems: [problem(actionNodeId(0), "error", "url is required")],
        compact,
      });
      const mark = screen.getByTestId("wf-node-problem");
      expect(mark.dataset.severity).toBe("error");
      // The message on `title` is what makes the mark worth more than a tint:
      // the canvas answers "why" without a trip to the list below it.
      expect(mark.title).toBe("Error: url is required");
    }
  });

  it("counts them, and reads one error among warnings as an error", () => {
    renderNode({
      problems: [
        problem(actionNodeId(0), "warning", "no timeout set"),
        problem(actionNodeId(0), "error", "url is required"),
      ],
    });
    const mark = screen.getByTestId("wf-node-problem");
    expect(mark.dataset.severity).toBe("error");
    expect(mark.textContent).toContain("2");
    expect(mark.title).toBe("Warning: no timeout set\nError: url is required");
  });

  it("says which of a mixed set is the error and which is the warning", () => {
    // The mark carries ONE aggregate severity, as a colour and a glyph — neither
    // of which a screen reader receives. Without the words, an anchor holding an
    // error and a warning gives no way to tell which one blocks the compile.
    renderNode({
      problems: [
        problem(actionNodeId(0), "warning", "no timeout set"),
        problem(actionNodeId(0), "error", "url is required"),
      ],
    });
    const text = screen.getByTestId("wf-node-problem").textContent ?? "";
    expect(text).toContain("Warning: no timeout set");
    expect(text).toContain("Error: url is required");
  });

  it("joins messages without doubling the punctuation they already carry", () => {
    // Every terminator a host might end on, run together for a listener.
    for (const [ending, first] of [
      [".", "url is required."],
      ["?", "did you mean `url`?"],
      ["!", "this cannot run!"],
    ] as const) {
      cleanup();
      renderNode({
        problems: [
          problem(actionNodeId(0), "error", first),
          problem(actionNodeId(0), "warning", "no timeout set"),
        ],
      });
      const text = screen.getByTestId("wf-node-problem").textContent ?? "";
      expect(text).toContain(`${ending} Warning: no timeout set`);
      expect(text).not.toContain("..");
      expect(text).not.toContain("?.");
      expect(text).not.toContain("!.");
    }
  });

  it("renders nothing rather than throwing when handed no problems at all", () => {
    // `reduce` with no seed throws on an empty list. Production never gets here
    // (an empty set has no severity, so no mark is drawn), but the component's
    // own signature accepts one and a throw during render is not a contract.
    const { container } = render(<ProblemMessages problems={[]} />);
    expect(container.textContent).toBe("");
  });

  it("names an unrecognised severity as an error rather than 'undefined'", () => {
    // A JS host can send a severity this library has no word for. Reading it out
    // as the literal word "undefined" helps nobody, and colouring it as a
    // warning understates something that might be blocking — so the word and the
    // aggregate ranking agree on treating it as an error.
    renderNode({
      problems: [
        {
          anchor: "node",
          node: actionNodeId(0),
          severity: "catastrophe",
          message: "the roof is on fire",
        } as never,
      ],
    });
    const mark = screen.getByTestId("wf-node-problem");
    expect(mark.title).toBe("Error: the roof is on fire");
    expect(mark.dataset.severity).toBe("error");
  });

  it("survives a message that is not a string at all", () => {
    // The type says string; the package is consumed from JavaScript too, and one
    // malformed entry must not take the whole canvas down with it.
    renderNode({
      problems: [
        { anchor: "node", node: actionNodeId(0), severity: "error" } as never,
      ],
    });
    expect(screen.getByTestId("wf-node-problem").title).toBe("Error");
  });

  it("names a problem by its severity when the host sent no message", () => {
    renderNode({ problems: [problem(actionNodeId(0), "error", "   ")] });
    expect(screen.getByTestId("wf-node-problem").title).toBe("Error");
  });

  it("keeps a message's own spacing, rewriting only its line breaks", () => {
    // A diagnostic can be quoting source, and the host's problem list shows the
    // same text — so the canvas alters what breaks the one-line reading, and
    // nothing else.
    renderNode({
      problems: [problem(actionNodeId(0), "error", "expected  two spaces\n  and a second line")],
    });
    expect(screen.getByTestId("wf-node-problem").title).toBe(
      "Error: expected  two spaces and a second line",
    );
  });

  it("passes a host's message through verbatim, punctuation and all", () => {
    // A diagnostic can be ABOUT the character that trimming would remove, and
    // the canvas has to say what the host's own problem list says.
    renderNode({
      problems: [problem(actionNodeId(0), "error", "unexpected ;")],
    });
    expect(screen.getByTestId("wf-node-problem").title).toBe(
      "Error: unexpected ;",
    );
  });

  it("keeps a host's multi-line message on one line per problem", () => {
    renderNode({
      problems: [problem(actionNodeId(0), "error", "line one\nline two")],
    });
    expect(screen.getByTestId("wf-node-problem").title).toBe(
      "Error: line one line two",
    );
  });

  it("puts every message in the accessibility tree, not only a tooltip", () => {
    // `title` opens for a pointer and for nobody else. A mark whose accessible
    // name is "2 problems" tells a keyboard, screen-reader or touch user that a
    // step is broken and never why — so the messages are rendered, hidden.
    renderNode({
      problems: [
        problem(actionNodeId(0), "warning", "no timeout set"),
        problem(actionNodeId(0), "error", "url is required"),
      ],
    });
    const name = screen.getByTestId("wf-node-problem").textContent ?? "";
    expect(name).toContain("no timeout set");
    expect(name).toContain("url is required");
    // The count is decoration beside the words, so it must not be read out too.
    expect(screen.getByText("2").getAttribute("aria-hidden")).toBe("true");
  });

  it("reads a single problem as its own message", () => {
    renderNode({
      problems: [problem(actionNodeId(0), "error", "url is required")],
    });
    expect(screen.getByTestId("wf-node-problem").textContent).toBe(
      "Error: url is required",
    );
  });

  it("shows nothing on a node with no problem of its own", () => {
    renderNode({ problems: [problem(actionNodeId(1), "error", "elsewhere")] });
    expect(screen.queryByTestId("wf-node-problem")).toBeNull();
  });

  it("tints the card border, so a broken step is findable without hovering", () => {
    const { container } = renderNode({
      problems: [problem(actionNodeId(0), "error", "url is required")],
    });
    const card = container.querySelector<HTMLElement>('[data-testid="wf-node-card"]');
    expect(card?.style.borderColor).toBe("var(--surface-danger-text)");
  });

  it("lets a RUN status keep the border it owns", () => {
    // A run's border is the more urgent reading of the same edge of the same
    // box. The two only meet if a host draws a run graph with authoring
    // problems on it, and the run must win there.
    const { container } = renderNode({
      data: { ...ACTION, state: { status: "failed" } },
      runMode: true,
      problems: [problem(actionNodeId(0), "warning", "no timeout set")],
    });
    const card = container.querySelector<HTMLElement>('[data-testid="wf-node-card"]');
    expect(card?.style.borderColor).toBe("var(--surface-danger-text)");
    expect(card?.style.boxShadow).toContain("35%");
  });
});

describe("the trigger's remove control", () => {
  it("is drawn on a trigger, and only when the host offers one", () => {
    renderNode({ id: TRIGGER_NODE_ID, data: TRIGGER });
    expect(screen.queryByTestId("wf-trigger-delete")).toBeNull();
    cleanup();
    renderNode({
      id: TRIGGER_NODE_ID,
      data: TRIGGER,
      onTriggerDelete: vi.fn(),
    });
    expect(screen.getByTestId("wf-trigger-delete")).toBeTruthy();
  });

  it("is never drawn on a step, which is a list edit rather than a gesture", () => {
    renderNode({ onTriggerDelete: vi.fn() });
    expect(screen.queryByTestId("wf-trigger-delete")).toBeNull();
  });

  it("gives the remove control a target big enough to hit on purpose", () => {
    // It removes a trigger, so it is the costliest control on the card to hit by
    // accident and the worst to miss. 24x24 is the accessibility floor; the
    // visible ring stays small, and the difference is transparent padding.
    renderNode({
      id: TRIGGER_NODE_ID,
      data: TRIGGER,
      onTriggerDelete: vi.fn(),
    });
    const button = screen.getByTestId("wf-trigger-delete");
    expect(button.className).toContain("h-6");
    expect(button.className).toContain("w-6");
  });

  it("reports the trigger node it stands for without also opening it", () => {
    const onTriggerDelete = vi.fn();
    const onNodeClick = vi.fn();
    render(
      <ReactFlowProvider>
        <NodeProblemsContext.Provider value={new Map()}>
          <TriggerDeleteContext.Provider value={onTriggerDelete}>
            {/* React Flow hangs `onNodeClick` on the wrapper it puts around a
                node, so a control inside the card fires BOTH unless the click
                is stopped — removing a trigger must not also select it. */}
            <div onClick={onNodeClick}>
              <WorkflowNode
                {...({
                  id: "trigger:1",
                  data: TRIGGER,
                } as WorkflowNodeProps)}
              />
            </div>
          </TriggerDeleteContext.Provider>
        </NodeProblemsContext.Provider>
      </ReactFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("wf-trigger-delete"));
    expect(onTriggerDelete).toHaveBeenCalledWith("trigger:1");
    expect(onNodeClick).not.toHaveBeenCalled();
  });
});

/** The edge, inside the wrapper React Flow hangs `onEdgeClick` on — which is
 *  what a press inside the label PORTAL reaches through the component tree. */
function renderEdge({
  data,
  onInsert = null,
  onEdgeClick,
  nodes = [],
}: {
  data: Record<string, unknown>;
  onInsert?: ((source: string, target: string) => void) | null;
  onEdgeClick?: () => void;
  /** Laid-out cards the edge has to route around. The renderer reads them from
   *  React Flow's own store, so they are seeded through the provider. */
  nodes?: { id: string; position: { x: number; y: number }; width: number; height: number }[];
}) {
  return render(
    <ReactFlowProvider>
      <NodeBoxesContext.Provider
        value={nodes.map((n) => ({
          x: n.position.x,
          y: n.position.y,
          width: n.width,
          height: n.height,
        }))}
      >
      <EdgeInsertContext.Provider value={onInsert}>
        <div onClick={onEdgeClick}>
          <WfEdgeRenderer
            {...({
              id: `${actionNodeId(0)}->${actionNodeId(1)}`,
              source: actionNodeId(0),
              target: actionNodeId(1),
              sourceX: 0,
              sourceY: 0,
              targetX: 100,
              targetY: 0,
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
              data,
            } as Parameters<typeof WfEdgeRenderer>[0])}
          />
        </div>
      </EdgeInsertContext.Provider>
      </NodeBoxesContext.Provider>
    </ReactFlowProvider>,
  );
}

describe("an edge's authoring furniture", () => {
  it("draws nothing extra on a plain edge", () => {
    renderEdge({ data: { kind: "spine" } });
    expect(screen.queryByTestId("wf-edge-insert")).toBeNull();
    expect(screen.queryByTestId("wf-edge-problem")).toBeNull();
  });

  it("offers the insert control, naming the pair it sits between", () => {
    const onInsert = vi.fn();
    renderEdge({ data: { kind: "spine", insertable: true }, onInsert });
    fireEvent.click(screen.getByTestId("wf-edge-insert"));
    expect(onInsert).toHaveBeenCalledWith(actionNodeId(0), actionNodeId(1));
  });

  it("inserts without also asking to edit the edge's guard", () => {
    // The label layer is a PORTAL: a React synthetic event bubbles through the
    // COMPONENT tree, not the DOM one, so the press reaches the edge wrapper
    // React Flow hangs `onEdgeClick` on. Unstopped, one press both inserted a
    // step and opened the guard editor.
    const onEdgeClick = vi.fn();
    const onInsert = vi.fn();
    renderEdge({
      data: { kind: "spine", insertable: true },
      onInsert,
      onEdgeClick,
    });
    fireEvent.click(screen.getByTestId("wf-edge-insert"));
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onEdgeClick).not.toHaveBeenCalled();
  });

  it("draws no control when the decoration outlives its handler", () => {
    // The two are set together by the component. Requiring both means a stale
    // edge — one styled on a previous tick — can never draw a button that does
    // nothing when pressed.
    renderEdge({ data: { kind: "spine", insertable: true }, onInsert: null });
    expect(screen.queryByTestId("wf-edge-insert")).toBeNull();
  });

  it("states the problem on the edge, with every message on the chip", () => {
    renderEdge({
      data: {
        kind: "spine",
        problems: [
          {
            anchor: "edge",
            from: actionNodeId(0),
            to: actionNodeId(1),
            severity: "error",
            message: "a1 cannot depend on a0",
          },
        ],
      },
    });
    const chip = screen.getByTestId("wf-edge-problem");
    expect(chip.dataset.severity).toBe("error");
    expect(chip.textContent).toContain("a1 cannot depend on a0");
  });

  it("puts an edge's every message in the accessibility tree too", () => {
    renderEdge({
      data: {
        kind: "spine",
        problems: [
          { anchor: "edge", from: actionNodeId(0), to: actionNodeId(1), severity: "warning", message: "first" },
          { anchor: "edge", from: actionNodeId(0), to: actionNodeId(1), severity: "error", message: "second" },
        ],
      },
    });
    const chip = screen.getByTestId("wf-edge-problem");
    expect(chip.textContent).toContain("first");
    expect(chip.textContent).toContain("second");
  });

  it("summarizes several, keeping each message readable on hover", () => {
    renderEdge({
      data: {
        kind: "spine",
        problems: [
          {
            anchor: "edge",
            from: actionNodeId(0),
            to: actionNodeId(1),
            severity: "warning",
            message: "first",
          },
          {
            anchor: "edge",
            from: actionNodeId(0),
            to: actionNodeId(1),
            severity: "error",
            message: "second",
          },
        ],
      },
    });
    const chip = screen.getByTestId("wf-edge-problem");
    expect(chip.dataset.severity).toBe("error");
    expect(chip.querySelector("[aria-hidden]")?.textContent).toBe("2 problems");
    expect(chip.title).toBe("Warning: first\nError: second");
  });

  it("nudges the control off a card its midpoint lands on", () => {
    // This edge's midpoint is (50, 0) — inside the card below, which is what an
    // edge SPANNING a layer does: it runs through the layer it skips, so the
    // reserved corridor (which only widens the gap between adjacent layers)
    // cannot clear it. Without the nudge the control sits on an unrelated node.
    const covering = {
      id: "a1",
      position: { x: 0, y: -40 },
      width: 100,
      height: 80,
    };
    const { container } = renderEdge({
      data: { kind: "spine", insertable: true },
      onInsert: vi.fn(),
      nodes: [covering],
    });
    const cluster = container.querySelector<HTMLElement>(".nodrag.nopan");
    // Shifted off the card along the CROSS axis, so it stays beside its own edge.
    const shifted = /translate\(50px, (-?\d+(?:\.\d+)?)px\)/.exec(
      cluster?.style.transform ?? "",
    );
    expect(shifted).not.toBeNull();
    const y = Number(shifted?.[1]);
    const inside = y >= covering.position.y && y <= covering.position.y + covering.height;
    expect(inside).toBe(false);
  });

  it("moves a problem chip off a card as well, since its tooltip takes the pointer", () => {
    // The chip opts into pointer events so its messages are reachable, which
    // means that over a card it also swallows clicks meant for the node. A
    // problems-only edge gets no wider corridor either — the problems change on
    // every keystroke of an invalid draft, and reserving a lane for them would
    // relayout the canvas while the author types.
    const covering = { id: "a1", position: { x: 0, y: -40 }, width: 100, height: 80 };
    const { container } = renderEdge({
      data: {
        kind: "spine",
        problems: [
          { anchor: "edge", from: actionNodeId(0), to: actionNodeId(1), severity: "error", message: "bad" },
        ],
      },
      nodes: [covering],
    });
    const shifted = /translate\(50px, (-?\d+(?:\.\d+)?)px\)/.exec(
      container.querySelector<HTMLElement>(".nodrag.nopan")?.style.transform ?? "",
    );
    expect(Number(shifted?.[1])).not.toBe(0);
  });

  it("leaves a pointer-transparent cluster where it is", () => {
    // A guard chip is a readout that lets clicks through, so it costs nothing
    // over a card — and moving every annotation would scatter a dense graph.
    const covering = { id: "a1", position: { x: 0, y: -40 }, width: 100, height: 80 };
    const { container } = renderEdge({
      data: { kind: "spine", whenLabel: "risk == high" },
      nodes: [covering],
    });
    expect(
      container.querySelector<HTMLElement>(".nodrag.nopan")?.style.transform,
    ).toContain("translate(50px, 0px)");
  });

  it("sizes the cluster by what it carries, not by its smallest member", () => {
    // This card sits 20 units off the label point on the flow axis: clear of a
    // 20px control, well inside a chip that truncates at 160. Sized as if it
    // were the control, the chip would be left lapping over the card.
    const nearby = { id: "a1", position: { x: 70, y: -40 }, width: 100, height: 80 };
    const shift = (data: Record<string, unknown>) => {
      const { container } = renderEdge({ data, onInsert: vi.fn(), nodes: [nearby] });
      const m = /translate\(50px, (-?\d+(?:\.\d+)?)px\)/.exec(
        container.querySelector<HTMLElement>(".nodrag.nopan")?.style.transform ?? "",
      );
      cleanup();
      return Number(m?.[1]);
    };
    expect(shift({ kind: "spine", insertable: true })).toBe(0);
    expect(
      shift({
        kind: "spine",
        insertable: true,
        problems: [
          { anchor: "edge", from: actionNodeId(0), to: actionNodeId(1), severity: "error", message: "bad" },
        ],
      }),
    ).not.toBe(0);
  });

  it("leaves the control on the line when nothing is in the way", () => {
    const { container } = renderEdge({
      data: { kind: "spine", insertable: true },
      onInsert: vi.fn(),
    });
    expect(
      container.querySelector<HTMLElement>(".nodrag.nopan")?.style.transform,
    ).toContain("translate(50px, 0px)");
  });

  it("lifts its cluster past the nodes, so a long edge's control is pressable", () => {
    // Pinned by value, because jsdom has no layout and cannot catch a stacking
    // regression — the same reason the connectable handle's `!z-10` is pinned by
    // name in WorkflowNode.test.tsx. React Flow lays the label layer out BEFORE
    // the node layer at the same painting level, so without this a node covers
    // whatever a label puts under it: an edge spanning more than one layer has
    // its midpoint inside the layer it skips, i.e. on a card. Verified with a
    // live-browser hit-test.
    const { container } = renderEdge({
      data: { kind: "spine", insertable: true },
      onInsert: vi.fn(),
    });
    const cluster = container.querySelector<HTMLElement>(".nodrag.nopan");
    expect(cluster?.style.zIndex).toBe("1");
  });

  it("keeps what must be hovered or pressed reachable through the label layer", () => {
    // React Flow's label layer is `pointer-events: none`, so anything meant to
    // be hovered or pressed has to opt back in — without it the tooltip never
    // opens and the button never receives a click. Only these two do: the
    // cluster is raised over the nodes, so a chip that opted in would swallow
    // clicks meant for whatever card it lands on.
    renderEdge({
      data: {
        kind: "spine",
        insertable: true,
        whenLabel: "risk == high",
        problems: [
          {
            anchor: "edge",
            from: actionNodeId(0),
            to: actionNodeId(1),
            severity: "error",
            message: "bad",
          },
        ],
      },
      onInsert: vi.fn(),
    });
    for (const id of ["wf-edge-insert", "wf-edge-problem"]) {
      expect(screen.getByTestId(id).className).toContain("pointer-events-auto");
    }
  });
});

describe("decorateAuthoringEdges", () => {
  const styled = (id: string, source: string, target: string): WfFlowEdge => ({
    id,
    source,
    target,
    type: "smoothstep",
    data: { kind: "spine" },
    style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.75 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--muted-foreground))" },
  });
  const none = () => false;

  it("returns the same edges when there is nothing to decorate", () => {
    const edges = [styled("a0->a1", "a0", "a1")];
    // Identity, not equality: a fresh array per render would re-seed React Flow's
    // edge state on every tick that touches this memo.
    expect(decorateAuthoringEdges(edges, new Map(), none, false)).toBe(edges);
  });

  it("moves an edge onto the decorating renderer once it carries a problem", () => {
    const edge = styled("a0->a1", "a0", "a1");
    const [decorated] = decorateAuthoringEdges(
      [edge],
      indexProblems([
        { anchor: "edge", from: "a0", to: "a1", severity: "error", message: "bad" },
      ]).byEdge,
      none,
      false,
    );
    expect(decorated.type).toBe(WF_EDGE_TYPE);
    expect(decorated.data?.problems).toHaveLength(1);
    // Recoloured, because a chip alone is unreadable at the zoom a whole
    // pipeline is read at.
    expect(decorated.style?.stroke).toBe("var(--surface-danger-text)");
    expect(decorated.markerEnd).toMatchObject({ color: "var(--surface-danger-text)" });
    // The unrelated styling it arrived with survives.
    expect(decorated.style?.strokeWidth).toBe(1.75);
  });

  it("colours a warning apart from an error", () => {
    const [decorated] = decorateAuthoringEdges(
      [styled("a0->a1", "a0", "a1")],
      indexProblems([
        { anchor: "edge", from: "a0", to: "a1", severity: "warning", message: "hm" },
      ]).byEdge,
      none,
      false,
    );
    expect(decorated.style?.stroke).toBe("var(--surface-warning-text)");
  });

  it("marks only the edges the predicate accepts as insertable", () => {
    const [spine, fork] = decorateAuthoringEdges(
      [styled("a0->a1", "a0", "a1"), styled("a1->a1-b0", "a1", "a1-b0")],
      new Map(),
      (e) => e.id === "a0->a1",
      false,
    );
    expect(spine.data?.insertable).toBe(true);
    expect(spine.type).toBe(WF_EDGE_TYPE);
    // An edge the host cannot insert on keeps the built-in renderer, so it
    // cannot draw the control at all.
    expect(fork.data?.insertable).toBeUndefined();
    expect(fork.type).toBe("smoothstep");
  });

  it("lets a RUN keep the colour of its own line, and still says what is wrong", () => {
    // The same precedence the node card uses, where a run border wins over a
    // problem border. A host showing both would otherwise lose which edge is
    // running — so the run keeps the line and the problem keeps the chip.
    const running = styled("a0->a1", "a0", "a1");
    running.style = { stroke: "hsl(var(--primary))" };
    const [decorated] = decorateAuthoringEdges(
      [running],
      indexProblems([
        { anchor: "edge", from: "a0", to: "a1", severity: "error", message: "bad" },
      ]).byEdge,
      none,
      true,
    );
    expect(decorated.style?.stroke).toBe("hsl(var(--primary))");
    expect(decorated.data?.problems).toHaveLength(1);
    expect(decorated.type).toBe(WF_EDGE_TYPE);
  });

  it("colours the line from the problem when there is no run to speak for it", () => {
    const [decorated] = decorateAuthoringEdges(
      [styled("a0->a1", "a0", "a1")],
      indexProblems([
        { anchor: "edge", from: "a0", to: "a1", severity: "error", message: "bad" },
      ]).byEdge,
      none,
      false,
    );
    expect(decorated.style?.stroke).toBe("var(--surface-danger-text)");
  });
});
