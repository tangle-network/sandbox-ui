// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The EDITING wiring: which React Flow gestures the graph arms, and which edges
 * it lets through to the host.
 *
 * `isEditableEdge` is unit-tested on its own; what this covers is that the
 * component actually CONSULTS it — a handler that forwarded every edge would
 * pass those unit tests untouched while asking the host to delete fan-out and
 * trigger edges that exist in no definition.
 *
 * React Flow is stubbed (as in WorkflowGraphFitView.test.tsx) because it
 * measures a real viewport jsdom does not have, and it is not the thing under
 * test. Capturing the props the component hands it IS the observation: the
 * gesture gates are props, and the handlers can be invoked directly with the
 * edge shapes React Flow would deliver.
 */
type FlowProps = {
  nodesConnectable?: boolean;
  edgesFocusable?: boolean;
  deleteKeyCode?: string[] | null;
  onConnect?: (c: { source: string | null; target: string | null }) => void;
  onEdgesDelete?: (edges: { source: string; target: string; data?: unknown }[]) => void;
  onEdgeClick?: (
    e: unknown,
    edge: { source: string; target: string; data?: unknown },
  ) => void;
  onConnectEnd?: (e: unknown, state: unknown) => void;
  edges?: {
    id: string;
    type?: string;
    deletable?: boolean;
    data?: { kind?: string; insertable?: boolean };
  }[];
};

let flowProps: FlowProps = {};

/** The graph's frame, as the browser would report it. jsdom measures nothing, so
 *  a release-position gate has no box to test against until one is supplied. */
const FRAME = { left: 100, top: 100, right: 900, bottom: 500 };
/** What sits under the pointer at release. `null` is empty canvas. */
let elementAtPoint: Element | null = null;

function stubCanvasGeometry() {
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value(this: HTMLElement) {
      return this.classList.contains("wf-graph")
        ? {
            ...FRAME,
            width: FRAME.right - FRAME.left,
            height: FRAME.bottom - FRAME.top,
            x: FRAME.left,
            y: FRAME.top,
            toJSON: () => ({}),
          }
        : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
    },
  });
  document.elementFromPoint = () => elementAtPoint;
}

/** A pointer release at a viewport position, shaped as React Flow delivers it. */
function releaseAt(x: number, y: number): MouseEvent {
  return new MouseEvent("mouseup", { clientX: x, clientY: y });
}

/** Somewhere inside the frame with nothing under it. */
const ON_CANVAS = releaseAt(400, 300);

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    ReactFlow: (props: FlowProps) => {
      flowProps = props;
      return <div data-testid="flow" />;
    },
  };
});

const { WorkflowGraph } = await import("./WorkflowGraph");
const { actionNodeId, TRIGGER_NODE_ID } = await import("./model");

beforeEach(() => {
  stubCanvasGeometry();
  elementAtPoint = null;
});

afterEach(() => {
  cleanup();
  flowProps = {};
});

const YAML = `
on:
  webhook: {}
do:
  - notify:
      url: https://example.com/a
  - notify:
      url: https://example.com/b
  - parallel:
      branches:
        - notify:
            url: https://example.com/c
`;

const DECLARED = [
  { from: actionNodeId(0), to: actionNodeId(1) },
  { from: actionNodeId(1), to: actionNodeId(2) },
];

/** The three edge shapes React Flow can hand a delete/click handler. */
const declaredEdge = {
  source: actionNodeId(0),
  target: actionNodeId(1),
  data: { kind: "spine" },
};
const forkEdge = {
  source: actionNodeId(2),
  target: `${actionNodeId(2)}-b0`,
  data: { kind: "fork" },
};
const triggerEdge = {
  source: TRIGGER_NODE_ID,
  target: actionNodeId(0),
  data: { kind: "spine" },
};

