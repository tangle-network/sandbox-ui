/**
 * The live agent card for `AgentGraph live`: one agent at work, while it works. Its status pill breathes while it runs,
 * its thinking line reads in two lines, and its latest events stream in at the bottom with what they did and how long
 * ago, older lines fading as new ones arrive. A finished or stopped agent shrinks to a chip with its result in the same
 * slot; a failed agent keeps its whole card, its failure in place of the thinking line and its events at the times they ran,
 * so the layout never moves while a run updates.
 */

import type { Node, NodeProps } from "@xyflow/react";
import { FileText, GitBranch, Globe, Hourglass, type LucideIcon, Pencil, Search, Sparkles, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import type { AgentGraphDirection, AgentGraphNode, AgentGraphStatus } from "./agent-graph-layout";
import { agentStatus, agentSummary, Handles, StatusGlyph, cardBorder } from "./agent-graph-parts";
import { SELECTION_OUTLINE } from "./canvas-theme";
import { KIND_ACCENT, NodeMark, RESTING_SHADOW } from "./node-ui";

export type LiveAgentCardNode = Node<
  { agent: AgentGraphNode; selected: boolean; direction: AgentGraphDirection; now?: number },
  "liveAgent"
>;

// A failure keeps its evidence: only finished and stopped agents settle into a chip (critique P0 #5).
const SETTLED: ReadonlySet<AgentGraphStatus> = new Set(["succeeded", "stopped"]);

// An event names its tool first ("bash cargo test", "edit src/fold.rs"); the glyph says which kind of work it was.
const EVENT_GLYPHS: readonly (readonly [RegExp, LucideIcon])[] = [
  [/^(bash|sh|run|exec|cargo|npm|pnpm|make)\b/, Terminal],
  [/^(edit|write|patch|apply)\b/, Pencil],
  [/^(read|cat|open|view|ls|glob)\b/, FileText],
  [/^(grep|search|find|rg)\b/, Search],
  [/^(web|fetch|http|browse)\b/, Globe],
  [/^(spawn|steer|release|merge|commit|git)\b/, GitBranch],
  [/^(wait|sleep|queue)\b/, Hourglass],
];
const eventGlyph = (label: string) => EVENT_GLYPHS.find(([match]) => match.test(label.toLowerCase()))?.[1] ?? Sparkles;

function clockTime(at: number | undefined): string | undefined {
  return at == null || !Number.isFinite(at) ? undefined : new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function ago(at: number | undefined, now: number): string | undefined {
  if (at == null || !Number.isFinite(at)) return undefined;
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
}

function aliveFor(startedAt: number | null | undefined, now: number): string | undefined {
  if (startedAt == null || !Number.isFinite(startedAt)) return undefined;
  const s = Math.max(0, Math.round((now - startedAt) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Time alive ticks once a second while the host follows now; a replay passes its own clock. */
function useNow(fixed: number | undefined, live: boolean): number {
  const [now, setNow] = useState(() => fixed ?? Date.now());
  useEffect(() => {
    if (fixed !== undefined || !live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [fixed, live]);
  return fixed ?? now;
}

export function LiveAgentCard({ data }: NodeProps<LiveAgentCardNode>) {
  const { agent, selected, direction } = data;
  const settled = SETTLED.has(agent.status);
  const failed = agent.status === "failed";
  const now = useNow(data.now, !settled && !failed);
  const s = agentStatus(agent.status);
  const alive = aliveFor(agent.startedAt, now);

  if (settled) {
    return (
      <div className="ag-live-slot" data-status={agent.status} title={agentSummary(agent)}>
        <Handles direction={direction} />
        <div className="ag-live-chip" data-selected={selected || undefined} style={selected ? SELECTION_OUTLINE : undefined}>
          <StatusGlyph status={agent.status} size={13} />
          <span className="ag-live-chip-name">{agent.label}</span>
          <span className="ag-live-chip-result">{agent.result ?? s.label}</span>
        </div>
      </div>
    );
  }

  // The vendor prefix ("anthropic/") is in the brand mark already; the tooltip keeps the full id.
  const meta = [agent.model?.replace(/^[\w-]+\//, ""), agent.effort].filter(Boolean).join(" · ");
  const events = (agent.events ?? []).slice(-3);
  return (
    <div
      className="ag-live-card"
      data-status={agent.status}
      data-activity={agent.activity ?? undefined}
      data-selected={selected || undefined}
      title={agentSummary(agent)}
      style={{ boxShadow: RESTING_SHADOW, ...cardBorder(agent.status), ...(selected ? SELECTION_OUTLINE : {}), ["--ag-status" as string]: s.color }}
    >
      <Handles direction={direction} />
      <div className="ag-live-head">
        <NodeMark kind="agent.run" model={agent.model ?? undefined} accent={KIND_ACCENT["agent.run"]} tile={28} />
        <div className="ag-live-names">
          <span className="ag-live-name">{agent.label}</span>
          {meta && <span className="ag-live-meta">{meta}</span>}
        </div>
        <div className="ag-live-stats">
          <span className="ag-live-pill"><span className="ag-live-dot" aria-hidden />{s.label}</span>
          <span>
            {alive && <span title="Time alive">{alive}</span>}
            {agent.commits != null && <span title="Commits shipped">{alive ? " · " : ""}{agent.commits} {agent.commits === 1 ? "commit" : "commits"}</span>}
          </span>
        </div>
      </div>
      {failed ? (
        <p className="ag-live-thinking ag-live-failure">{agent.result ?? events.at(-1)?.label ?? s.label}</p>
      ) : (
        <p className="ag-live-thinking" key={agent.turn ?? ""}>
          {agent.turn || <span className="ag-live-quiet">{s.label}</span>}
        </p>
      )}
      <ol className="ag-live-events" aria-label="Latest events">
        {events.map((event) => {
          const Glyph = eventGlyph(event.label);
          // A failed card is frozen: its events keep the clock time they ran, not an age that keeps growing.
          const when = failed ? clockTime(event.at) : ago(event.at, now);
          return (
            <li key={event.id}>
              <Glyph aria-hidden size={12} strokeWidth={2} />
              <span className="ag-live-event-label">{event.label}</span>
              {when && <time className="ag-live-event-at">{when}</time>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
