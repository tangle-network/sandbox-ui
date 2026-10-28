import type { Node, NodeProps } from "@xyflow/react";
import { Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AgentGraphDirection, AgentGraphEvent, AgentGraphNode, AgentGraphStatus } from "./agent-graph-layout";
import { agentStatus, agentSummary, Handles, StatusGlyph, cardBorder } from "./agent-graph-parts";
import { SELECTION_OUTLINE } from "./canvas-theme";
import { fmtCost } from "./format";
import { shortModel } from "./naming";
import { KIND_ACCENT, NodeMark, RESTING_SHADOW } from "./node-ui";
import { quietActivity, tokenMilliseconds, useAttention, useMotionAllowed, useRunNow } from "./run-ui-state";

export type LiveAgentCardNode = Node<
  { agent: AgentGraphNode; selected: boolean; direction: AgentGraphDirection; now?: number; onRespond?: () => void; parentLabel?: string; renderEventIcon?: (event: AgentGraphEvent) => ReactNode }, "liveAgent"
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
export function LiveAgentCardView({ agent, selected, direction = "TB", now: fixed, handles = false, onRespond, parentLabel, renderEventIcon }: {
  agent: AgentGraphNode; selected: boolean; direction?: AgentGraphDirection; now?: number; handles?: boolean; onRespond?: () => void; parentLabel?: string; renderEventIcon?: (event: AgentGraphEvent) => ReactNode;
}) {
  const now = useRunNow(fixed);
  const ref = useRef<HTMLDivElement>(null);
  useAttention(ref, agent.status);
  const settled = SETTLED.has(agent.status);
  const failed = agent.status === "failed";
  const quiet = quietActivity(agent, now);
  const s = agentStatus(agent.status);
  const meta = [agent.model ? shortModel(agent.model) : undefined, agent.effort].filter(Boolean).join(" · ");
  const [events, setEvents] = useState(() => (agent.events ?? []).slice(-4));
  const cost = Number.isFinite(agent.costUsd) ? fmtCost(agent.costUsd!) : undefined;
  const metrics = [cost, !failed && agent.startedAt != null ? `${eventTime(agent.startedAt, now, false)} elapsed` : undefined, Number.isFinite(agent.commits) ? `${agent.commits} ${agent.commits === 1 ? "commit" : "commits"}` : undefined].filter(Boolean).join(" · ") || "—";
  const tail = useRef<HTMLOListElement>(null);
  const motion = useMotionAllowed();
  const previous = useRef(events.at(-1)?.id);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(agent.events);
  latest.current = agent.events;
  useEffect(() => {
    if (pending.current !== undefined) return;
    pending.current = setTimeout(() => { setEvents((latest.current ?? []).slice(-4)); pending.current = undefined; }, tokenMilliseconds("--duration-ambient", ref.current) * .15);
  }, [agent.events]);
  useEffect(() => () => clearTimeout(pending.current), []);
  const tailAnimation = useRef<Animation | null>(null);
  useEffect(() => () => tailAnimation.current?.cancel(), []);
  useLayoutEffect(() => {
    const last = events.at(-1)?.id;
    const old = previous.current;
    previous.current = last;
    const element = tail.current;
    if (!motion) { tailAnimation.current?.cancel(); return; }
    if (!element || !old || old === last) return;
    const queued = events.findIndex(event => event.id === old);
    const offset = new DOMMatrix(getComputedStyle(element).transform).m42 + 16;
    tailAnimation.current?.cancel();
    const frames = queued < 0 ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: `translateY(${offset}px)` }, { transform: "translateY(-16px)" }];
    tailAnimation.current = element.animate(frames, { duration: tokenMilliseconds("--duration-stream", element), easing: getComputedStyle(element).getPropertyValue("--ease-standard").trim() });
  }, [events, motion]);
  return (
    <div className="ag-live-slot">
      {handles && <Handles direction={direction} />}
      <div ref={ref} className={`ag-live-card${settled ? " ag-live-chip" : ""}`} data-status={agent.status}
        data-sparse={events.length === 0 || undefined} data-activity={quiet ? "quiet" : agent.activity ?? undefined} data-selected={selected || undefined}
        title={agentSummary(agent)}
        style={{ boxShadow: RESTING_SHADOW, ...cardBorder(agent.status), ...(selected ? SELECTION_OUTLINE : {}), ["--ag-status" as string]: s.color }}>
        {settled && <StatusGlyph status={agent.status} size={16} />}
        <div className="ag-live-head">
          <span className="grayscale hover:grayscale-0"><NodeMark kind="agent.run" model={agent.model ?? undefined} accent={KIND_ACCENT["agent.run"]} tile={18} /></span>
          <div className="ag-live-names">
            <span className="ag-live-name">{parentLabel && <span className="ag-parent-label">{parentLabel} / </span>}{agent.label}</span>
            {!settled && meta && <span className="ag-live-meta">{meta}</span>}
          </div>
          <div className="ag-live-stats">
            <span className={`ag-live-pill${quiet ? " ag-live-quiet" : ""}`}><StatusGlyph status={agent.status} size={16} />{quiet?.label ?? s.label}</span>
            {!settled && <span className="ag-live-accounting" title={metrics}>{metrics}</span>}
          </div>
        </div>
        {settled ? <><span className="ag-live-chip-result">{agent.result ?? agent.turn ?? s.label}</span>{cost && <span className="ag-live-chip-cost" title="Cost">{cost}</span>}</> : <>
          <div className="ag-live-thinking-row"><p className={`ag-live-thinking${failed ? " ag-live-failure" : ""}`}>
            {failed ? agent.result ?? events.at(-1)?.label ?? agent.turn ?? s.label : agent.turn || "—"}
          </p>
          {agent.status === "needs-you" && <button type="button" className="ag-live-respond nodrag nopan" disabled={!onRespond} title={onRespond ? undefined : "Responses unavailable in this view"} onClick={event => { event.stopPropagation(); onRespond?.(); }}>Respond</button>}</div>
          {events.length > 0 && <div className="ag-live-events-clip"><ol ref={tail} className="ag-live-events" aria-label="Latest events">
            {events.map(event => <li key={event.id} title={event.label}>
              {renderEventIcon?.(event) ?? <Wrench size={12} strokeWidth={1.75} aria-hidden />}
              <span className="ag-live-event-label">{middleLabel(event.label)}</span>
              <time className="ag-live-event-at" dateTime={Number.isFinite(event.at) ? new Date(event.at!).toISOString() : undefined}>{failed && event.at != null ? "at " : ""}{eventTime(event.at, now, failed)}</time>
            </li>)}
          </ol></div>}
        </>}
      </div>
    </div>
  );
}
export function LiveAgentCard({ data }: NodeProps<LiveAgentCardNode>) {
  return <LiveAgentCardView {...data} handles />;
}
