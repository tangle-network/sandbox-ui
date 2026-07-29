// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkflowGraph } from "./WorkflowGraph";

/**
 * The EVENT PATH, against the real React Flow.
 *
 * The sibling keyboard suite stubs React Flow and tests the handler's logic:
 * which keys it acts on, which targets it ignores, what it consumes. That
 * proves nothing about whether a keydown from a focused node actually REACHES
 * the handler — the wiring rests on React Flow forwarding unknown props onto
 * its wrapper and on the node living inside that wrapper's subtree. If it ever
 * portalled node content elsewhere, or stopped keydown at an intermediate
 * element, the feature would be dead in the browser with every stubbed test
 * still green.
 *
 * So this file uses NO mock. It renders the real component, finds the node DOM
 * React Flow actually produced, and dispatches a real keydown on it.
 */
afterEach(cleanup);

const YAML = `
on:
  webhook: {}
do:
  - notify:
      url: https://example.com/a
  - notify:
      url: https://example.com/b
`;

describe("keyboard activation reaches the handler through real React Flow", () => {
  it("renders nodes that are focusable in the first place", () => {
    // The premise of the whole fix: React Flow makes a node tabbable but gives
    // it no activation key. If nodes ever stop being focusable, keyboard
    // activation is moot and this suite should say so loudly.
    const { container } = render(<WorkflowGraph yaml={YAML} />);
    const nodes = container.querySelectorAll(".react-flow__node");
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node.getAttribute("tabindex")).toBe("0");
      expect(node.getAttribute("data-id")).toBeTruthy();
    }
  });

  it("opens the node a real Enter keydown lands on", () => {
    const onNodeClick = vi.fn();
    const { container } = render(
      <WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />,
    );
    const node = container.querySelector<HTMLElement>(
      '.react-flow__node[data-id="a0"]',
    );
    expect(node).toBeTruthy();
    if (!node) return;
    fireEvent.keyDown(node, { key: "Enter", bubbles: true });
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    expect(onNodeClick.mock.calls[0][0]).toBe("a0");
  });

  it("opens it from a keydown on the node's CONTENT, not just its wrapper", () => {
    // A focused node's event target is whatever inside it holds focus, so the
    // handler resolves via closest(). This is the path a real user takes.
    const onNodeClick = vi.fn();
    const { container } = render(
      <WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />,
    );
    const inner = container.querySelector<HTMLElement>(
      '.react-flow__node[data-id="a0"] *',
    );
    expect(inner).toBeTruthy();
    if (!inner) return;
    fireEvent.keyDown(inner, { key: " ", bubbles: true });
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    expect(onNodeClick.mock.calls[0][0]).toBe("a0");
  });

  it("leaves a keydown from outside any node alone", () => {
    const onNodeClick = vi.fn();
    const { container } = render(
      <WorkflowGraph yaml={YAML} onNodeClick={onNodeClick} />,
    );
    const pane = container.querySelector<HTMLElement>(".react-flow__pane");
    if (pane) fireEvent.keyDown(pane, { key: "Enter", bubbles: true });
    expect(onNodeClick).not.toHaveBeenCalled();
  });
});
