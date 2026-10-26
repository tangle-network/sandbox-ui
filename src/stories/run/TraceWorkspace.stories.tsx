import type { Meta, StoryObj } from "@storybook/react";
import type { FlowSpan, FlowTrace } from "@tangle-network/charts";
import { TraceWorkspace } from "../../run";
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
