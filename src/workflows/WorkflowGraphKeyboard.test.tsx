// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Keyboard activation of a node.
 *
 * React Flow makes a node TABBABLE but gives it no activation key, so without
 * this a keyboard user could reach every node and open none of them — the
 * detail panel was mouse-only. `onNodeClick` has no keyboard counterpart to
 * hang the behaviour on, so the graph handles the key on its wrapper and
 * resolves the node from the focused element.
 *
 * React Flow is stubbed (as elsewhere in this suite) because it measures a real
 * viewport jsdom does not have. The handler is the thing under test, and it is
 * exercised with the DOM shape React Flow actually renders: the focused element
 * sits inside `.react-flow__node[data-id]`.
 */
type FlowProps = {
  onKeyDown?: (event: {
    key: string;
    target: EventTarget | null;
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => void;
  nodes?: { id: string }[];
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
`;

/** The DOM React Flow renders around a node, with the key landing on a child —
 *  a focused node's event target is the node's own content, not the wrapper. */
function focusedNode(id: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "react-flow__node";
  wrapper.setAttribute("data-id", id);
  const inner = document.createElement("div");
  wrapper.appendChild(inner);
  document.body.appendChild(wrapper);
  return inner;
}

/** A key press on `target`, shaped as React hands it to onKeyDown. Returns the
 *  two "we consumed this" signals so a test can assert they fire on the
 *  activation path AND stay untouched on every path that ignores the key. */
function press(key: string, target: EventTarget | null) {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  flowProps.onKeyDown?.({ key, target, preventDefault, stopPropagation });
  return { preventDefault, stopPropagation };
}

describe("keyboard node activation", () => {
  it("opens a node's detail on Enter and on Space", () => {
    for (const key of ["Enter", " "]) {
      cleanup();
      const onNodeClick = vi.fn();
      render(<WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />);
      press(key, focusedNode("a0"));
      expect(onNodeClick).toHaveBeenCalledTimes(1);
      // The node's data rides along, exactly as the click path delivers it.
      expect(onNodeClick.mock.calls[0][0]).toBe("a0");
      expect(onNodeClick.mock.calls[0][1]).toMatchObject({ kind: "notify" });
    }
  });

  it("stops the page scrolling out from under a Space press", () => {
    // Space is the page-scroll key; activating a node must consume it.
    const onNodeClick = vi.fn();
    render(<WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />);
    expect(press(" ", focusedNode("a0")).preventDefault).toHaveBeenCalled();
  });

  it("ignores keys that are not activation keys", () => {
    const onNodeClick = vi.fn();
    render(<WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />);
    const node = focusedNode("a0");
    for (const key of ["a", "Tab", "Escape", "ArrowRight"]) {
      const consumed = press(key, node);
      // A key we do not act on must reach the page untouched.
      expect(consumed.preventDefault).not.toHaveBeenCalled();
      expect(consumed.stopPropagation).not.toHaveBeenCalled();
    }
    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it("ignores a press that did not come from a node", () => {
    // The canvas has chrome — controls, the density toggle, edge labels — and
    // Enter on any of it must not open whatever node happens to be first.
    const onNodeClick = vi.fn();
    render(<WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />);
    const loose = document.createElement("button");
    document.body.appendChild(loose);
    for (const target of [loose, null]) {
      const consumed = press("Enter", target);
      // Swallowing here would eat Enter/Space from the canvas chrome and the
      // page around it — the regression that would otherwise pass unnoticed.
      expect(consumed.preventDefault).not.toHaveBeenCalled();
      expect(consumed.stopPropagation).not.toHaveBeenCalled();
    }
    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it("ignores a node id the graph does not have", () => {
    const onNodeClick = vi.fn();
    render(<WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />);
    const consumed = press("Enter", focusedNode("a99"));
    expect(onNodeClick).not.toHaveBeenCalled();
    expect(consumed.preventDefault).not.toHaveBeenCalled();
    expect(consumed.stopPropagation).not.toHaveBeenCalled();
  });

  it("arms no key handler when the host has no click handler", () => {
    // Nothing to activate INTO: a graph without onNodeClick is a diagram, and
    // it must not swallow Enter/Space from the page.
    render(<WorkflowGraph yaml={YAML} />);
    expect(flowProps.onKeyDown).toBeUndefined();
  });
});

describe("keyboard activation consumes the key", () => {
  it("stops an activated key reaching the host around the graph", () => {
    // Once the press has opened a node it is spent. A host that submits a form
    // on Enter must not also see it — the user meant "open this node".
    const onNodeClick = vi.fn();
    render(<WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />);
    const consumed = press("Enter", focusedNode("a0"));
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    expect(consumed.preventDefault).toHaveBeenCalled();
    expect(consumed.stopPropagation).toHaveBeenCalled();
  });
});
