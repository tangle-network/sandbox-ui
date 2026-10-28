/** The hub presents agent and tool calls on a stable canvas or a readable list. */

import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AgentGraphEdge, AgentGraphNode } from "./agent-graph-layout";
import { AGENT_HUB_CSS } from "./agent-hub-css";
import {
  type AgentGraphCall, type AgentGraphTool, HUB_METRICS, HUB_METRICS_COMPACT, type HubMetrics, layoutHub, orthogonalPath, YOU_ID,
} from "./agent-hub-layout";
import { CALL_COLOR, CALL_LABEL, type HubEntity, HubNode, HubPopover } from "./agent-hub-parts";
import { shortModel } from "./naming";
import { quietActivity, tokenMilliseconds, useMotionAllowed, useRunNow } from "./run-ui-state";
import { RunStatusIcon, statusMeta } from "@tangle-network/ui/run";
import { fmtCost } from "./format";

const PAD_X = 84;
const PAD_Y = 36;

export interface AgentHubCanvasProps {
  nodes: readonly AgentGraphNode[];
  edges: readonly AgentGraphEdge[];
  tools?: readonly AgentGraphTool[];
  calls?: readonly AgentGraphCall[];
  /** Draw the person who asked as "You"; `summary` is the ask, shown in its popover. */
  you?: { label?: string; summary?: string } | boolean;
  /** Epoch ms the graph is drawn at; calls after it are not shown yet. Defaults to now, ticking. */
  now?: number;
  title?: ReactNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function CallStroke({ call, d, length, now, forward, animate }: { call: AgentGraphCall; d: string; length: number; now: number; forward: boolean; animate: boolean }) {
  const ref = useRef<SVGPathElement>(null);
  const end = call.durationMs == null ? Infinity : call.startedAt + call.durationMs;
  const returning = now >= end;
  useEffect(() => {
    const el = ref.current;
    if (!el || !animate || call.kind === "failed") return;
    const ambient = tokenMilliseconds("--duration-ambient", el);
    const duration = Math.min(ambient * .9, Math.max(ambient * .3, length / 320 * 1000));
    const age = now - (returning ? end : call.startedAt);
    if (age > duration) return;
    const reverse = forward === returning;
    const animation = el.animate([{ strokeDashoffset: reverse ? -length : 24, opacity: .35 }, { strokeDashoffset: reverse ? 24 : -length, opacity: .35 }], { duration, easing: "linear" });
    animation.currentTime = Math.max(0, age);
    return () => animation.cancel();
  }, [call.id, returning, animate, length, forward]);
  const age = Math.max(0, now - end);
  return <g style={{ stroke: CALL_COLOR[call.kind] }}>
    <path d={d} className="ag-edge-live" opacity={returning ? Math.max(.35, .55 - age / 40_000) : .55} />
    {animate && <path ref={ref} d={d} className="ag-flow" strokeDasharray={`24 ${length}`} opacity={0} />}
  </g>;
}

export function AgentHubCanvas({ nodes, edges, tools = [], calls = [], you, now: nowProp, title = "Agent graph", selectedId, onSelect, className }: AgentHubCanvasProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const now = useRunNow(nowProp);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(selectedId ?? null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const closeRef = useRef<HTMLButtonElement>(null);
  const animate = useMotionAllowed();
  const visibleCalls = useMemo(() => calls.filter((c) => c.startedAt <= now), [calls, now]);
  const layout = useMemo(() => layoutHub({ nodes, edges, tools, calls, you: Boolean(you) }), [nodes, edges, tools, calls, you]);

  const span = (m: HubMetrics) => ({ w: (layout.maxCol - layout.minCol) * m.cellX + PAD_X * 2, h: (layout.maxRow - layout.minRow) * m.cellY + PAD_Y * 2 + m.hubTile + m.label });
  const metrics = width && width / span(HUB_METRICS).w < 0.85 ? HUB_METRICS_COMPACT : HUB_METRICS;
  const { w, h } = span(metrics);
  const list = width > 0 && (width < 600 || width / w < .85);
  const scale = width ? Math.max(.85, Math.min(1, width / w)) : 1;

  const entities = useMemo(() => {
    const map = new Map<string, HubEntity>();
    for (const p of layout.placements) {
      if (p.kind === "you") map.set(p.id, { id: p.id, kind: "you", label: typeof you === "object" && you.label ? you.label : "You" });
      else if (p.kind === "tool") {
        const tool = tools.find((t) => t.id === p.id)!;
        map.set(p.id, { id: p.id, kind: "tool", label: tool.label, tool });
      } else {
        const agent = nodes.find((n) => n.id === p.id)!;
        map.set(p.id, { id: p.id, kind: p.kind, label: agent.label, sub: agent.model ? shortModel(agent.model) : undefined, status: agent.status, quiet: quietActivity(agent, now)?.label, agent });
      }
    }
    return map;
  }, [layout, nodes, tools, you, now]);

  const at = (id: string) => {
    const p = layout.placements.find((q) => q.id === id)!;
    return { x: (p.col - layout.minCol) * metrics.cellX + PAD_X, y: (p.row - layout.minRow) * metrics.cellY + PAD_Y + metrics.hubTile / 2 };
  };

  const edgeState = (from: string, to: string) => {
    let latest: AgentGraphCall | undefined;
    for (const c of visibleCalls) {
      if ((c.from === from && c.to === to) || (c.from === to && c.to === from)) if (!latest || c.startedAt > latest.startedAt) latest = c;
    }
    if (!latest) return undefined;
    return latest;
  };

  const focus = hover ?? open;
  const related = useMemo(() => {
    if (!focus) return null;
    const set = new Set([focus]);
    for (const l of layout.links) {
      if (l.from === focus) set.add(l.to);
      if (l.to === focus) set.add(l.from);
    }
    return set;
  }, [focus, layout]);

  const agents = nodes.length;
  const lastMinute = visibleCalls.filter((c) => now - c.startedAt <= 60_000).length;
  const costs = nodes.map((n) => n.costUsd);
  const cost = costs.every((c) => c != null) ? costs.reduce((s, c) => s + (c ?? 0), 0) : undefined;
  const chips = nodes.filter((n) => n.status === "needs-you" || n.status === "failed" || quietActivity(n, now));

  const openNode = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) onSelect?.(next);
  };
  useEffect(() => { if (open) closeRef.current?.focus({ preventScroll: true }); }, [open]);

