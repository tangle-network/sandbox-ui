import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { AgentGraph, type AgentGraphCall, type AgentGraphNode, type AgentGraphTool } from "../../workflows";

/** Replay one release run at fixed states and through call transitions. */

const T0 = Date.UTC(2026, 9, 24, 21, 0, 0);
const s = (sec: number) => T0 + sec * 1000;

const tools: AgentGraphTool[] = [
  { id: "search", label: "Web search", detail: "Public web, cached 24 h" },
  { id: "notion", label: "Notion", provider: "notion", detail: "Product wiki" },
  { id: "slack", label: "Slack", provider: "slack", detail: "#billing-launch" },
  { id: "github", label: "GitHub", provider: "github", detail: "billing-web repository" },
  { id: "postgres", label: "Database", provider: "supabase", detail: "Supabase Postgres, read-only" },
  { id: "linear", label: "Linear", provider: "linear", detail: "BILL project" },
];

let n = 0;
const call = (from: string, to: string, at: number, dur: number | null, label: string, kind: AgentGraphCall["kind"] = "call"): AgentGraphCall =>
  ({ id: `c${n++}`, from, to, kind, label, startedAt: s(at), durationMs: dur === null ? null : dur * 1000 });

const calls: AgentGraphCall[] = [
  call("you", "orch", 0, 1.2, "Ship the annual billing toggle by Friday"),
  call("orch", "research", 1.4, 9, "Find how peers price annual plans"),
  call("orch", "writer", 2.0, 10, "Draft the toggle and renewal copy"),
  call("orch", "coder", 2.6, 16, "Build the toggle and prices"),
  call("orch", "analyst", 3.2, 8, "Size revenue per seat by plan"),
  call("research", "search", 4.0, 2.2, "annual discount norms"),
  call("research", "notion", 6.6, 1.4, "Pricing principles page"),
  call("analyst", "postgres", 4.4, 0.9, "Revenue per seat"),
  call("analyst", "postgres", 5.6, 0.8, "Seats per plan"),
  call("analyst", "postgres", 6.8, 0.8, "Upgrades in 90 days"),
  call("writer", "notion", 5.0, 1.2, "Style guide"),
  call("writer", "slack", 7.0, 1.0, "Ask legal about renewal wording"),
  call("coder", "github", 6.0, 2.1, "Create branch"),
  call("coder", "github", 9.0, 3.0, "Push toggle component"),
  call("analyst", "orch", 11.4, 0.4, "1,900 workspaces would switch", "answer"),
  call("research", "orch", 10.6, 0.4, "Median annual discount is 17%", "answer"),
  call("writer", "you", 12.4, null, "Approve the renewal notice wording?", "needs-you"),
  call("coder", "github", 13.0, 8.4, "Run checkout tests", "failed"),
  call("coder", "linear", 21.6, 1.1, "File BILL-212: proration rounding"),
  call("you", "writer", 24.0, 0.6, "Approved with one edit", "answer"),
  call("writer", "orch", 26.0, 0.4, "Copy ready for review", "answer"),
];
// The open needs-you call ends when the person answers.
calls.find((c) => c.kind === "needs-you")!.durationMs = 11_600;

function agentsAt(sec: number): AgentGraphNode[] {
  const status = (id: string): AgentGraphNode["status"] => {
    if (id === "writer" && sec >= 12.4 && sec < 24) return "needs-you";
    if (id === "coder" && sec >= 21.4) return "failed";
    const done: Record<string, number> = { research: 10.6, analyst: 11.4, writer: 26 };
    if (done[id] !== undefined && sec >= done[id]!) return "succeeded";
    return sec >= 1.4 ? "running" : "idle";
  };
  const agent = (id: string, label: string, model: string, costUsd: number): AgentGraphNode => ({
    id, label, model, status: id === "orch" ? (sec >= 26 ? "succeeded" : "running") : status(id), costUsd: sec > 2 ? costUsd * Math.min(1, sec / 26) : 0,
    turn: id === "coder" && sec >= 21.4 ? "2 of 14 checkout tests fail: proration rounds the wrong way" : undefined,
  });
  return [
    agent("orch", "Orchestrator", "anthropic/claude-opus-4-1", 0.12),
    agent("research", "Researcher", "anthropic/claude-sonnet-4-5", 0.05),
    agent("writer", "Writer", "anthropic/claude-sonnet-4-5", 0.09),
    agent("coder", "Coder", "openai/gpt-5.5", 0.16),
    agent("analyst", "Analyst", "google/gemini-2.5-pro", 0.06),
  ];
}
const spawns = ["research", "writer", "coder", "analyst"].map((id) => ({ from: "orch", to: id, kind: "spawn" as const }));
const you = { summary: "Ship the annual billing toggle by Friday" };

function Replay({ at, loop, selectedId }: { at?: number; loop?: number; selectedId?: string }) {
  const [sec, setSec] = useState(at ?? 6.9);
  useEffect(() => {
    if (!loop) return;
    const started = performance.now() - (at ?? 0) * 1000;
    const timer = setInterval(() => setSec(((performance.now() - started) / 1000) % loop), 100);
    return () => clearInterval(timer);
  }, [loop, at]);
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <AgentGraph layout="hub" nodes={agentsAt(sec)} edges={spawns} tools={tools} calls={calls} you={you} now={s(sec)} selectedId={selectedId} />
    </div>
  );
}

