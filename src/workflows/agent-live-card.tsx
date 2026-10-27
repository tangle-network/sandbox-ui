/**
 * The live agent card for `AgentGraph live`: one agent at work, while it works. Its status pill breathes while it runs,
 * its thinking line reads in two lines, and its latest events stream in at the bottom with what they did and how long
 * ago, older lines fading as new ones arrive. A settled agent shrinks to a dimmed chip with its result in the same slot,
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

const SETTLED: ReadonlySet<AgentGraphStatus> = new Set(["succeeded", "failed", "stopped"]);

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
      <p className="ag-live-thinking" key={agent.turn ?? ""}>
        {agent.turn || <span className="ag-live-quiet">{s.label}</span>}
      </p>
      <ol className="ag-live-events" aria-label="Latest events">
        {events.map((event) => {
          const Glyph = eventGlyph(event.label);
          const when = ago(event.at, now);
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

/** Shipped with the component, scoped under `.ag-live`, on the package's theme tokens. Type 11/12/13/14 px, 4 px grid. */
export const AGENT_LIVE_CSS = `
.ag-live { --ag-fg: hsl(var(--foreground)); --ag-muted: hsl(var(--muted-foreground)); --ag-surface: hsl(var(--card)); --ag-border: hsl(var(--border)); }
.ag-live .ag-live-card { position: relative; display: flex; flex-direction: column; gap: 8px; width: 100%; height: 100%; padding: 12px; border: 1px solid var(--ag-border);
  border-radius: 14px; background: var(--ag-surface); color: var(--ag-fg); cursor: pointer; overflow: hidden; animation: ag-live-grow 420ms cubic-bezier(.2,.8,.2,1) both; transform-origin: 50% 0;
  transition: border-color 200ms ease, box-shadow 200ms ease, transform 200ms cubic-bezier(.2,.8,.2,1); }
.ag-live .ag-live-card:hover { transform: translateY(-1px); }
/* A running agent's card carries a thin travelling sheen along its top edge: work in progress without a glowing border. */
.ag-live .ag-live-card[data-status="running"]::before { content: ""; position: absolute; inset: 0 0 auto; height: 2px;
  background: linear-gradient(90deg, transparent, var(--ag-status), transparent); background-size: 40% 100%; background-repeat: no-repeat; animation: ag-live-sheen 2.4s ease-in-out infinite; }
.ag-live .ag-live-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ag-live .ag-live-names { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ag-live .ag-live-name { font-size: 14px; line-height: 18px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-live .ag-live-meta, .ag-live .ag-live-stats { font-size: 11px; line-height: 14px; color: var(--ag-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-live .ag-live-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-variant-numeric: tabular-nums; flex: none; }
.ag-live .ag-live-pill { display: inline-flex; align-items: center; gap: 4px; height: 16px; padding: 0 6px; border-radius: 8px; font-weight: 600; color: var(--ag-status);
  background: color-mix(in oklab, var(--ag-status) 14%, transparent); }
.ag-live .ag-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ag-status); }
.ag-live [data-status="running"] .ag-live-dot { animation: ag-live-breathe 1.6s ease-in-out infinite; }
.ag-live .ag-live-thinking { flex: none; margin: 0; font-size: 13px; line-height: 17px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; animation: ag-live-in 260ms ease-out both; }
.ag-live .ag-live-quiet { color: var(--ag-muted); }
.ag-live .ag-live-events { margin: auto 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
.ag-live .ag-live-events li { display: flex; align-items: center; gap: 6px; height: 16px; font: 11px/16px var(--font-mono, ui-monospace, monospace); color: var(--ag-muted);
  animation: ag-live-in 260ms cubic-bezier(.2,.8,.2,1) both; }
.ag-live .ag-live-events li svg { flex: none; opacity: .8; }
/* Older lines fade back so the newest reads first, as a log tail does. */
.ag-live .ag-live-events li:nth-last-child(3) { opacity: .55; }
.ag-live .ag-live-events li:nth-last-child(2) { opacity: .8; }
.ag-live .ag-live-events li:last-child { color: var(--ag-fg); animation: ag-live-in 260ms cubic-bezier(.2,.8,.2,1) both, ag-live-flash 1.2s ease-out both; }
.ag-live .ag-live-event-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-live .ag-live-event-at { flex: none; font-family: inherit; color: var(--ag-muted); font-variant-numeric: tabular-nums; }
.ag-live .ag-live-slot { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.ag-live .ag-live-chip { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; height: 32px; padding: 0 12px; border: 1px solid var(--ag-border); border-radius: 16px;
  background: var(--ag-surface); color: var(--ag-muted); font-size: 12px; opacity: .72; cursor: pointer; animation: ag-live-settle 320ms cubic-bezier(.2,.8,.2,1) both; }
.ag-live .ag-live-chip-name { color: var(--ag-fg); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-live .ag-live-chip-result { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@keyframes ag-live-sheen { from { background-position: -40% 0; } to { background-position: 140% 0; } }
@keyframes ag-live-breathe { 50% { opacity: .35; transform: scale(.8); } }
@keyframes ag-live-flash { from { background: color-mix(in oklab, var(--ag-status) 16%, transparent); } to { background: transparent; } }
@keyframes ag-live-grow { from { opacity: 0; transform: scale(.92) translateY(-8px); } }
@keyframes ag-live-in { from { opacity: 0; transform: translateY(6px); } }
@keyframes ag-live-settle { from { opacity: 1; transform: scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .ag-live * { animation: none !important; } .ag-live .ag-live-card:hover { transform: none; } }
`;
