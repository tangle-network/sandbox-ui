/** Hub nodes and call details share the run status vocabulary. */

import { Bot, User, Wrench, X } from "lucide-react";
import { runStatus, statusMeta, RunStatusIcon } from "@tangle-network/ui/run";
import { type CSSProperties, type KeyboardEvent, type ReactNode, type Ref, useLayoutEffect, useRef, useState } from "react";
import { ProviderIcon } from "../integrations/provider-logo";
import { ModelBrandStack, modelBrandFor } from "../lib/model-brand";
import type { AgentGraphNode, AgentGraphStatus } from "./agent-graph-layout";
import type { AgentGraphCall, AgentGraphCallKind, AgentGraphTool, HubNodeKind } from "./agent-hub-layout";
import { fmtCost } from "./format";
import { ambientStyle, syncAmbient, useAttention } from "./run-ui-state";

/** One colour per call kind, shared by edges, the legend and popover rows. */
export const CALL_COLOR: Record<AgentGraphCallKind, string> = {
  call: "var(--brand-primary)",
  answer: `var(${statusMeta("done").token})`,
  "needs-you": `var(${statusMeta("needs-you").token})`,
  failed: `var(${statusMeta("failed").token})`,
};
export const CALL_LABEL: Record<AgentGraphCallKind, string> = { call: "Call", answer: "Answer", "needs-you": statusMeta("needs-you").label, failed: statusMeta("failed").label };


export interface HubEntity {
  id: string;
  kind: HubNodeKind;
  label: string;
  sub?: string;
  status?: AgentGraphStatus;
  quiet?: string;
  agent?: AgentGraphNode;
  tool?: AgentGraphTool;
}

function NodeIcon({ entity, size }: { entity: HubEntity; size: number }) {
  if (entity.kind === "you") return <User size={size * 0.42} strokeWidth={2.2} aria-hidden />;
  if (entity.kind === "tool") {
    // Only a named provider has a brand mark; a shell or file tool has none, and looking one up by its id misses every logo CDN.
    const provider = entity.tool?.provider;
    if (!provider) return <Wrench size={size * 0.4} aria-hidden />;
    return <ProviderIcon id={provider} displayName={entity.label} size={Math.round(size * 0.46)} className="ag-model-mark" />;
  }
  const brand = entity.agent?.model ? modelBrandFor(entity.agent.model) : null;
  return brand ? <span className="ag-model-mark"><ModelBrandStack identity={brand} size="sm" /></span> : <Bot size={16} aria-hidden />;
}

/** Running has one quiet opacity signal; all other states use the shared glyph. */
function StatusBadge({ status, quiet }: { status?: AgentGraphStatus; quiet?: string }) {
  if (!status) return null;
  return <span className="ag-badge">{runStatus(status) === "running"
    ? <span className="ag-running-dot" data-motion="essential" aria-label="Running" style={quiet ? { animation: "none", background: "var(--muted-foreground)" } : ambientStyle} onAnimationStart={syncAmbient} />
    : <RunStatusIcon status={status} />}</span>;
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
  const attentionRef = useRef<HTMLButtonElement>(null);
  useAttention(attentionRef, entity.status ?? "unknown");
  const attention = entity.status === "needs-you" || entity.status === "failed";
  const tone = attention ? `var(${statusMeta(entity.status!).token})` : undefined;
  const sub = entity.quiet ?? (entity.status === "needs-you" ? "Needs you · Respond" : entity.status === "waiting" ? entity.agent?.turn || "Waiting on peer" : entity.status === "failed" ? entity.agent?.result ?? entity.agent?.turn ?? "Failure cause not recorded" : entity.sub ? `${statusMeta(entity.status ?? "unknown").label} · ${entity.sub}` : entity.status ? statusMeta(entity.status).label : undefined);
  return (
    <button
      ref={(el) => { attentionRef.current = el; if (typeof buttonRef === "function") buttonRef(el); else if (buttonRef) buttonRef.current = el; }}
      type="button"
      data-agent-graph-node={entity.id}
      data-kind={entity.kind}
      data-status={entity.status}
      data-activity={entity.quiet ? "quiet" : undefined}
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
        <StatusBadge status={entity.status} quiet={entity.quiet} />
      </span>
      <span className="ag-name">{entity.label}</span>
      {sub && <span className="ag-sub" style={tone ? { color: tone } : undefined}>{entity.quiet ? <>{statusMeta(entity.status ?? "running").label} · <span style={{ color: "var(--surface-warning-text)" }}>{sub}</span></> : sub}</span>}
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
  const element = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState<{ left: number; top: number; maxHeight?: number }>({ left, top });
  useLayoutEffect(() => {
    const dialog = element.current, container = dialog?.parentElement;
    if (!dialog || !container) return;
    const fit = () => {
      const relative = getComputedStyle(dialog).position !== "absolute";
      const maxHeight = Math.max(0, container.clientHeight - 16);
      const height = Math.min(dialog.scrollHeight + dialog.offsetHeight - dialog.clientHeight, maxHeight);
      const next = relative ? { left, top } : { left: Math.max(8, Math.min(left, container.clientWidth - dialog.offsetWidth - 8)), top: Math.max(8, Math.min(top, container.clientHeight - height - 8)), maxHeight };
      setFitted(previous => previous.left === next.left && previous.top === next.top && previous.maxHeight === next.maxHeight ? previous : next);
    };
    fit();
    const observer = new ResizeObserver(fit); observer.observe(dialog); observer.observe(container);
    return () => observer.disconnect();
  }, [left, top]);
  const mine = calls.filter((c) => (c.from === entity.id || c.to === entity.id) && c.startedAt <= now).sort((a, b) => b.startedAt - a.startedAt);
  const recent = mine.slice(0, 5);
  const lastMinute = mine.filter((c) => now - c.startedAt <= 60_000).length;
  const status = entity.status ? statusMeta(entity.status).label : undefined;
  const cost = entity.agent?.costUsd;
  return (
    <div ref={element} role="dialog" aria-label={`${entity.label} calls`} className="ag-popover" style={fitted}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="ag-pop-head">
        <span className="ag-tile ag-tile-mini" style={{ "--ag-tile": "28px" } as CSSProperties}><NodeIcon entity={entity} size={28} /></span>
        <span className="ag-pop-title">
          <span className="ag-pop-name">{entity.label}</span>
          {(entity.agent?.model || entity.sub || entity.tool?.detail) && <span className="ag-pop-sub">{entity.agent?.model ?? entity.tool?.detail ?? entity.sub}</span>}
        </span>
        {status && <span className={`ag-pill ag-pill-${entity.status}`}>{entity.status === "running" && !entity.quiet ? <span className="ag-running-dot" data-motion="essential" style={ambientStyle} onAnimationStart={syncAmbient} /> : <RunStatusIcon status={entity.quiet ? "waiting" : entity.status!} aria-hidden />}{entity.quiet ?? status}</span>}
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
                {c.kind === "failed" ? "Failed" : running ? <span className="ag-running-dot" data-motion="essential" aria-label="Running" style={ambientStyle} onAnimationStart={syncAmbient} /> : fmtMs(c.durationMs!)}
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
