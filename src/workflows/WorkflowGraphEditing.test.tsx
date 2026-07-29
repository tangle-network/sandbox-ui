// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  edges?: { id: string; deletable?: boolean; data?: { kind?: string } }[];
};

let flowProps: FlowProps = {};

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
  });

  it("arms the edge gestures once onEdgeConnect is supplied", () => {
    render(
      <WorkflowGraph yaml={YAML} edges={DECLARED} onEdgeConnect={vi.fn()} />,
    );
    expect(flowProps.nodesConnectable).toBe(true);
    expect(flowProps.edgesFocusable).toBe(true);
    expect(flowProps.deleteKeyCode).toEqual(["Backspace", "Delete"]);
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
