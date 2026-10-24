/**
 * What the `AgentGraph` hub layout draws: a node (a brand-marked tile with its
 * name and model under it), the status badge on its corner, and the popover of
 * its recent calls. Status reads as a glyph and a word as well as a colour.
 */

import { Bot, Check, Clock3, LoaderCircle, User, X } from "lucide-react";
import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from "react";
import { ProviderIcon } from "../integrations/provider-logo";
import { ModelBrandStack, modelBrandFor } from "../lib/model-brand";
import type { AgentGraphNode, AgentGraphStatus } from "./agent-graph-layout";
import type { AgentGraphCall, AgentGraphCallKind, AgentGraphTool, HubNodeKind } from "./agent-hub-layout";
import { fmtCost } from "./format";
import { shortModel } from "./naming";
import { STATUS_COLOR } from "./node-ui";

/** One colour per call kind, shared by edges, the legend and popover rows. */
export const CALL_COLOR: Record<AgentGraphCallKind, string> = {
  call: "var(--agent-graph-call, hsl(217 91% 60%))",
  answer: `var(--agent-graph-answer, ${STATUS_COLOR.succeeded})`,
  "needs-you": `var(--agent-graph-needs-you, ${STATUS_COLOR.waiting})`,
  failed: `var(--agent-graph-failed, ${STATUS_COLOR.failed})`,
};
export const CALL_LABEL: Record<AgentGraphCallKind, string> = { call: "Call", answer: "Answer", "needs-you": "Needs you", failed: "Failed" };


export interface HubEntity {
  id: string;
  kind: HubNodeKind;
  label: string;
  sub?: string;
  status?: AgentGraphStatus;
  agent?: AgentGraphNode;
  tool?: AgentGraphTool;
}

function NodeIcon({ entity, size }: { entity: HubEntity; size: number }) {
  if (entity.kind === "you") return <User size={size * 0.42} strokeWidth={2.2} aria-hidden />;
  if (entity.kind === "tool") {
    return <ProviderIcon id={entity.tool?.provider ?? entity.id} displayName={entity.label} size={Math.round(size * 0.46)} className="rounded-[4px]" />;
  }
  const brand = entity.agent?.model ? modelBrandFor(entity.agent.model) : null;
  return brand ? <ModelBrandStack identity={brand} size="sm" /> : <Bot size={size * 0.44} aria-hidden />;
}

/** The corner badge: done, needs you, failed or running, each with its own glyph. */
function StatusBadge({ status }: { status?: AgentGraphStatus }) {
  if (status === "succeeded") return <span className="ag-badge" style={{ background: STATUS_COLOR.succeeded }}><Check size={9} strokeWidth={3} /></span>;
  if (status === "needs-you") return <span className="ag-badge" style={{ background: STATUS_COLOR.waiting }}><Clock3 size={9} strokeWidth={3} /></span>;
  if (status === "failed") return <span className="ag-badge" style={{ background: STATUS_COLOR.failed }}>!</span>;
  if (status === "running") return <span className="ag-badge ag-badge-running"><LoaderCircle size={11} strokeWidth={2.5} /></span>;
  return null;
}