  const keydown = (id: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const dir = dirs[event.key];
    if (event.key === "Escape") { setOpen(null); buttons.current.get(id)?.focus(); return; }
    if (event.key === "Home") { event.preventDefault(); nodes[0] && buttons.current.get(nodes[0].id)?.focus(); return; }
    if (!dir) return;
    event.preventDefault();
    const from = at(id);
    let best: string | undefined, bestScore = Infinity;
    for (const p of layout.placements) {
      if (p.id === id) continue;
      const to = at(p.id);
      const dx = to.x - from.x, dy = to.y - from.y;
      const along = dx * dir[0] + dy * dir[1];
      if (along <= 0) continue;
      const score = along + Math.abs(dx * dir[1] - dy * dir[0]) * 2;
      if (score < bestScore) { bestScore = score; best = p.id; }
    }
    if (best) buttons.current.get(best)?.focus();
  };

  const openEntity = open ? entities.get(open) : undefined;
  const popover = openEntity && (() => {
    const p = at(openEntity.id);
    const right = (p.x + 140 + 280) * scale < (width || w);
    const left = right ? (p.x + 40) * scale : Math.max(8, (p.x - 40) * scale - 280);
    const top = list ? 8 : Math.max(8, (p.y - metrics.hubTile / 2 - 8) * scale);
    const summary = openEntity.kind === "you" ? (typeof you === "object" ? you.summary : undefined)
      : openEntity.agent?.turn ?? undefined;
    return <HubPopover entity={openEntity} entities={entities} calls={visibleCalls} now={now} left={left} top={top} summary={summary}
      closeRef={closeRef} onClose={() => { const id = open!; setOpen(null); buttons.current.get(id)?.focus(); }} />;
  })();