describe("WorkflowGraph editing gates", () => {
  it("arms nothing without editing callbacks", () => {
    render(<WorkflowGraph yaml={YAML} edges={DECLARED} />);
    expect(flowProps.nodesConnectable).toBe(false);
    expect(flowProps.edgesFocusable).toBe(false);
    // Null, not a key list: with onNodesChange/onEdgesChange wired for
    // measurement, an armed delete key would strip elements from a read-only view.
    expect(flowProps.deleteKeyCode).toBeNull();
    expect(flowProps.onConnect).toBeUndefined();
    expect(flowProps.onEdgesDelete).toBeUndefined();
    expect(flowProps.onEdgeClick).toBeUndefined();
    expect(flowProps.onConnectEnd).toBeUndefined();
  });

  it("arms the edge gestures once onEdgeConnect is supplied", () => {
    render(
      <WorkflowGraph yaml={YAML} edges={DECLARED} onEdgeConnect={vi.fn()} />,
    );
    expect(flowProps.nodesConnectable).toBe(true);
    expect(flowProps.edgesFocusable).toBe(true);
    expect(flowProps.deleteKeyCode).toEqual(["Backspace", "Delete"]);
  });

  it("never lets an edge be deleted on a read-only canvas", () => {
    // The disarmed delete key already prevents this, but the elements say it
    // themselves too — the same stance nodes take. Resting on one gate alone
    // leaves read-only-ness depending on a prop nobody can see from the edge.
    render(<WorkflowGraph yaml={YAML} edges={DECLARED} />);
    expect(flowProps.edges?.length).toBeGreaterThan(0);
    expect(flowProps.edges?.every((e) => e.deletable === false)).toBe(true);
  });

  it("never lets a node be deleted, in either mode", () => {
    // React Flow deletes a selected node together with every edge touching it,
    // so a deletable node on an armed canvas would report edge removals the
    // host never asked for. A node is a `do` entry — a list edit, not a gesture.
    for (const props of [{}, { onEdgeConnect: vi.fn() }]) {
      cleanup();
      const { container } = render(
        <WorkflowGraph yaml={YAML} edges={DECLARED} {...props} />,
      );
      expect(container).toBeTruthy();
      const nodes = (flowProps as unknown as { nodes?: { deletable?: boolean }[] })
        .nodes;
      expect(nodes?.length).toBeGreaterThan(0);
      expect(nodes?.every((n) => n.deletable === false)).toBe(true);
    }
  });
});

describe("WorkflowGraph edge gestures reach the host only for declared edges", () => {
  it("forwards a delete for a declared edge and swallows fork/trigger", () => {
    const onEdgeDelete = vi.fn();
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeConnect={vi.fn()}
        onEdgeDelete={onEdgeDelete}
      />,
    );
    // Exactly what React Flow hands the handler when a selection is deleted.
    flowProps.onEdgesDelete?.([declaredEdge, forkEdge, triggerEdge]);
    expect(onEdgeDelete).toHaveBeenCalledTimes(1);
    expect(onEdgeDelete).toHaveBeenCalledWith(
      actionNodeId(0),
      actionNodeId(1),
    );
  });

  it("forwards a click for a declared edge and swallows fork/trigger", () => {
    const onEdgeClick = vi.fn();
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeConnect={vi.fn()}
        onEdgeClick={onEdgeClick}
      />,
    );
    flowProps.onEdgeClick?.(null, forkEdge);
    flowProps.onEdgeClick?.(null, triggerEdge);
    expect(onEdgeClick).not.toHaveBeenCalled();
    flowProps.onEdgeClick?.(null, declaredEdge);
    expect(onEdgeClick).toHaveBeenCalledWith(actionNodeId(0), actionNodeId(1));
  });

  it("marks only declared edges deletable, so the key never reaches the others", () => {
    render(
      <WorkflowGraph yaml={YAML} edges={DECLARED} onEdgeConnect={vi.fn()} />,
    );
    const byId = new Map(flowProps.edges?.map((e) => [e.id, e]) ?? []);
    expect(byId.size).toBeGreaterThan(0);
    expect(byId.get(`${actionNodeId(0)}->${actionNodeId(1)}`)?.deletable).toBe(
      true,
    );
    expect(
      byId.get(`${TRIGGER_NODE_ID}->${actionNodeId(0)}`)?.deletable,
    ).toBe(false);
    expect(
      byId.get(`${actionNodeId(2)}->${actionNodeId(2)}-b0`)?.deletable,
    ).toBe(false);
  });

  it("reports a connection only when both ends resolved", () => {
    const onEdgeConnect = vi.fn();
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeConnect={onEdgeConnect}
      />,
    );
    // React Flow types a Connection's ends as nullable; a drag released over
    // empty canvas must not be reported as an edit.
    flowProps.onConnect?.({ source: null, target: actionNodeId(1) });
    flowProps.onConnect?.({ source: actionNodeId(0), target: null });
    expect(onEdgeConnect).not.toHaveBeenCalled();
    flowProps.onConnect?.({ source: actionNodeId(0), target: actionNodeId(1) });
    expect(onEdgeConnect).toHaveBeenCalledWith(
      actionNodeId(0),
      actionNodeId(1),
    );
  });
});