export interface HubNodeProps {
  entity: HubEntity;
  x: number;
  y: number;
  tile: number;
  dimmed: boolean;
  selected: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onOpen: () => void;
  onHover: (on: boolean) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export function HubNode({ entity, x, y, tile, dimmed, selected, buttonRef, onOpen, onHover, onKeyDown }: HubNodeProps) {
  const tone = entity.status === "needs-you" ? STATUS_COLOR.waiting : entity.status === "failed" ? STATUS_COLOR.failed : undefined;
  const subTone = entity.status === "needs-you" ? STATUS_COLOR.waiting : entity.status === "failed" ? STATUS_COLOR.failed : undefined;
  const sub = entity.status === "needs-you" ? "Needs you" : entity.status === "failed" ? "Error" : entity.sub;
  return (
    <button
      ref={buttonRef}
      type="button"
      data-agent-graph-node={entity.id}
      data-kind={entity.kind}
      aria-label={`${entity.label}${entity.sub ? `, ${entity.sub}` : ""}${entity.status ? `, ${entity.status === "needs-you" ? "needs you" : entity.status}` : ""}`}
      aria-expanded={selected}
      className={`ag-node ag-node-${entity.kind}${dimmed ? " ag-dimmed" : ""}${selected ? " ag-selected" : ""}`}
      style={{ left: x, top: y, "--ag-tile": `${tile}px`, ...(tone ? { "--ag-tone": tone } : {}) } as CSSProperties}
      onClick={onOpen}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onKeyDown={onKeyDown}
    >
      <span className="ag-tile">
        <NodeIcon entity={entity} size={tile} />
        <StatusBadge status={entity.status} />
      </span>
      <span className="ag-name">{entity.label}</span>
      {sub && <span className="ag-sub" style={subTone ? { color: subTone } : undefined}>{sub}</span>}
    </button>
  );
}

const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms / 100) * 100 || Math.round(ms)}ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`);

export interface HubPopoverProps {
  entity: HubEntity;
  entities: Map<string, HubEntity>;
  calls: readonly AgentGraphCall[];
  now: number;
  left: number;
  top: number;
  summary?: ReactNode;
  closeRef?: Ref<HTMLButtonElement>;
  onClose: () => void;
}

/** A node's recent calls: who it called or was called by, what for, how long, and what failed. */
export function HubPopover({ entity, entities, calls, now, left, top, summary, closeRef, onClose }: HubPopoverProps) {
  const mine = calls.filter((c) => (c.from === entity.id || c.to === entity.id) && c.startedAt <= now).sort((a, b) => b.startedAt - a.startedAt);
  const recent = mine.slice(0, 5);
  const lastMinute = mine.filter((c) => now - c.startedAt <= 60_000).length;
  const status = entity.status === "needs-you" ? "Needs you" : entity.status === "failed" ? "Error" : entity.status === "running" ? "Running" : entity.status === "succeeded" ? "Done" : undefined;
  const cost = entity.agent?.costUsd;
  return (
    <div role="dialog" aria-label={`${entity.label} calls`} className="ag-popover" style={{ left, top }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="ag-pop-head">
        <span className="ag-tile ag-tile-mini" style={{ "--ag-tile": "28px" } as CSSProperties}><NodeIcon entity={entity} size={28} /></span>
        <span className="ag-pop-title">
          <span className="ag-pop-name">{entity.label}</span>
          {(entity.sub || entity.tool?.detail) && <span className="ag-pop-sub">{entity.tool?.detail ?? entity.sub}</span>}
        </span>
        {status && <span className={`ag-pill ag-pill-${entity.status}`}>{status}</span>}
        <button ref={closeRef} type="button" className="ag-close" aria-label="Close" onClick={onClose}><X size={14} /></button>
      </div>
      {summary && <p className="ag-pop-summary">{summary}</p>}
      {recent.length > 0 && <ul className="ag-pop-calls">
        {recent.map((c) => {
          const outgoing = c.from === entity.id;
          const other = entities.get(outgoing ? c.to : c.from);
          const running = c.durationMs == null;
          return (
            <li key={c.id}>
              <span className="ag-pop-dir" aria-label={outgoing ? "to" : "from"}>{outgoing ? "→" : "←"}</span>
              {other && <span className="ag-tile ag-tile-micro" style={{ "--ag-tile": "16px" } as CSSProperties}><NodeIcon entity={other} size={16} /></span>}
              <span className="ag-pop-call"><b>{other?.label ?? (outgoing ? c.to : c.from)}</b>{c.label ? ` · ${c.label}` : ""}</span>
              <span className="ag-pop-time" style={c.kind === "failed" ? { color: CALL_COLOR.failed } : undefined}>
                {c.kind === "failed" ? "Failed" : running ? <LoaderCircle size={12} className="ag-spin" aria-label="running" /> : fmtMs(c.durationMs!)}
              </span>
            </li>
          );
        })}
      </ul>}
      <p className="ag-pop-foot">
        {cost != null && <b>{fmtCost(cost)}</b>}
        {lastMinute} {lastMinute === 1 ? "call" : "calls"} in the last minute
      </p>
    </div>
  );
}
