import type { Meta, StoryObj } from "@storybook/react";
import type { FlowSpan, FlowTrace } from "@tangle-network/charts";
import { FlowWaterfall, TimelineView } from "@tangle-network/charts/react";
import "@tangle-network/charts/react/flow-waterfall.css";
import recorded from "./fixtures/discovery-waterfall.json";

const trace = recorded as FlowTrace;
const live: FlowTrace = { ...trace, spans: trace.spans.map((span, index) => span.kind === "pipeline" ? { ...span, status: index ? "needs-you" : "running", outcome: { tone: index ? "warn" : "live", label: index ? "Needs you" : "Running" } } : span) };
const failureHeavy: FlowTrace = { totalMs: 900_000, promptTokens: 0, completionTokens: 0, errors: 17,
  spans: Array.from({ length: 17 }, (_, i): FlowSpan => ({ id: `agent-${i}`, kind: "pipeline", name: `benchmark-worker-${i + 1}`, startMs: i * 12_000, endMs: 600_000 + i * 8_000, status: "failed", output: "Benchmark harness exited 137 (OOM)", outcome: { label: "Failed", tone: "failed" } })) };
const meta = { title: "Run/FlowWaterfall", component: FlowWaterfall, parameters: { layout: "padded" }, args: { trace, live: false } } satisfies Meta<typeof FlowWaterfall>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AgentsSettled: Story = {};
export const StepsView: Story = { args: { defaultView: "spans" } };
export const LiveWaterfall: Story = { args: { trace: live, live: true } };
export const NeedsYou: Story = { args: { trace: live, live: true } };
export const FailureHeavy: Story = { args: { trace: failureHeavy } };
export const Phone390: Story = { parameters: { viewport: { defaultViewport: "mobile" } } };
export const ReducedMotion: Story = { args: { trace: live, live: true }, parameters: { reducedMotion: "reduce" } };
export const Empty: Story = { args: { trace: { totalMs: 0, promptTokens: 0, completionTokens: 0, spans: [] } } };
export const SingleAgent: Story = { args: { trace: { ...failureHeavy, errors: 1, spans: failureHeavy.spans.slice(0, 1) } } };
export const TwoHundredAgents: Story = { args: { trace: { ...trace, spans: Array.from({ length: 200 }, (_, i): FlowSpan => ({ id: `worker-${i}`, kind: "pipeline", name: `worker-${i}`, startMs: i * 1000, endMs: 400_000, status: "done" })) } } };
export const MutedIdentity: Story = { args: { agentFill: "muted" } };
export const OutcomeIdentity: Story = { args: { agentFill: "outcome" } };
export const FamilyFolded: Story = { args: { defaultCollapsed: true } };
export const SearchMatch: Story = { args: { query: "Echo" } };
export const LongNames: Story = { args: { trace: { ...trace, spans: trace.spans.map(span => ({ ...span, name: `${span.name} validating-the-very-long-release-proposal-and-signed-artifacts` })) } } };
// SpanCard is exercised through its public owner. A click pins it; Escape returns to the row.
export const SpanCardFailed: Story = { args: { trace: failureHeavy } };
export const TimelineFolded: Story = { render: () => <TimelineView lanes={[{ id: "root", label: "Root", spans: [{ start: 0, end: 1000, state: "done" }], ticks: [] }, { id: "worker", parent: "root", label: "Worker", spans: [{ start: 100, end: 900, state: "done" }], ticks: [] }]} options={{ measure: "Agent timeline" }} defaultCollapsed={["root"]} /> };