/**
 * The Phase-4 authoring gestures at the FLOW level: which of them the component
 * arms, and on which edges. What each one renders is covered next door in
 * WorkflowGraphAuthoring.test.tsx, against the real node and edge components.
 */
describe("WorkflowGraph add-step gestures", () => {
  it("stays inert without onEdgeConnect — the one prop that makes an editor", () => {
    // Every other editing callback REFINES an editor. A canvas that cannot
    // accept a connection must not draw an add control either, or the user is
    // offered a step it has nowhere to attach.
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeInsert={vi.fn()}
        onNodeInsert={vi.fn()}
        onTriggerAdd={vi.fn()}
        onTriggerDelete={vi.fn()}
      />,
    );
    expect(flowProps.onConnectEnd).toBeUndefined();
    expect(flowProps.edges?.some((e) => e.data?.insertable)).toBe(false);
  });

  it("offers the insert control on exactly the edges the host may change", () => {
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeConnect={vi.fn()}
        onEdgeInsert={vi.fn()}
      />,
    );
    const byId = new Map(flowProps.edges?.map((e) => [e.id, e]) ?? []);
    const declared = byId.get(`${actionNodeId(0)}->${actionNodeId(1)}`);
    expect(declared?.data?.insertable).toBe(true);
    // Both of these are edges no definition has a row for: one is the fan-out a
    // structural step's own config produces, the other is what "nothing points
    // at this node" renders as. Inserting BETWEEN either pair names nothing.
    expect(
      byId.get(`${TRIGGER_NODE_ID}->${actionNodeId(0)}`)?.data?.insertable,
    ).toBeUndefined();
    expect(
      byId.get(`${actionNodeId(2)}->${actionNodeId(2)}-b0`)?.data?.insertable,
    ).toBeUndefined();
  });

  it("reports a drop on empty canvas as an add beside the node it left", () => {
    const onNodeInsert = vi.fn();
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeConnect={vi.fn()}
        onNodeInsert={onNodeInsert}
      />,
    );
    // Released over nothing, from the outbound handle: the new step FOLLOWS.
    flowProps.onConnectEnd?.(ON_CANVAS, {
      fromNode: { id: actionNodeId(1) },
      fromHandle: { type: "source" },
      toNode: null,
      toHandle: null,
    });
    expect(onNodeInsert).toHaveBeenCalledWith(actionNodeId(1), "after");
    // From the inbound handle it PRECEDES — which is the only way to add a step
    // at the very start, since the trigger edge offers no insert.
    flowProps.onConnectEnd?.(ON_CANVAS, {
      fromNode: { id: actionNodeId(0) },
      fromHandle: { type: "target" },
      toNode: null,
      toHandle: null,
    });
    expect(onNodeInsert).toHaveBeenCalledWith(actionNodeId(0), "before");
  });

  it("never reads an ABANDONED drag as an add", () => {
    // React Flow ends the drag on a document-level pointer-up, so letting go
    // anywhere on the page reaches this callback — and pulling away from the
    // graph is exactly how someone abandons a gesture they thought better of.
    // Reproduced in a browser before the gate existed: releasing outside the
    // graph, on the zoom controls and on the panel each added a step.
    const onNodeInsert = vi.fn();
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeConnect={vi.fn()}
        onNodeInsert={onNodeInsert}
      />,
    );
    const drag = { fromNode: { id: actionNodeId(1) }, fromHandle: { type: "source" }, toNode: null, toHandle: null };

    // Let go past every side of the frame.
    for (const [x, y] of [[400, 40], [400, 560], [40, 300], [960, 300]]) {
      flowProps.onConnectEnd?.(releaseAt(x, y), drag);
    }
    expect(onNodeInsert).not.toHaveBeenCalled();

    // Let go on the canvas's own furniture — inside the frame, but on a control.
    const panel = document.createElement("div");
    panel.className = "react-flow__panel";
    const button = document.createElement("button");
    panel.appendChild(button);
    elementAtPoint = button;
    flowProps.onConnectEnd?.(ON_CANVAS, drag);
    expect(onNodeInsert).not.toHaveBeenCalled();

    const controls = document.createElement("div");
    controls.className = "react-flow__controls";
    elementAtPoint = controls;
    flowProps.onConnectEnd?.(ON_CANVAS, drag);
    expect(onNodeInsert).not.toHaveBeenCalled();

    // The same drag, let go on the canvas itself, still adds — so the gate is
    // rejecting the release POSITION and not the gesture.
    elementAtPoint = null;
    flowProps.onConnectEnd?.(ON_CANVAS, drag);
    expect(onNodeInsert).toHaveBeenCalledWith(actionNodeId(1), "after");
  });

  it("needs both ends of the drag before it names an add", () => {
    // A release that reports no node, or no handle it left from, names nothing
    // to insert beside — and defaulting a missing handle to "after" would put a
    // step on the wrong side of the one node it did name.
    const onNodeInsert = vi.fn();
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeConnect={vi.fn()}
        onNodeInsert={onNodeInsert}
      />,
    );
    flowProps.onConnectEnd?.(ON_CANVAS, {
      fromNode: null,
      fromHandle: null,
      toNode: null,
      toHandle: null,
    });
    flowProps.onConnectEnd?.(ON_CANVAS, {
      fromNode: { id: actionNodeId(1) },
      fromHandle: null,
      toNode: null,
      toHandle: null,
    });
    expect(onNodeInsert).not.toHaveBeenCalled();
  });

  it("never reads a completed connection as an add", () => {
    // React Flow fires onConnectEnd at the end of EVERY connection drag,
    // including the ones that landed on a handle and already went out through
    // onConnect. Reporting those too would add a step for every edge drawn.
    const onNodeInsert = vi.fn();
    render(
      <WorkflowGraph
        yaml={YAML}
        edges={DECLARED}
        onEdgeConnect={vi.fn()}
        onNodeInsert={onNodeInsert}
      />,
    );
    flowProps.onConnectEnd?.(ON_CANVAS, {
      fromNode: { id: actionNodeId(0) },
      fromHandle: { type: "source" },
      toNode: { id: actionNodeId(1) },
      toHandle: { type: "target" },
    });
    // Released over a node's BODY, short of its handle: still not an add — the
    // user was aiming at that node, not at the canvas behind it.
    flowProps.onConnectEnd?.(ON_CANVAS, {
      fromNode: { id: actionNodeId(0) },
      fromHandle: { type: "source" },
      toNode: { id: actionNodeId(1) },
      toHandle: null,
    });
    expect(onNodeInsert).not.toHaveBeenCalled();
  });
});
