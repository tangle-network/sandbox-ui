// @vitest-environment jsdom
import { type Node, type NodeProps, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { WfNodeData } from "./model";
import { WorkflowNode } from "./WorkflowGraph";

afterEach(cleanup);

const BASE: WfNodeData = {
  title: "Run agent",
  kind: "agent.run",
  hasBranches: false,
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

  it("shows the static badge and no run status when there is no state", () => {
    renderNode({ ...BASE, badge: "×3", state: undefined });
    expect(screen.getByText("×3")).toBeTruthy();
    expect(screen.queryByText("Running")).toBeNull();
    expect(screen.queryByText("Done")).toBeNull();
  });
});
