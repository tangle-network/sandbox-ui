import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { AgentGraph, type AgentGraphEdge, type AgentGraphNode } from "../../workflows";

/**
 * The topology of a multi-agent run, as the Discovery run page draws it in the
 * left pane of its workspace. Fixtures are the shape of a real run: one manager
 * and sixteen workers, a few of them talking back.
 */

const MODELS = ["glm-5.3-flash", "anthropic/claude-sonnet-4-5", "openai/gpt-5.5", "glm-5.3-flash"];
const HARNESSES = ["opencode", "claude-code", "codex", "opencode"];
const WORKERS: readonly [string, string, AgentGraphNode["status"], string | null][] = [
  ["memscale", "v6-memory", "running", "Profiling allocator under 64 GiB load"],
  ["battery", "v6-battery", "succeeded", "Wrote battery-drain report"],
  ["thermals", "v6-thermal", "running", "Sweeping fan curves, step 7 of 12"],
  ["kv-cache", "v6-memory", "waiting", "Waiting on memscale's allocator trace"],
  ["scheduler", "v6-sched", "failed", "Benchmark harness exited 137 (OOM)"],
  ["io-path", "v6-io", "succeeded", "fio matrix complete, 48 cells"],
  ["netstack", "v6-net", "running", "Replaying 10k-connection trace"],
  ["compiler", "v6-build", "stopped", "Stopped by manager: superseded"],
  ["power", "v6-battery", "succeeded", "Calibrated idle draw"],
  ["gpu-sched", "v6-gpu", "running", "Reading driver queue depth"],
  ["storage", "v6-io", "idle", null],
  ["crash-dump", "v6-debug", "succeeded", "Symbolicated 3 dumps"],
  ["latency", "v6-sched", "running", "p99 wakeup histogram"],
  ["firmware", "v6-fw", "unknown", null],
  ["telemetry", "v6-obs", "succeeded", "Exported 2.1M samples"],
  ["regress", "v6-ci", "waiting", "Queued behind scheduler retry"],
];

const runNodes: AgentGraphNode[] = [
  {
    id: "agent_root",
    label: "root",
    role: "manager",
    harness: "claude-code",
    model: "anthropic/claude-opus-4-1",
    status: "running",
    turn: "Merging worker findings into the v6 plan",
    costUsd: 4.82,
    tokens: 1_240_000,
  },
  ...WORKERS.map(([label, role, status, turn], i) => ({
    id: `agent_${label}`,
    label,
    role,
    harness: HARNESSES[i % HARNESSES.length],
    model: MODELS[i % MODELS.length],
    status,
    turn,
    costUsd: status === "idle" ? null : 0.04 + ((i * 37) % 90) / 100,
    tokens: status === "idle" ? null : 18_000 + i * 7_300,
  })),
];

const runEdges: AgentGraphEdge[] = [
  ...WORKERS.map(([label]) => ({ from: "agent_root", to: `agent_${label}`, kind: "spawn" as const })),
  { from: "agent_kv-cache", to: "agent_memscale", kind: "message", count: 3, label: "trace request" },
  { from: "agent_memscale", to: "agent_kv-cache", kind: "message" },
  { from: "agent_scheduler", to: "agent_root", kind: "message", count: 2, label: "failure report" },
  { from: "agent_root", to: "agent_regress", kind: "delegation", label: "rerun after fix" },
  { from: "agent_latency", to: "agent_scheduler", kind: "message" },
];

/** A deeper run: sub-managers with workers of their own (depth 3). */
const nestedNodes: AgentGraphNode[] = [
  { id: "root", label: "root", role: "manager", harness: "claude-code", model: "anthropic/claude-opus-4-1", status: "running", turn: "Waiting on two teams", costUsd: 2.1 },
  { id: "research", label: "research", role: "lead", harness: "codex", model: "openai/gpt-5.5", status: "running", turn: "Ranking 9 sources", costUsd: 0.62 },
  { id: "build", label: "build", role: "lead", harness: "opencode", model: "glm-5.3-flash", status: "waiting", turn: "Blocked on review", costUsd: 0.31 },
  { id: "papers", label: "papers", role: "reader", harness: "codex", model: "openai/gpt-5.5", status: "succeeded", turn: "Summarised 6 papers", costUsd: 0.18 },
  { id: "forums", label: "forums", role: "reader", harness: "opencode", model: "glm-5.3-flash", status: "running", turn: "Scanning HN threads", costUsd: 0.07 },
  { id: "impl", label: "impl", role: "coder", harness: "opencode", model: "glm-5.3-flash", status: "succeeded", turn: "Opened PR #212", costUsd: 0.4 },
  { id: "review", label: "review", role: "reviewer", harness: "claude-code", model: "anthropic/claude-sonnet-4-5", status: "running", turn: "Reading the diff", costUsd: 0.22 },
  { id: "tests", label: "tests", role: "verifier", harness: "codex", model: "openai/gpt-5.5", status: "failed", turn: "2 integration tests red", costUsd: 0.12 },
];

const nestedEdges: AgentGraphEdge[] = [
  { from: "root", to: "research", kind: "spawn" },
  { from: "root", to: "build", kind: "spawn" },
  { from: "research", to: "papers", kind: "spawn" },
  { from: "research", to: "forums", kind: "spawn" },
  { from: "build", to: "impl", kind: "spawn" },
  { from: "impl", to: "review", kind: "spawn" },
  { from: "impl", to: "tests", kind: "spawn" },
  { from: "papers", to: "impl", kind: "delegation", label: "spec handoff" },
  { from: "tests", to: "impl", kind: "message", count: 4 },
];

