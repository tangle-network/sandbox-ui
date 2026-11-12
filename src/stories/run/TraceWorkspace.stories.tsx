import { useState } from "react";
import { waitFor } from "@testing-library/dom";
import type { Meta, StoryObj } from "@storybook/react";
import type { FlowSpan, FlowTrace } from "@tangle-network/charts";
import { TraceWorkspace, type TraceWorkspaceProps } from "../../run";
import { call, replayOpener, type ReplayRow } from "./fixtures/replay";

/**
 * The run workspace with its Timeline and Graph views over one trace: a manager that spawned four workers, one still
 * running, one failed. The Graph view draws the same agents, as of the same cursor, as a spawn tree.
 */

const agent = (id: string, name: string, startMs: number, endMs: number, status: FlowSpan["status"], parentId?: string): FlowSpan => ({
  kind: "pipeline", id, name, startMs, endMs, status, parentId, detail: "glm-5.3", costUsd: (endMs - startMs) / 400_000,
  promptTokens: Math.round((endMs - startMs) / 8), cachedTokens: Math.round((endMs - startMs) / 14), completionTokens: Math.round((endMs - startMs) / 60),
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

const meta: Meta<typeof TraceWorkspace> = {
  title: "Run/TraceWorkspace",
  component: TraceWorkspace,
  parameters: { layout: "padded" },
  // The workspace fills its parent's height, as a run page gives it the viewport under its header.
  decorators: [Story => <div style={{ height: "calc(100vh - 2rem)" }}><Story /></div>],
};

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

/** The Graph view's grid layout: every agent's card at once, root first, in reading order, with no edges or camera. */
export const GridView: StoryObj<typeof meta> = { ...GraphView, args: { ...GraphView.args, agentGraph: { defaultLayout: "grid" } } };

/** Producer timestamps reach the internal Graph without an agentCards clock adapter. */
export const RecordedActivity: StoryObj<typeof meta> = {
  ...GraphView,
  args: { trace: { ...trace, spans: trace.spans.map(span => span.id === "root" ? { ...span, activityAt: [0, 30_000, 60_000], medianEventGapMs: 30_000 } : span) }, startedAt: Date.now() - trace.totalMs, live: false, defaultView: "agents" },
};

/** Synthetic long failure metadata; the conversation is intentionally not its source. */
const fullFailure = "Checkout tests failed. " + "The retained compiler diagnostic identifies the affected integration boundary and the original exit status. ".repeat(10) + "Final retained diagnostic.";
const epoch = Date.parse("2026-11-04T10:00:00Z");
/** What each agent said and ran, as its producer streams it: commission, reasoning, tool calls and results, its answer. */
const transcripts: Record<string, { rows: ReplayRow[]; ends: boolean }> = {
  verifier: { ends: true, rows: [
    { kind: "user", text: "Verify the sumcheck prover against the reference transcript and report any mismatch with its exact location." },
    { kind: "reasoning", text: "Start from the integration test the manager named, then read the failing boundary." },
    ...call("v1", "bash", { command: "cargo test -p sumcheck --test integration" }, "running 14 tests\ntest round_trip ... ok\ntest checkout_boundary ... FAILED\nerror: test failed, exit 101", true),
    ...call("v2", "read", { path: "crates/sumcheck/src/prover.rs" }, "pub fn prove(transcript: &mut Transcript, poly: &MultilinearPoly) -> Proof { … }"),
    ...call("v3", "mcp__agent-runtime-coordination__knowledge_read", { key: "sumcheck-reference-transcript" }, "Absorb the claimed sum before round 1."),
    ...call("v4", "grep", { pattern: "absorb", path: "crates/sumcheck" }, "prover.rs:88: transcript.absorb(&round_poly)\nprover.rs:91: transcript.absorb(&claim)"),
    ...call("v5", "read", { path: "crates/sumcheck/tests/integration.rs" }, "#[test] fn checkout_boundary() { … }"),
    { kind: "text", text: "The reference absorbs the claim first; ours absorbs it after the first round polynomial. Recording the finding before the budget runs out." },
    ...call("v6", "mcp__agent-runtime-coordination__knowledge_record", { key: "sumcheck-absorb-order", body: "---FILE: findings/sumcheck.md\nprover.rs:91 absorbs the claim after round 1" }, "recorded"),
    ...call("v7", "mcp__agent-runtime-coordination__submit_result", { result: { status: "failed", reason: "budget" } }, "accepted"),
    { kind: "text", text: "The checkout boundary test fails: the prover absorbs the claimed sum **after** the first round polynomial, while the reference absorbs it before. I could not finish the fix inside the budget." },
  ] },
  sumcheck: { ends: true, rows: [
    { kind: "user", text: "Implement the sumcheck prover for multilinear polynomials and land it with tests." },
    ...call("s1", "read", { path: "crates/sumcheck/src/lib.rs" }, "mod prover;\nmod verifier;"),
    ...call("s2", "edit", { path: "crates/sumcheck/src/prover.rs" }, "Applied 3 hunks"),
    ...call("s3", "bash", { command: "cargo test -p sumcheck" }, "test result: ok. 14 passed; 0 failed"),
    { kind: "text", text: "Landed the prover in `crates/sumcheck/src/prover.rs` with 14 passing tests, including the reference round-trip." },
  ] },
  bench: { ends: false, rows: [
    { kind: "user", text: "Run the field-kernel benchmark ladder and report throughput per size." },
    ...call("b1", "bash", { command: "cargo bench -p field --bench ladder -- --save-baseline main" }, "ladder/2^16  time: [1.21 ms 1.22 ms 1.24 ms]\nladder/2^18  time: [4.90 ms 4.93 ms 4.97 ms]"),
    { kind: "text", text: "2^16 and 2^18 are done; 2^20 is running now." },
    { kind: "tool-call", toolCallId: "b2", toolName: "bash", args: { command: "cargo bench -p field --bench ladder -- 2^20" } },
  ] },
  field: { ends: true, rows: [] },
};
const replay = replayOpener(transcripts, id => epoch + (trace.spans.find(span => span.id === id)?.startMs ?? 0));
function OpenDrawer(args: TraceWorkspaceProps) {
  const [selected, select] = useState<string | undefined>(args.selectedAgentId);
  return <TraceWorkspace {...args} selectedAgentId={selected} onSelectAgent={select} />;
}
const failedTrace = { ...trace, spans: trace.spans.map(span => span.id === "verifier" ? { ...span, tools: Array.from({ length: 7 }, (_, i) => ({ name: `recorded_tool_${i}`, calls: 7 - i, failures: i === 6 ? 1 : 0, detail: "2 ms / 3 ms / 4 ms p50/p90/p99" })), facts: [{ label: "Failure", value: fullFailure }, { label: "Tokens", value: "50.0K in" }, { label: "Harness", value: "codex" }] }
  : span.id === "field" ? { ...span, status: "failed" as const, facts: [{ label: "Failure", value: "budget-exhausted: nothing left running could return enough budget for this worker (tokens requested 4000, free 1802)." }, { label: "Harness", value: "codex" }, { label: "Turns", value: "0" }] } : span) };
const inspector = { render: (args: TraceWorkspaceProps) => <OpenDrawer {...args} />, args: { trace: failedTrace, docked: true, streamUrl: (id: string) => `/agents/${encodeURIComponent(id)}/stream`, openEventSource: replay, defaultView: "agents" as const, live: false,
  renderAgentDrawer: () => <p className="m-0 mt-2 text-xs text-muted-foreground">Profile reader-first-expert-2 · harness codex</p>,
  transcriptNote: (id: string) => id === "field" ? "The codex harness did not capture a transcript for this agent." : undefined } };

/** A failed agent: its reason under the header, its commission folded, the conversation that led there filling the rest. */
export const AgentDrawerOpen: StoryObj<typeof meta> = { ...inspector, args: { ...inspector.args, selectedAgentId: "verifier",
  commission: { by: "root", text: "Verify the sumcheck prover against the reference transcript and report any mismatch with its exact location. Use the integration suite first; read the prover only where it fails." }, agentCards: { verifier: { result: fullFailure } } } };
/** A finished agent's recorded conversation; its commission is the conversation's first message, so only its author shows. */
export const InspectorFinished: StoryObj<typeof meta> = { ...inspector, args: { ...inspector.args, selectedAgentId: "sumcheck", commission: { by: "root", text: "Implement the sumcheck prover for multilinear polynomials and land it with tests." } } };
/** A running agent: the Live marker, and its open tool call at the end of the conversation. */
export const InspectorLive: StoryObj<typeof meta> = { ...inspector, args: { ...inspector.args, selectedAgentId: "bench", live: true } };
/** A failed agent whose stream ended without a word: its failure, its commission and the host's reason at the top, Details open. */
export const InspectorNoTranscript: StoryObj<typeof meta> = { ...inspector, args: { ...inspector.args, selectedAgentId: "field",
  commission: { by: "root", text: "Write the field kernels for the Goldilocks prime and benchmark them against the reference." } } };
