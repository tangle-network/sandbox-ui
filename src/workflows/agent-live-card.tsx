/**
 * The live agent card for `AgentGraph live`: one agent at work, while it works. A small ASCII figure loops the agent's
 * real activity, its latest thinking line and last three events slide in as they arrive, and a settled agent shrinks to
 * a dimmed chip with its result in the same slot, so the layout never moves while a run updates.
 */

import type { Node, NodeProps } from "@xyflow/react";
import { useEffect, useState } from "react";
import type { AgentGraphActivity, AgentGraphDirection, AgentGraphNode, AgentGraphStatus } from "./agent-graph-layout";
import { agentStatus, agentSummary, Handles, StatusGlyph, cardBorder } from "./agent-graph-parts";
import { SELECTION_OUTLINE } from "./canvas-theme";
import { KIND_ACCENT, NodeMark, RESTING_SHADOW } from "./node-ui";

export type LiveAgentCardNode = Node<
  { agent: AgentGraphNode; selected: boolean; direction: AgentGraphDirection; now?: number },
  "liveAgent"
>;

const SETTLED: ReadonlySet<AgentGraphStatus> = new Set(["succeeded", "failed", "stopped"]);

// Each loop is three lines of plain ASCII, four frames; the body stays put and only the work beside it moves.
const FIGURES: Record<AgentGraphActivity, readonly (readonly [string, string, string])[]> = {
  thinking: [
    ["  o    ", " /|\\   ", " / \\   "],
    ["  o .  ", " /|\\   ", " / \\   "],
    ["  o .. ", " /|\\   ", " / \\   "],
    ["  o ...", " /|\\   ", " / \\   "],
  ],
  reading: [
    ["  o    ", " /|\\[-]", " / \\   "],
    ["  o    ", " /|\\[=]", " / \\   "],
    ["  o    ", " /|\\[#]", " / \\   "],
    ["  o    ", " /|\\[=]", " / \\   "],
  ],
  building: [
    ["  o  T ", " /|\\/  ", " / \\## "],
    ["  o    ", " /|\\-T ", " / \\## "],
    ["  o  T ", " /|\\/  ", " / \\###"],
    ["  o    ", " /|\\-T ", " / \\###"],
  ],
  proving: [
    ["  o |- ", " /|\\   ", " / \\   "],
    ["  o |= ", " /|\\   ", " / \\   "],
    ["  o |=-", " /|\\   ", " / \\   "],
    ["  o QED", " /|\\   ", " / \\   "],
  ],
  writing: [
    ["  o    ", " /|\\_/ ", " / \\.  "],
    ["  o    ", " /|\\_/ ", " / \\.. "],
    ["  o    ", " /|\\_/ ", " / \\..."],
    ["  o    ", " /|\\_/ ", " / \\   "],
  ],
  waiting: [
    ["  o  z ", " /|\\   ", " / \\   "],
    ["  o  zZ", " /|\\   ", " / \\   "],
    ["  o zZz", " /|\\   ", " / \\   "],
    ["  o    ", " /|\\   ", " / \\   "],
  ],
  restarting: [
    ["  o  | ", " /|\\   ", " / \\   "],
    ["  o  / ", " /|\\   ", " / \\   "],
    ["  o  - ", " /|\\   ", " / \\   "],
    ["  o  \\ ", " /|\\   ", " / \\   "],
  ],
};

/** The activity a status implies when the host sends none. */
function activityOf(agent: AgentGraphNode): AgentGraphActivity {
  if (agent.activity && FIGURES[agent.activity]) return agent.activity;
  if (agent.status === "waiting" || agent.status === "needs-you" || agent.status === "idle") return "waiting";
  return "thinking";
}

/** Every frame is stacked in one block and a stepped animation slides it: no timer per card, and reduced motion keeps
 *  the first frame. */