  const lanes = new Map<string, number>();
  const laneOf = (node: string) => { const n = lanes.get(node) ?? 0; lanes.set(node, n + 1); return (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 12; };

  return (
    <section className={`ag-root ${className ?? ""}`} aria-label={typeof title === "string" ? title : "Agent graph"}>
      <style>{AGENT_HUB_CSS}</style>
      <header className="ag-head">
        <span className="ag-title"><span className="ag-title-mark" aria-hidden />{title}</span>
        {chips.map(n => <button type="button" key={n.id} className={`ag-chip ag-chip-${n.status}`} onClick={() => openNode(n.id)}><RunStatusIcon status={quietActivity(n, now) ? "waiting" : n.status} aria-hidden />{n.label} {quietActivity(n, now)?.label ?? statusMeta(n.status).label}</button>)}
        <span className="ag-stats">
          <span><b>{agents}</b> {agents === 1 ? "agent" : "agents"}</span>
          <span><b>{tools.length}</b> {tools.length === 1 ? "tool" : "tools"}</span>
          <span><b>{lastMinute}</b> calls/min</span>
          <span title={cost === undefined ? "Not every agent recorded its cost" : undefined}><b>{cost === undefined ? "—" : fmtCost(cost)}</b>{cost === undefined ? " cost" : ""}</span>
        </span>
      </header>
      <div ref={wrap} className={`ag-canvas-wrap${list ? " ag-list-mode" : ""}`} style={list ? undefined : { height: h * scale }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(null); }}>
        {list ? <ul className="ag-mobile">{[...entities.values()].filter(e => e.agent).sort((a, b) => {
          const rank = (e: HubEntity) => e.status === "needs-you" ? 0 : e.status === "failed" ? 1 : e.quiet ? 2 : e.status === "waiting" ? 3 : e.status === "running" ? 4 : 5;
          return rank(a) - rank(b);
        }).map(entity => <li key={entity.id}>
          <HubNode entity={entity} x={0} y={0} tile={32} dimmed={false} selected={open === entity.id}
            buttonRef={el => { if (el) buttons.current.set(entity.id, el); else buttons.current.delete(entity.id); }}
            onOpen={() => openNode(entity.id)} onHover={() => {}} onKeyDown={keydown(entity.id)} />
          <div className="ag-tools">{tools.filter(t => visibleCalls.some(c => c.from === entity.id && c.to === t.id)).map(t =>
            <button type="button" key={t.id} onClick={() => openNode(t.id)}>{t.label}</button>)}</div>
        </li>)}</ul> : <div className="ag-canvas" style={{ width: w, height: h, transform: `scale(${scale})` }}>
          <svg className="ag-edges" width={w} height={h} aria-hidden>
            {layout.links.map((l) => {
              const a = at(l.from), b = at(l.to);
              const fromHub = layout.placements.find((p) => p.id === l.from)?.kind === "hub";
              const sameCol = Math.abs(a.x - b.x) < 1;
              const { d, length } = orthogonalPath(a, b, l.from !== YOU_ID && (fromHub || sameCol), fromHub ? laneOf(l.from) : 0);
              const live = edgeState(l.from, l.to);
              const touches = !related || (related.has(l.from) && related.has(l.to));
              const forward = live ? live.from === l.from : true;
              return (
                <g key={`${l.from}-${l.to}`} className={touches ? undefined : "ag-dimmed"}>
                  <path d={d} className="ag-edge" />
                  {live && <CallStroke call={live} d={d} length={length} now={now} forward={forward} animate={animate} />}
                </g>
              );
            })}
          </svg>
          {layout.placements.map((p) => {
            const entity = entities.get(p.id)!;
            const { x, y } = at(p.id);
            const tile = p.kind === "hub" ? metrics.hubTile : p.kind === "you" ? metrics.tile - 8 : metrics.tile;
            return <HubNode key={p.id} entity={entity} x={x} y={y} tile={tile} dimmed={Boolean(related && !related.has(p.id))}
              selected={open === p.id} buttonRef={(el) => { if (el) buttons.current.set(p.id, el); else buttons.current.delete(p.id); }}
              onOpen={() => openNode(p.id)} onHover={(on) => setHover((prev) => (on ? p.id : prev === p.id ? null : prev))} onKeyDown={keydown(p.id)} />;
          })}
        </div>}
        {popover}
      </div>
      <ul className="ag-legend" aria-label="Edge colours">
        {(["call", "answer", "needs-you", "failed"] as const).map((k) => <li key={k}><span className="ag-legend-line" style={{ background: CALL_COLOR[k] }} />{CALL_LABEL[k]}</li>)}
      </ul>
    </section>
  );
}
