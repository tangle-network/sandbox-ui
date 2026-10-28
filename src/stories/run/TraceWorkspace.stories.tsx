import { useState } from "react";
import { waitFor } from "@testing-library/dom";
import type { Meta, StoryObj } from "@storybook/react";
import type { FlowSpan, FlowTrace } from "@tangle-network/charts";
import { TraceWorkspace, type TraceWorkspaceProps } from "../../run";
// The host imports the waterfall's stylesheet once, as the TraceWaterfall docs say.
import "@tangle-network/charts/react/flow-waterfall.css";

/**
 * The run workspace with its Timeline and Graph views over one trace: a manager that spawned four workers, one still
 * running, one failed. The Graph view draws the same agents, as of the same cursor, as a spawn tree.
 */

const agent = (id: string, name: string, startMs: number, endMs: number, status: FlowSpan["status"], parentId?: string): FlowSpan => ({
  kind: "pipeline", id, name, startMs, endMs, status, parentId, detail: "glm-5.3", costUsd: (endMs - startMs) / 400_000,
});

const trace: FlowTrace = {
  spans: [
    agent("root", "root", 0, 1_800_000, "running"),
    agent("sumcheck", "sumcheck", 60_000, 900_000, "done", "root"),
    agent("field", "field-kernels", 120_000, 1_100_000, "done", "root"),
    agent("verifier", "verifier", 300_000, 700_000, "failed", "root"),
    agent("bench", "bench-ladder", 950_000, 1_800_000, "running", "root"),
    { kind: "model", id: "root-plan", parentId: "root", name: "plan", startMs: 0, endMs: 40_000, detail: "glm-5.3" },
    { kind: "tool", id: "bench-run", parentId: "bench", name: "bash cargo bench", startMs: 1_000_000, endMs: 1_500_000 },
  ],
  totalMs: 1_800_000,
  promptTokens: 0,
  completionTokens: 0,
};

const meta = {
  title: "Run/TraceWorkspace",
  component: TraceWorkspace,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TraceWorkspace>;

export default meta;

export const TimelineAndGraph: StoryObj<typeof meta> = {
  args: { trace, live: false, label: "Trace", defaultView: "agents" },
};

/**
 * A factory as a live host sends it: the run id reused as its root agent's id (so two spans share it), 95 workers under
 * that root, and no files. The Graph view shows one root over its workers, whole, even on a phone; no Files panel.
 */
const factory: FlowTrace = {
  spans: [
    agent("minmax-h9", "root", 0, 3_600_000, "running"),
    agent("minmax-h9", "minmax-h9", 0, 3_600_000, "running"),
    ...Array.from({ length: 95 }, (_, i) => agent(`w${i}`, `worker-${i}`, i * 20_000, 1_200_000 + i * 20_000, i % 13 === 4 ? "failed" : i % 3 ? "done" : "running", "minmax-h9")),
  ],
  totalMs: 3_600_000,
  promptTokens: 0,
  completionTokens: 0,
};

export const FactoryRun: StoryObj<typeof meta> = {
  args: { trace: factory, live: false, label: "minmax-h9", defaultView: "agents" },
};

export const Phone390: StoryObj<typeof meta> = {
  args: { trace, live: false, defaultView: "agents" },
  globals: { viewport: { value: "mobile", isRotated: false } },
  decorators: [Story => <div style={{ width: "100%", maxWidth: 390 }}><Story /></div>],
};
export const Live: StoryObj<typeof meta> = { args: { trace, live: true, defaultView: "agents" } };
export const GraphView: StoryObj<typeof meta> = {
  args: { trace, live: false, defaultView: "agents" },
  play: async ({ canvasElement }) => {
    const button = await waitFor(() => { const button = [...canvasElement.querySelectorAll("button")].find(button => button.textContent?.trim() === "Graph"); if (!button) throw new Error("Waiting for graph control"); return button; });
    if (button.getAttribute("aria-checked") !== "true") button.click();
  },
};

/** Producer timestamps reach the internal Graph without an agentCards clock adapter. */
export const RecordedActivity: StoryObj<typeof meta> = {
  ...GraphView,
  args: { trace: { ...trace, spans: trace.spans.map(span => span.id === "root" ? { ...span, activityAt: [0, 30_000, 60_000], medianEventGapMs: 30_000 } : span) }, startedAt: Date.now() - trace.totalMs, live: false, defaultView: "agents" },
};

/** Synthetic long failure metadata; the conversation is intentionally not its source. */
const fullFailure = "Checkout tests failed. " + "The retained compiler diagnostic identifies the affected integration boundary and the original exit status. ".repeat(10) + "Final retained diagnostic.";
function OpenDrawer(args: TraceWorkspaceProps) {
  const [selected, select] = useState<string | undefined>("verifier");
  return <TraceWorkspace {...args} selectedAgentId={selected} onSelectAgent={select} />;
}
export const AgentDrawerOpen: StoryObj<typeof meta> = {
  render: args => <OpenDrawer {...args} />,
  args: { trace: { ...trace, spans: trace.spans.map(span => span.id === "verifier" ? { ...span, facts: [{ label: "Failure", value: fullFailure }] } : span) }, agentCards: { verifier: { result: fullFailure } }, selectedAgentId: "verifier", defaultView: "graph", live: false },
};
