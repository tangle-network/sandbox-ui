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
      hasBranches: false,
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
