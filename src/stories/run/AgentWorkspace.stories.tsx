import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AgentWorkspace, type AgentWorkspaceProps, type AgentWorkspaceSource } from "../../run";
import { call, replayOpener } from "./fixtures/replay";

/**
 * One agent's workspace, from the root of canary-chain-20261104x (a retained Discovery run of 2026-11-04 that counted the
 * primes below 300000 with three workers): its git mirror at rc1, the answer page it wrote and the conversation that
 * wrote it. The host reads everything through `source`; the Terminal tab appears only when the host can mint one.
 */
const paths = [
  "pages/canary-chain/answer.md", "pages/canary-chain/part-1.md", "pages/canary-chain/part-2.md", "pages/canary-chain/part-3.md",
  "pages/canary-chain/release/rc1.md", "profiles/canary-chain-20261104x-s0.json", "profiles/canary-chain-20261104x-s1.json",
  "profiles/canary-chain-20261104x-s2.json", "profiles/canary-chain-20261104x.json", "profiles/roles/example-glm-worker.json",
];
const answer = "# Answer — primes below 300000\n\nThree workers counted; the coordinator added and counted no range itself.\n\n- PART 1, 0 <= p < 100000, worker `s0` (key `part-1`): 9592\n- PART 2, 100000 <= p < 200000, worker `s1` (key `part-2`): 8392\n- PART 3, 200000 <= p < 300000, worker `s2` (key `part-3`): 8013\n\nSum: 9592 + 8392 + 8013 = 25997\n\nANSWER: 25997\n";
const files: Record<string, { content: string; baseline?: string | null; language?: string }> = {
  "pages/canary-chain/answer.md": { content: answer, baseline: "# Answer — primes below 300000\n\nPending: three workers are counting their ranges.\n\nANSWER: pending\n" },
  "pages/canary-chain/part-1.md": { content: "# PART 1 — primes in [0, 100000)\n\nStory fixture: a sieve over the range, checked against the reference table.\n\nCount: 9592\n" },
  "pages/canary-chain/release/rc1.md": { content: "# rc1\n\nStory fixture: tagged once the three parts landed and the answer page summed them.\n" },
  "profiles/canary-chain-20261104x.json": { content: JSON.stringify({ fixture: "story", name: "canary-chain-20261104x", role: "root", harness: "opencode", model: "zai-coding-plan/glm-5.3" }, null, 2), language: "json" },
};
const epoch = Date.parse("2026-11-04T20:49:05Z");
/** The root's conversation as its producer streamed it: commission, three spawns, three reads, the answer page, the submitted result. */
const transcript = { ends: true, rows: [
  { kind: "user", text: "Read /home/agent/inputs/commission.md (your inputs are in /home/agent/inputs/) and pursue the goal within your budget. Decide how to work and when to submit." },
  ...call("c1", "read", { path: "/home/agent/inputs/commission.md" }, "# Commission\n\nCount the primes below 300000. Split the range across workers, add their counts, and write pages/canary-chain/answer.md ending in ANSWER: <n>."),
  { kind: "reasoning", text: "Three equal ranges, three workers; I add and count nothing myself." },
  ...call("c2", "mcp__agent-runtime-coordination__spawn", { label: "s0", task: "PART 1: count the primes in [0, 100000); record part-1" }, "spawned s0"),
  ...call("c3", "mcp__agent-runtime-coordination__spawn", { label: "s1", task: "PART 2: count the primes in [100000, 200000); record part-2" }, "spawned s1"),
  ...call("c4", "mcp__agent-runtime-coordination__spawn", { label: "s2", task: "PART 3: count the primes in [200000, 300000); record part-3" }, "spawned s2"),
  ...call("c5", "mcp__agent-runtime-coordination__knowledge_read", { key: "part-1" }, "9592"),
  ...call("c6", "mcp__agent-runtime-coordination__knowledge_read", { key: "part-2" }, "8392"),
  ...call("c7", "mcp__agent-runtime-coordination__knowledge_read", { key: "part-3" }, "8013"),
  ...call("c8", "edit", { path: "pages/canary-chain/answer.md" }, "Applied 1 hunk"),
  ...call("c9", "mcp__agent-runtime-coordination__submit_result", { result: { status: "succeeded", answer: 25997 } }, "accepted"),
  { kind: "text", text: "Done. Team result accepted: PART 1 (s0): 9592 · PART 2 (s1): 8392 · PART 3 (s2): 8013. ANSWER: 25997." },
] };
const wait = <T,>(value: T, ms = 150) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms));
const source = (terminal?: AgentWorkspaceSource["terminal"]): AgentWorkspaceSource => ({
  list: () => wait({ paths, origin: "git mirror at rc1 · cc7a725", status: { "pages/canary-chain/answer.md": "modified" as const } }),
  read: path => files[path] ? wait(files[path]!) : Promise.reject(new Error(`${path} is not in the mirror at rc1.`)),
  stream: { url: "/agents/canary-chain-20261104x/stream", open: replayOpener({ "canary-chain-20261104x": transcript }, () => epoch) },
  terminal,
});
const agent = { id: "canary-chain-20261104x", label: "root", status: "done" as const, harness: "opencode", model: "zai-coding-plan/glm-5.3" };

/** The story carries the view and the open file, as a host with a route would. */
function Hosted(args: AgentWorkspaceProps) {
  const [view, setView] = useState(args.view);
  const [path, setPath] = useState(args.path);
  return <AgentWorkspace {...args} view={view} onViewChange={setView} path={path} onPathChange={setPath} />;
}

const meta: Meta<typeof AgentWorkspace> = {
  title: "Run/AgentWorkspace",
  component: AgentWorkspace,
  parameters: { layout: "padded" },
  render: (args) => <Hosted {...args} />,
  // The workspace fills its parent's height, as the run page gives it the canvas under a 40 px strip.
  decorators: [Story => <div style={{ height: "calc(100vh - 2rem)" }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The mirror's tree with the answer page open; its Diff view compares the page with the one before the agent's work. */
export const Files: Story = { args: { agent, source: source(), path: "pages/canary-chain/answer.md", onBack: () => {} } };
/** The conversation that produced the answer: commission, spawns, the three reads and the submitted result. */
export const Trace: Story = { args: { agent, source: source(), view: "trace", onBack: () => {} } };
/** The host can mint terminals, but this agent's box is gone: the tab says so and names where the files come from. */
export const TerminalGone: Story = { args: { agent, source: source(() => wait(null)), view: "terminal", onBack: () => {} } };
