import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
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
