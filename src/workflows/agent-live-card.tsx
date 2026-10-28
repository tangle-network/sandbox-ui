import type { Node, NodeProps } from "@xyflow/react";
import { toolGlyph } from "@tangle-network/charts/react";
import { useRef } from "react";
import type { AgentGraphDirection, AgentGraphNode, AgentGraphStatus } from "./agent-graph-layout";
import { agentStatus, agentSummary, Handles, StatusGlyph, cardBorder } from "./agent-graph-parts";
import { SELECTION_OUTLINE } from "./canvas-theme";
import { KIND_ACCENT, NodeMark, RESTING_SHADOW } from "./node-ui";
import { quietActivity, useAttention, useRunNow } from "./run-ui-state";

export type LiveAgentCardNode = Node<
  { agent: AgentGraphNode; selected: boolean; direction: AgentGraphDirection; now?: number; onRespond?: () => void }, "liveAgent"
>;
const SETTLED: ReadonlySet<AgentGraphStatus> = new Set(["succeeded", "stopped"]);

function eventTime(at: number | undefined, now: number, frozen: boolean) {
  if (at == null || !Number.isFinite(at)) return "—";
  if (frozen) return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  return seconds < 5 ? "now" : seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`;
}
function middleLabel(label: string) {
  return label.length <= 52 ? label : `${label.slice(0, 32)} … ${label.slice(-17)}`;
}

/** One shell survives settling. A failure retains its evidence and absolute event times. */
export function LiveAgentCardView({ agent, selected, direction = "TB", now: fixed, handles = false, onRespond }: {
  agent: AgentGraphNode; selected: boolean; direction?: AgentGraphDirection; now?: number; handles?: boolean; onRespond?: () => void;
}) {
  const now = useRunNow(fixed);
  const ref = useRef<HTMLDivElement>(null);
  useAttention(ref, agent.status);
  const settled = SETTLED.has(agent.status);
  const failed = agent.status === "failed";
  const quiet = quietActivity(agent, now);
  const s = agentStatus(agent.status);
  const meta = [agent.model?.replace(/^[\w-]+\//, ""), agent.effort].filter(Boolean).join(" · ");
  const events = (agent.events ?? []).slice(-4);
  return (
    <div className="ag-live-slot">
      {handles && <Handles direction={direction} />}
      <div ref={ref} className={`ag-live-card${settled ? " ag-live-chip" : ""}`} data-status={agent.status}
        data-activity={quiet ? "quiet" : agent.activity ?? undefined} data-selected={selected || undefined}
        title={agentSummary(agent)}
        style={{ boxShadow: RESTING_SHADOW, ...cardBorder(agent.status), ...(selected ? SELECTION_OUTLINE : {}), ["--ag-status" as string]: s.color }}>
        <div className="ag-live-head">
          <NodeMark kind="agent.run" model={agent.model ?? undefined} accent={KIND_ACCENT["agent.run"]} tile={18} />
          <div className="ag-live-names">
            <span className="ag-live-name">{agent.label}</span>
            {!settled && meta && <span className="ag-live-meta">{meta}</span>}
          </div>
          <div className="ag-live-stats">
            <span className="ag-live-pill"><StatusGlyph status={agent.status} size={16} />{s.label}</span>
            {!settled && <span>{agent.startedAt != null ? `${eventTime(agent.startedAt, failed ? events.at(-1)?.at ?? agent.startedAt : now, false)} · ` : ""}{agent.commits == null ? "—" : `${agent.commits} ${agent.commits === 1 ? "commit" : "commits"}`}</span>}
          </div>
        </div>
        {settled ? <span className="ag-live-chip-result">{agent.result ?? s.label}</span> : <>
          <p className={`ag-live-thinking${failed ? " ag-live-failure" : ""}`}>
            {failed ? agent.result ?? events.at(-1)?.label ?? s.label : agent.turn || "—"}
          </p>
          {quiet && <span className="ag-live-quiet">{quiet.label}</span>}
          {agent.status === "waiting" && <span className="ag-live-blocker">{agent.turn || "Waiting on peer"}</span>}
          {agent.status === "needs-you" && <button type="button" className="ag-live-respond nodrag nopan" onClick={event => { event.stopPropagation(); onRespond?.(); }}>Respond</button>}
          <ol className="ag-live-events" aria-label="Latest events">
            {events.map(event => <li key={event.id} title={event.label}>
              {toolGlyph(event.label)}
              <span className="ag-live-event-label">{middleLabel(event.label)}</span>
              <time className="ag-live-event-at">{eventTime(event.at, now, failed)}</time>
            </li>)}
          </ol>
        </>}
      </div>
    </div>
  );
}
export function LiveAgentCard({ data }: NodeProps<LiveAgentCardNode>) {
  return <LiveAgentCardView {...data} handles />;
}
