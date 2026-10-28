import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { AgentGraph, type AgentGraphEdge, type AgentGraphNode } from "../../workflows";

/** Identical synthetic input for baseline and candidate. No production implementation is copied or modified. */
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


const NOW = Date.UTC(2026, 9, 28, 12);
function FairRun({ transition = false }: { transition?: boolean }) {
  const [tick, setTick] = useState(0), [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!transition) return;
    let elapsed = 0;
    const timer = setInterval(() => { elapsed++; setTick(elapsed); if (elapsed >= 10) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [transition]);
  const now = NOW + tick * 1000;
  const nodes: AgentGraphNode[] = runNodes.map((node, i) => {
    const events = Array.from({ length: 4 }, (_, k) => ({ id: `${node.id}-event-${k}`, label: ["bash cargo run --release -- prove", "read src/sumcheck/fold.rs", "edit src/sumcheck/fold.rs", "bash cargo test -p prover"][k]!, at: i === 3 ? NOW - (15 - k) * 60_000 : NOW - (3 - k) * 10_000 }));
    let status = i === 1 ? "needs-you" as const : i === 2 ? "failed" as const : i === 3 ? "running" as const : node.status;
    let turn = i === 1 ? "Approve the exact release proposal" : i === 2 ? "Benchmark harness exited 137 (OOM)" : i === 3 ? "Waiting for the remote benchmark" : node.turn;
    let result = i === 2 ? "Benchmark harness exited 137 (OOM)" : node.turn;
    const boundary = i === 1 ? 3 : i === 7 ? 5 : i === 10 ? 7 : Infinity;
    if (transition && tick >= boundary) {
      status = i === 1 ? "running" : i === 7 ? "succeeded" : "failed";
      turn = i === 1 ? "Operator response recorded; checking the release" : i === 7 ? "Wrote the reviewed benchmark report" : "2 integration checks failed in the retained attempt";
      result = turn;
      events.push({ id: `${node.id}-transition`, label: turn, at: NOW + boundary * 1000 });
    }
    return { ...node, status, turn, result, startedAt: NOW - 40 * 60_000, events: events.slice(-4) };
  });
  const picked = nodes.find(node => node.id === selected);
  return <div data-fair-phase={tick} style={{ height: "100vh", width: "100%", position: "relative", background: "var(--bg-root)" }}>
    <AgentGraph live nodes={nodes} edges={runEdges} now={now} selectedId={selected} onSelect={setSelected} className="h-full w-full" />
    <script id="fair-run-input" type="application/json">{JSON.stringify({ synthetic: true, now, nodes })}</script>
    {picked && <aside role="dialog" aria-label={`${picked.label} evidence`} style={{ position: "absolute", right: 16, bottom: 16, maxWidth: 320, padding: 16, border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", color: "var(--text-primary)", background: "var(--bg-elevated)", boxShadow: "var(--shadow-overlay)" }}><b>{picked.label}</b><p>{(["failed", "succeeded", "stopped"].includes(picked.status) ? picked.result : picked.turn) ?? "No result recorded"}</p><button type="button" onClick={() => setSelected(null)}>Close</button></aside>}
  </div>;
}
const meta = { title: "workflows/AgentGraph Fair", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
export const SeventeenLive: StoryObj = { render: () => <FairRun /> };
export const Transition: StoryObj = { render: () => <FairRun transition /> };