function Figure({ activity }: { activity: AgentGraphActivity }) {
  const frames = FIGURES[activity];
  return (
    <div className="ag-live-figure" aria-hidden data-activity={activity}>
      <pre style={{ ["--ag-frames" as string]: frames.length }}>
        {frames.map((frame) => frame.join("\n")).join("\n")}
      </pre>
    </div>
  );
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
  const now = useNow(data.now, !settled);
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

  const meta = [agent.model, agent.effort].filter(Boolean).join(" · ");
  const events = (agent.events ?? []).slice(-3);
  return (
    <div
      className="ag-live-card"
      data-status={agent.status}
      data-selected={selected || undefined}
      title={agentSummary(agent)}
      style={{ boxShadow: RESTING_SHADOW, ...cardBorder(agent.status), ...(selected ? SELECTION_OUTLINE : {}) }}
    >
      <Handles direction={direction} />
      <div className="ag-live-head">
        <NodeMark kind="agent.run" model={agent.model ?? undefined} accent={KIND_ACCENT["agent.run"]} tile={24} />
        <div className="ag-live-names">
          <span className="ag-live-name">{agent.label}</span>
          {meta && <span className="ag-live-meta">{meta}</span>}
        </div>
        <div className="ag-live-stats">
          {alive && <span title="Time alive">{alive}</span>}
          {agent.commits != null && <span title="Commits shipped">{agent.commits} {agent.commits === 1 ? "commit" : "commits"}</span>}
        </div>
      </div>
      <div className="ag-live-body">
        <Figure activity={activityOf(agent)} />
        <div className="ag-live-text">
          <p className="ag-live-thinking" key={agent.turn ?? ""}>
            {agent.turn || <span className="ag-live-quiet">{s.label}</span>}
          </p>
          <ol className="ag-live-events" aria-label="Latest events">
            {events.map((event) => <li key={event.id}>{event.label}</li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Shipped with the component, scoped under `.ag-live`, on the package's theme tokens. Type 11/12/13 px, 4 px grid. */
export const AGENT_LIVE_CSS = `
.ag-live { --ag-fg: hsl(var(--foreground)); --ag-muted: hsl(var(--muted-foreground)); --ag-surface: hsl(var(--card)); --ag-border: hsl(var(--border)); }
.ag-live .ag-live-card { position: relative; display: flex; flex-direction: column; gap: 8px; width: 100%; height: 100%; padding: 12px; border: 1px solid var(--ag-border);
  border-radius: 12px; background: var(--ag-surface); color: var(--ag-fg); cursor: pointer; overflow: hidden; animation: ag-live-grow 360ms cubic-bezier(.2,.8,.2,1) both; transform-origin: 50% 0; }
.ag-live .ag-live-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ag-live .ag-live-names { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ag-live .ag-live-name { font-size: 13px; line-height: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-live .ag-live-meta, .ag-live .ag-live-stats { font-size: 11px; line-height: 16px; color: var(--ag-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-live .ag-live-stats { display: flex; flex-direction: column; align-items: flex-end; font-variant-numeric: tabular-nums; flex: none; }
.ag-live .ag-live-body { display: flex; gap: 8px; min-height: 0; flex: 1; }
.ag-live .ag-live-figure { flex: none; width: 60px; height: 48px; overflow: hidden; border-radius: 8px; background: color-mix(in oklab, var(--ag-fg) 5%, transparent); }
.ag-live .ag-live-figure pre { margin: 0; padding: 0 4px; font: 11px/16px var(--font-mono, ui-monospace, monospace); color: var(--ag-fg); white-space: pre;
  animation: ag-live-frames calc(var(--ag-frames) * 280ms) steps(var(--ag-frames)) infinite; }
.ag-live .ag-live-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.ag-live .ag-live-thinking { margin: 0; font-size: 12px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: ag-live-in 220ms ease-out both; }
.ag-live .ag-live-quiet { color: var(--ag-muted); }
.ag-live .ag-live-events { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0; }
.ag-live .ag-live-events li { font: 11px/16px var(--font-mono, ui-monospace, monospace); color: var(--ag-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: ag-live-in 220ms ease-out both; }
.ag-live .ag-live-events li:last-child { color: var(--ag-fg); }
.ag-live .ag-live-slot { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.ag-live .ag-live-chip { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; height: 32px; padding: 0 12px; border: 1px solid var(--ag-border); border-radius: 16px;
  background: var(--ag-surface); color: var(--ag-muted); font-size: 12px; opacity: .72; cursor: pointer; animation: ag-live-settle 320ms cubic-bezier(.2,.8,.2,1) both; }
.ag-live .ag-live-chip-name { color: var(--ag-fg); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-live .ag-live-chip-result { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@keyframes ag-live-frames { to { transform: translateY(calc(var(--ag-frames) * -48px)); } }
@keyframes ag-live-grow { from { opacity: 0; transform: scale(.7) translateY(-12px); } }
@keyframes ag-live-in { from { opacity: 0; transform: translateY(4px); } }
@keyframes ag-live-settle { from { opacity: 1; transform: scale(1.12); } }
@media (prefers-reduced-motion: reduce) { .ag-live * { animation: none !important; } }
`;