function Selectable({
  nodes,
  edges,
  initial,
  className,
  direction,
}: {
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
  initial: string;
  className: string;
  direction?: "TB" | "LR";
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  return (
    <AgentGraph
      nodes={nodes}
      edges={edges}
      selectedId={selected}
      onSelect={setSelected}
      direction={direction}
      className={className}
    />
  );
}

const meta: Meta = {
  title: "workflows/AgentGraph",
  parameters: { layout: "fullscreen" },
};
export default meta;

/** One manager, sixteen workers: the workers are packed into a grid sized to the canvas. */
export const SeventeenAgents: StoryObj = {
  render: () => (
    <div className="h-screen w-full bg-background">
      <Selectable nodes={runNodes} edges={runEdges} initial="agent_memscale" className="h-full w-full" />
    </div>
  ),
};

/** The Discovery run page's left pane: 360px wide beside the transcript. */
export const WorkspacePane: StoryObj = {
  render: () => (
    <div className="flex h-screen w-full bg-background">
      <div className="h-full w-full max-w-[360px] shrink-0 border-border border-r">
        <Selectable nodes={runNodes} edges={runEdges} initial="agent_scheduler" className="h-full w-full" />
      </div>
      <div className="hidden flex-1 items-center justify-center text-muted-foreground text-sm md:flex">
        Transcript pane
      </div>
    </div>
  ),
};

/** Sub-managers with their own workers, three levels deep. */
export const NestedTeams: StoryObj = {
  render: () => (
    <div className="h-screen w-full bg-background">
      <Selectable nodes={nestedNodes} edges={nestedEdges} initial="impl" className="h-full w-full" />
    </div>
  ),
};

/** The same run left to right, for a wide, short pane. */
export const NestedTeamsLeftToRight: StoryObj = {
  render: () => (
    <div className="h-screen w-full bg-background">
      <Selectable nodes={nestedNodes} edges={nestedEdges} initial="tests" direction="LR" className="h-full w-full" />
    </div>
  ),
};

// A live proving run: a lead and five workers, each doing a different kind of work. Events arrive every two seconds.
const LIVE_START = Date.now() - 41 * 60_000;
const LIVE_WORK: readonly [string, AgentGraphNode["activity"], string, readonly string[]][] = [
  ["prove-scale", "proving", "Folding round 14 of 22; the lag term still dominates", ["bash cargo run --release -- prove --rows 2^22", "read src/sumcheck/fold.rs", "edit src/sumcheck/fold.rs"]],
  ["commit-wave", "building", "Rebuilding with the wave commitment behind a feature flag", ["bash cargo build -p commit --features wave", "edit crates/commit/src/wave.rs", "bash cargo test -p commit wave::"]],
  ["paper-parity", "reading", "Section 4.2 bounds the verifier at log n field ops", ["read papers/hyperplonk.pdf p.18", "grep 'verifier' docs/notes.md", "read src/verifier/mod.rs"]],
  ["field-kernels", "writing", "Writing the Montgomery reduction for the 64-bit field", ["edit src/field/kernel.rs", "bash cargo bench -p field mul", "edit benches/field.rs"]],
  ["verify-lag", "waiting", "Waiting on prove-scale's round-14 transcript", ["wait prove-scale transcript", "read logs/round-13.json", "wait slot on host"]],
];

function LiveRun() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(timer);
  }, []);
  const workers: AgentGraphNode[] = LIVE_WORK.map(([label, activity, turn, calls], i) => ({
    id: label, label, model: MODELS[i % MODELS.length], harness: "opencode", effort: i % 2 ? "high" : "medium",
    status: activity === "waiting" ? "waiting" : "running", activity, turn,
    startedAt: LIVE_START + i * 4 * 60_000, commits: [14, 12, 1, 4, 0][i],
    events: Array.from({ length: 3 + tick }, (_, k) => ({ id: `${label}-${k}`, label: calls[k % calls.length], at: Date.now() - (2 + tick - k) * 9_000 - i * 3_000 })),
  }));
  const nodes: AgentGraphNode[] = [
    { id: "lead", label: "lead", role: "manager", model: "anthropic/claude-sonnet-4-5", effort: "high", status: "running", activity: "thinking",
      turn: "Two workers on the commitment, one on the verifier; rc3 needs the lag fix", startedAt: LIVE_START, commits: 34,
      events: [{ id: "l1", label: "spawn field-kernels" }, { id: "l2", label: "release rc2" }, { id: "l3", label: "steer verify-lag" }] },
    ...workers,
    { id: "verdict-hunt", label: "verdict-hunt", model: "openai/gpt-5.5", status: "succeeded", result: "valid · 4 commits" },
    { id: "bench-gate", label: "bench-gate", model: "glm-5.3-flash", effort: "medium", status: "failed", startedAt: LIVE_START + 9 * 60_000, commits: 2,
      result: "cargo bench: fold_round regressed 38% over budget; 2 integration tests red",
      events: [{ id: "b1", label: "bash cargo bench -p prover", at: LIVE_START + 30 * 60_000 }, { id: "b2", label: "read target/criterion/report.json", at: LIVE_START + 31 * 60_000 }, { id: "b3", label: "bash cargo test -p prover", at: LIVE_START + 33 * 60_000 }] },
  ];
  const edges: AgentGraphEdge[] = nodes.slice(1).map((n) => ({ from: "lead", to: n.id, kind: "spawn" }));
  const [selected, setSelected] = useState<string | null>(null);
  return <AgentGraph live nodes={nodes} edges={edges} selectedId={selected} onSelect={setSelected} className="h-full w-full" />;
}

/** A running run as live cards: who is working, on what, right now. */
export const LiveRunCards: StoryObj = {
  render: () => (
    <div className="h-screen w-full bg-background">
      <LiveRun />
    </div>
  ),
};
