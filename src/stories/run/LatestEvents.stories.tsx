import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { LatestEvents } from "../../run/latest-events";
import type { AgentGraphNode } from "../../workflows/AgentGraph";

function ReadingFixture() {
  const [agents, setAgents] = useState<AgentGraphNode[]>(() => [{ id: "worker", label: "worker", status: "running", events: [{ id: "first", label: "Read source", at: Date.now() - 20_000 }] }, { id: "untimed", label: "untimed", status: "unknown", events: [{ id: "unknown", label: "Timestamp not reported" }] }]);
  const [selected, select] = useState<string>();
  return <div className="mx-auto max-w-3xl border border-border bg-card">
    <LatestEvents agents={agents} selectedId={selected} onSelect={select} />
    <div className="flex gap-3 p-3 text-sm">
      <button onClick={() => setAgents(old => old.map(agent => agent.id === "worker" ? { ...agent, events: [...(agent.events ?? []), { id: "next", label: "Ran integration check", at: Date.now() }] } : agent))}>Append event</button>
      <button onClick={() => setAgents(old => old.map(agent => agent.id === "worker" ? { ...agent, status: "failed", result: "Integration check exited 1" } : agent))}>Fail worker</button>
      <output aria-label="Selected agent">{selected ?? "None"}</output>
    </div>
  </div>;
}
const meta = { title: "Run/LatestEvents", component: LatestEvents, parameters: { layout: "padded" } } satisfies Meta<typeof LatestEvents>;
export default meta;
export const Reading: StoryObj<typeof meta> = { render: () => <ReadingFixture /> };
export const Empty: StoryObj<typeof meta> = { args: { agents: [] } };
