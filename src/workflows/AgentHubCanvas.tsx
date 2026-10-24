/**
 * The hub layout of `AgentGraph`: who asked (You), the orchestrator, the agents
 * it runs and the tools they call, with each call travelling along its edge in
 * its kind's colour. Plain DOM and SVG on a fixed grid, so it renders on the
 * server, scales to its container, and costs no graph library.
 */

import { type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AgentGraphEdge, AgentGraphNode } from "./agent-graph-layout";
import { AGENT_HUB_CSS } from "./agent-hub-css";
import {
  type AgentGraphCall, type AgentGraphTool, HUB_METRICS, HUB_METRICS_COMPACT, type HubMetrics, layoutHub, orthogonalPath, YOU_ID,
} from "./agent-hub-layout";
import { CALL_COLOR, CALL_LABEL, type HubEntity, HubNode, HubPopover } from "./agent-hub-parts";
import { shortModel } from "./naming";
import { motionAllowed } from "./canvas-theme";
import { fmtCost } from "./format";

/** A call shows on its edge while it runs and for this long after it ends. */
const ACTIVE_MS = 2600;
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

function useNow(now: number | undefined) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (now !== undefined) return;
    const timer = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(timer);
  }, [now]);
  return now ?? tick;
}

export function AgentHubCanvas({ nodes, edges, tools = [], calls = [], you, now: nowProp, title = "Agent graph", selectedId, onSelect, className }: AgentHubCanvasProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const now = useNow(nowProp);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(selectedId ?? null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const closeRef = useRef<HTMLButtonElement>(null);
  const animate = useMemo(() => motionAllowed(), []);
  const visibleCalls = useMemo(() => calls.filter((c) => c.startedAt <= now), [calls, now]);
  const layout = useMemo(() => layoutHub({ nodes, edges, tools, calls, you: Boolean(you) }), [nodes, edges, tools, calls, you]);

  // Full metrics when they fit at three quarters scale or better, else the compact grid.
  const span = (m: HubMetrics) => ({ w: (layout.maxCol - layout.minCol) * m.cellX + PAD_X * 2, h: (layout.maxRow - layout.minRow) * m.cellY + PAD_Y * 2 + m.label });
  const metrics = width && width / span(HUB_METRICS).w < 0.75 ? HUB_METRICS_COMPACT : HUB_METRICS;
  const { w, h } = span(metrics);
  const scale = width ? Math.min(1, width / w) : 1;

  const entities = useMemo(() => {
    const map = new Map<string, HubEntity>();
    for (const p of layout.placements) {
      if (p.kind === "you") map.set(p.id, { id: p.id, kind: "you", label: typeof you === "object" && you.label ? you.label : "You" });
      else if (p.kind === "tool") {
        const tool = tools.find((t) => t.id === p.id)!;
        map.set(p.id, { id: p.id, kind: "tool", label: tool.label, tool });
      } else {
        const agent = nodes.find((n) => n.id === p.id)!;
        map.set(p.id, { id: p.id, kind: p.kind, label: agent.label, sub: agent.model ? shortModel(agent.model) : undefined, status: agent.status, agent });
      }
    }
    return map;
  }, [layout, nodes, tools, you]);

  const at = (id: string) => {
    const p = layout.placements.find((q) => q.id === id)!;
    return { x: (p.col - layout.minCol) * metrics.cellX + PAD_X, y: (p.row - layout.minRow) * metrics.cellY + PAD_Y + metrics.hubTile / 2 };
  };

  // Each edge carries its latest call while it is live: kind, direction and whether it still runs.
  const edgeState = (from: string, to: string) => {
    let latest: AgentGraphCall | undefined;
    for (const c of visibleCalls) {
      if ((c.from === from && c.to === to) || (c.from === to && c.to === from)) if (!latest || c.startedAt > latest.startedAt) latest = c;
    }
    if (!latest) return undefined;
    const end = latest.durationMs == null ? Infinity : latest.startedAt + latest.durationMs;
    return now - end <= ACTIVE_MS ? latest : undefined;
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
  const chips = nodes.filter((n) => n.status === "needs-you" || n.status === "failed");

  const openNode = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) onSelect?.(next);
  };
  useEffect(() => { if (open) closeRef.current?.focus({ preventScroll: true }); }, [open]);

  // Arrow keys move to the nearest node in that direction.
  const keydown = (id: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const dir = dirs[event.key];
    if (event.key === "Escape") { setOpen(null); return; }
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
    const top = Math.max(8, (p.y - metrics.hubTile / 2 - 8) * scale);
    const summary = openEntity.kind === "you" ? (typeof you === "object" ? you.summary : undefined)
      : openEntity.agent?.turn ?? undefined;
    return <HubPopover entity={openEntity} entities={entities} calls={visibleCalls} now={now} left={left} top={top} summary={summary}
      closeRef={closeRef} onClose={() => { const id = open!; setOpen(null); buttons.current.get(id)?.focus(); }} />;
  })();

  // Edges that leave one node along the same side share a lane offset so they run side by side.
  const lanes = new Map<string, number>();
  const laneOf = (node: string) => { const n = lanes.get(node) ?? 0; lanes.set(node, n + 1); return (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 6; };

  return (
    <section className={`ag-root ${className ?? ""}`} aria-label={typeof title === "string" ? title : "Agent graph"}>
      <style>{AGENT_HUB_CSS}</style>
      <header className="ag-head">
        <span className="ag-title"><span className="ag-title-mark" aria-hidden />{title}</span>
        {chips.map((n) => <span key={n.id} className={`ag-chip ag-chip-${n.status}`}>{n.status === "failed" ? "!" : "◷"} {n.label} {n.status === "failed" ? "failed" : "needs you"}</span>)}
        <span className="ag-stats">
          <span><b>{agents}</b> {agents === 1 ? "agent" : "agents"}</span>
          <span><b>{tools.length}</b> {tools.length === 1 ? "tool" : "tools"}</span>
          <span><b>{lastMinute}</b> calls/min</span>
          <span title={cost === undefined ? "Not every agent recorded its cost" : undefined}><b>{cost === undefined ? "Unknown" : fmtCost(cost)}</b>{cost === undefined ? " cost" : ""}</span>
        </span>
      </header>
      <div ref={wrap} className="ag-canvas-wrap" style={{ height: h * scale }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(null); }}>
        <div className="ag-canvas" style={{ width: w, height: h, transform: `scale(${scale})` }}>
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
                  {live && <path d={d} className={`ag-edge-live${animate && live.kind !== "failed" ? " ag-flow" : ""}`}
                    style={{ stroke: CALL_COLOR[live.kind], "--ag-len": `${length}px`, animationDirection: forward ? "normal" : "reverse" } as CSSProperties} />}
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
        </div>
        {popover}
      </div>
      <ul className="ag-legend" aria-label="Edge colours">
        {(["call", "answer", "needs-you", "failed"] as const).map((k) => <li key={k}><span className="ag-legend-line" style={{ background: CALL_COLOR[k] }} />{CALL_LABEL[k]}</li>)}
      </ul>
    </section>
  );
}