const meta: Meta<typeof Replay> = {
  title: "workflows/AgentGraph Hub",
  component: Replay,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Replay>;

/** The whole run on a 30-second loop: calls travel out, answers travel back. */
export const Live: Story = { args: { at: 6.9, loop: 30 } };
/** Four agents at work; Analyst is hammering the database. */
export const Working: Story = { args: { at: 6.9 } };
/** Writer is blocked on a person: amber edge to You, a chip in the header. */
export const NeedsYou: Story = { args: { at: 14 } };
/** Coder's checkout tests failed; its popover lists the calls behind it. */
export const Failed: Story = { args: { at: 22.2, selectedId: "coder" } };
/** The database's popover: who used it and how long each query took. */
export const ToolPopover: Story = { args: { at: 7.2, selectedId: "postgres" } };
/** Settled: every agent done or failed, no live edges. */
export const Settled: Story = { args: { at: 40 } };

/** A Discovery-shaped run: one root and sixteen workers on one model, three shell tools. */
export const LargeRun: Story = {
  render: () => {
    const workers = ["memscale", "v6-battery", "tape-route", "verify-time", "memscale-2", "tape-route-2", "v6-battery-2", "verify-time-2",
      "memscale-3", "tape-route-3", "memscale-4", "tape-route-4", "memscale-5", "tape-route-5", "memscale-6", "tape-route-6"];
    const nodes: AgentGraphNode[] = [
      { id: "root", label: "root", model: "zai/glm-5.3", status: "running", costUsd: null },
      ...workers.map((w, i) => ({ id: w, label: w, model: "zai/glm-5.3", status: (i % 5 === 3 ? "failed" : i < 9 ? "succeeded" : "running") as AgentGraphNode["status"], costUsd: null })),
    ];
    const big: AgentGraphTool[] = [{ id: "shell", label: "Shell" }, { id: "files", label: "Files" }, { id: "git", label: "Git" }];
    const bigCalls = workers.flatMap((w, i) => [
      { id: `${w}-s`, from: "root", to: w, kind: "call" as const, startedAt: s(i * 2), durationMs: 30_000 },
      { id: `${w}-t`, from: w, to: big[i % 3]!.id, kind: (i % 5 === 3 ? "failed" : "call") as AgentGraphCall["kind"], startedAt: s(36 + i), durationMs: 1200 },
    ]);
    return <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <AgentGraph layout="hub" nodes={nodes} edges={workers.map((w) => ({ from: "root", to: w, kind: "spawn" as const }))} tools={big} calls={bigCalls} now={s(48)} title="magnetar-rust run" />
    </div>;
  },
};

export const Light: Story = { args: { at: 14 }, globals: { sandboxTheme: "light" } };
export const Phone390: Story = {
  args: { at: 22.2 }, globals: { viewport: { value: "mobile", isRotated: false } },
  decorators: [Story => <div style={{ width: "100%", maxWidth: 390 }}><Story /></div>],
};
export const ReducedMotion: Story = { args: { at: 6.9 }, parameters: { reducedMotion: "reduce" } };
export const NoCalls: Story = { render: () => <AgentGraph layout="hub" nodes={agentsAt(0)} edges={spawns} tools={tools} calls={[]} now={s(0)} /> };
export const CallLifecycle: Story = { args: { at: 3.8, loop: 30 } };
export const FailedCall: Story = { args: { at: 22.2, selectedId: "coder" } };

/** Recorded work silence qualifies Running; it does not turn the agent into Waiting. */
export const Quiet: Story = { render: () => <div style={{ maxWidth: 820, margin: "0 auto" }}><AgentGraph layout="hub" nodes={agentsAt(6.9).map(node => node.id === "research" ? { ...node, events: [0, 1, 2].map(i => ({ id: `quiet-${i}`, label: "Recorded read", at: s(-840 + i * 60) })) } : node)} edges={spawns} tools={tools} calls={calls} you={you} now={s(6.9)} /></div> };

/** Agent activity can arrive without tool inventory or call history. */
export const UnreportedHistory: Story = { render: () => <AgentGraph layout="hub" nodes={agentsAt(0)} edges={spawns} now={s(0)} /> };
/** An explicitly recorded empty history is measured zero. */
export const EmptyHistory: Story = { render: () => <AgentGraph layout="hub" nodes={agentsAt(0)} edges={spawns} tools={[]} calls={[]} now={s(0)} /> };

/** Wrapped attention chips and metrics retain their own height above a bounded canvas. */
export const BoundedAttention: Story = { render: () => <div style={{ height: 480 }}><AgentGraph layout="hub" nodes={agentsAt(22.2).map(node => node.id === "orch" ? { ...node, events: [0, 1, 2].map(i => ({ id: `root-quiet-${i}`, label: "Recorded activity", at: s(-840 + i * 60) })) } : node)} edges={spawns} tools={tools} calls={calls} you={you} now={s(22.2)} className="h-full" /></div> };
