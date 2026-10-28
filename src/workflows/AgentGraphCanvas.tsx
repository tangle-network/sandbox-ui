/**
 * The topology of a multi-agent run: who spawned whom as a tree, and who
 * messaged or delegated to whom as curved secondary edges over it. Reached
 * through the lazy `AgentGraph` wrapper, which defers `@xyflow/react` (and
 * `elkjs`) to render time.
 */

import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AgentGraphProps } from "./AgentGraph";
import {
  AGENT_CARD,
  type AgentGraphStatus,
  LIVE_AGENT_CARD,
  type AgentLayout,
  buildAgentTopology,
  candidateColumns,
  layoutAgents,
  pickAgentLayout,
} from "./agent-graph-layout";
import {
  AGENT_NODE_CLASS,
  AgentCard,
  type AgentCardNode,
  AgentFrameBox,
  type AgentFrameNode,
  type AgentMessageEdge,
  AgentMessageEdgeView,
  agentStatus,
  agentSummary,
  MESSAGE_EDGE_COLOR,
} from "./agent-graph-parts";
import { LiveAgentCard, LiveAgentCardView, type LiveAgentCardNode } from "./agent-live-card";
import { useColorMode } from "./canvas-theme";
import { edgeColor } from "./node-ui";
import { quietActivity, tokenMilliseconds, useMotionAllowed, useRunNow } from "./run-ui-state";

const NODE_TYPES = { agent: AgentCard, liveAgent: LiveAgentCard, agentFrame: AgentFrameBox };
const EDGE_TYPES = { agentMessage: AgentMessageEdgeView };
/** The fit's margin, in screen pixels. */
const FIT_PADDING = 16;
const MINIMAP_MIN_NODES = 40;

/** The canvas's size, once it has one. */
function useCanvasSize(): [
  { width: number; height: number } | null,
  (el: HTMLDivElement | null) => void,
] {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      setSize((prev) =>
        prev && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev
          : { width: r.width, height: r.height },
      );
    };
    observer.current = new ResizeObserver(read);
    observer.current.observe(el);
    read();
  }, []);
  return [size, measure];
}

export function AgentGraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
  direction = "TB",
  className,
  emptyState,
  live = false,
  renderEventIcon,
  now,
}: AgentGraphProps) {
  const card = live ? LIVE_AGENT_CARD : AGENT_CARD;
  const clock = useRunNow(now);
  const animateMotion = useMotionAllowed();
  const [hovered, setHovered] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [canvas, measureCanvas] = useCanvasSize();
  const colorMode = useColorMode(wrapperRef, nodes.length > 0);
  const narrow = canvas !== null && canvas.width < 600;

  const nextTopology = buildAgentTopology(nodes, edges);
  const topologyRef = useRef(nextTopology);
  if (topologyRef.current.key !== nextTopology.key) topologyRef.current = nextTopology;
  const topology = topologyRef.current;

  const [layouts, setLayouts] = useState<{ key: string; all: AgentLayout[] } | null>(null);
  const layoutKey = `${direction}:${live ? "live" : "cards"}:${topology.key}`;
  useEffect(() => {
    if (narrow) return;
    let live = true;
    Promise.all(candidateColumns(topology).map((c) => layoutAgents(topology, direction, c, card))).then(
      (all) => {
        if (live) setLayouts({ key: layoutKey, all });
      },
    );
    return () => {
      live = false;
    };
  }, [topology, direction, layoutKey, card, narrow]);
  const layout = useMemo(
    () =>
      layouts && layouts.key === layoutKey && canvas
        ? pickAgentLayout(layouts.all, canvas, FIT_PADDING)
        : null,
    [layouts, layoutKey, canvas],
  );

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const flowNodes = useMemo((): Node[] => {
    if (!layout) return [];
    const frames: AgentFrameNode[] = layout.frames.map((frame) => ({
      id: frame.group.id,
      type: "agentFrame",
      position: { x: frame.x, y: frame.y },
      width: frame.width,
      height: frame.height,
      zIndex: -1,
      selectable: false,
      focusable: false,
      draggable: false,
      data: {
        frame,
        direction,
        quietCount: frame.group.memberIds.filter(id => byId.get(id) && quietActivity(byId.get(id)!, clock)).length,
        statuses: frame.group.memberIds.map(
          (id) => byId.get(id)?.status ?? ("unknown" as AgentGraphStatus),
        ),
      },
    }));
    const cards: (AgentCardNode | LiveAgentCardNode)[] = [];
    for (const id of topology.agentIds) {
      const agent = byId.get(id);
      const position = layout.positions.get(id);
      if (!agent || !position) continue;
      const selected = selectedId === id;
      cards.push({
        id,
        type: live ? "liveAgent" : "agent",
        position,
        width: card.width,
        height: card.height,
        className: AGENT_NODE_CLASS,
        draggable: false,
        ariaRole: "button",
        ariaLabel: agentSummary(agent),
        domAttributes: { "aria-pressed": selected },
        data: { agent, selected, direction, now: clock, onRespond: onSelect ? () => onSelect(agent.id) : undefined, renderEventIcon },
      } as AgentCardNode | LiveAgentCardNode);
    }
    return [...frames, ...cards];
  }, [layout, topology, byId, selectedId, direction, live, card, clock, onSelect, renderEventIcon]);

  const flowEdges = useMemo((): Edge[] => {
    if (!layout) return [];
    const out: Edge[] = [];
    const seen = new Set<string>();
    for (const s of topology.spawns) {
      const target = topology.groupOf.get(s.to) ?? s.to;
      const id = `spawn:${s.from}:${target}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const group = topology.groups.find((g) => g.id === target);
      const statuses = group
        ? group.memberIds.map((m) => byId.get(m)?.status)
        : [byId.get(s.to)?.status];
      const lead = (["failed", "waiting", "running"] as const).find((st) => statuses.includes(st));
      const flow = lead ?? agentStatus(statuses[0] ?? "unknown").flow;
      out.push({
        id,
        source: s.from,
        target,
        type: "smoothstep",
        pathOptions: { borderRadius: 14 },
        selectable: false,
        focusable: false,
        style: { stroke: edgeColor(flow), strokeWidth: 1.5 },
      } as Edge);
    }
    const ids = new Set(topology.agentIds);
    const messages = new Map<string, AgentMessageEdge>();
    for (const e of edges) {
      if (e.kind === "spawn" || e.from === e.to || !ids.has(e.from) || !ids.has(e.to)) continue;
      if (![selectedId, hovered].some(id => id === e.from || id === e.to)) continue;
      const id = `${e.kind}:${e.from}:${e.to}`;
      const prior = messages.get(id);
      const count = (prior?.data?.count ?? 0) + Math.max(1, e.count ?? 1);
      const color = MESSAGE_EDGE_COLOR[e.kind] ?? MESSAGE_EDGE_COLOR.message;
      messages.set(id, {
        id,
        source: e.from,
        target: e.to,
        type: "agentMessage",
        selectable: false,
        focusable: false,
        zIndex: 0,
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color },
        ariaLabel: `${e.kind === "delegation" ? "Delegation" : "Message"} from ${byId.get(e.from)?.label ?? e.from} to ${byId.get(e.to)?.label ?? e.to}${count > 1 ? `, ${count} times` : ""}`,
        data: { kind: e.kind, count, label: e.label ?? prior?.data?.label },
      });
    }
    return [...out, ...messages.values()];
  }, [layout, topology, edges, byId, selectedId, hovered]);

  const rfRef = useRef<ReactFlowInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const readerMoved = useRef(false);
  const framed = useRef<string | null>(null);
  useEffect(() => { if (narrow) { rfRef.current = null; setReady(false); setShown(false); framed.current = null; } }, [narrow]);
  const layoutIdentity = layout ? `${layoutKey}:${layout.columns}` : null;
  const minZoom = layout && canvas ? Math.max(0.02, Math.min(0.2, (canvas.width - 2 * FIT_PADDING) / layout.width, (canvas.height - 2 * FIT_PADDING) / layout.height)) : 0.2;
  useEffect(() => {
    const inst = rfRef.current;
    if (!ready || !inst || !layoutIdentity || !canvas) return;
    const relayout = framed.current !== layoutIdentity;
    if (!relayout && readerMoved.current) return;
    const animate = framed.current !== null && relayout && animateMotion;
    framed.current = layoutIdentity;
    readerMoved.current = false;
    const frame = requestAnimationFrame(() => {
      void inst.fitView({
        padding: `${FIT_PADDING}px`,
        maxZoom: 1,
        minZoom,
        duration: animate ? tokenMilliseconds("--duration-base", wrapperRef.current) : 0,
      });
      setShown(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, layoutIdentity, canvas, minZoom, animateMotion]);

  const select = useCallback(
    (id: string) => {
      if (byId.has(id)) { onSelect?.(id); wrapperRef.current?.querySelector<HTMLElement>(`[data-agent-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" }); }
    },
    [byId, onSelect],
  );
  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => select(node.id),
    [select],
  );
  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLElement)) return;
    const id = event.target.closest(".react-flow__node")?.getAttribute("data-id");
    if (!id || !byId.has(id)) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); wrapperRef.current?.focus(); return; }
    if (!event.target.classList.contains("react-flow__node")) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); select(id); return; }
    const origin = layout?.positions.get(id);
    const vector = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    const target = event.key === "Home" ? topology.agentIds[0] : origin && vector ? [...(layout?.positions ?? [])]
      .filter(([key, p]) => byId.has(key) && key !== id && (p.x - origin.x) * vector[0] + (p.y - origin.y) * vector[1] > 0)
      .sort((a, b) => Math.hypot(a[1].x - origin.x, a[1].y - origin.y) - Math.hypot(b[1].x - origin.x, b[1].y - origin.y))[0]?.[0] : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const position = layout?.positions.get(target);
    wrapperRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(target)}"]`)?.focus();
    if (position) void rfRef.current?.setCenter(position.x + card.width / 2, position.y + card.height / 2, { zoom: rfRef.current.getZoom(), duration: animateMotion ? tokenMilliseconds("--duration-base", wrapperRef.current) : 0 });
  }, [byId, select, layout, topology, card, animateMotion]);
  const activityRank = (agent: (typeof nodes)[number]) => agent.status === "needs-you" ? 0 : agent.status === "failed" ? 1 : quietActivity(agent, clock) ? 2 : agent.status === "waiting" ? 3 : agent.status === "running" ? 4 : 5;
  const parentOf = new Map(edges.filter(e => e.kind === "spawn").map(e => [e.to, e.from]));
  const depthOf = (id: string) => { const seen = new Set([id]); let depth = 0; while (parentOf.has(id) && !seen.has(parentOf.get(id)!)) { id = parentOf.get(id)!; seen.add(id); depth++; } return depth; };
  const counts = ["needs-you", "failed", "quiet"].map(status => ({ status, matches: nodes.filter(agent => status === "quiet" ? quietActivity(agent, clock) : agent.status === status) }));
  const caption = <div className="flex h-10 shrink-0 items-center gap-3 px-3 text-xs text-muted-foreground" aria-label="Run status">
    <span>{nodes.length} agents</span>
    {counts.filter(group => group.matches.length).map(group => <button type="button" key={group.status} className="rounded-full border border-border px-2 py-1" style={{ color: group.status === "quiet" ? "var(--surface-warning-text)" : agentStatus(group.status as AgentGraphStatus).color }} onClick={() => {
      const index = group.matches.findIndex(agent => agent.id === selectedId);
      const next = group.matches[(index + 1) % group.matches.length]; select(next.id);
      const p = layout?.positions.get(next.id);
      if (p) void rfRef.current?.setCenter(p.x + card.width / 2, p.y + card.height / 2, { zoom: 1, duration: animateMotion ? tokenMilliseconds("--duration-base", wrapperRef.current) : 0 });
    }}>{group.matches.length} {group.status === "needs-you" ? "needs you" : group.status}</button>)}
  </div>;

  if (nodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-border border-dashed p-4 text-center text-muted-foreground text-xs ${className ?? ""}`}
      >
        {emptyState ?? "No agents yet"}
      </div>
    );
  }

  return (
    <div
      ref={(el) => {
        wrapperRef.current = el;
        measureCanvas(el);
      }}
      className={`agent-graph ag-live relative flex flex-col ${className ?? ""}`}
      tabIndex={-1}
      onKeyDownCapture={handleKeyDown}
      data-layout={narrow ? "list" : layout && shown ? "ready" : "pending"}
      data-columns={layout?.columns}
    >
      {caption}
      {narrow ? <ul className="ag-phone-list overflow-auto" aria-label="Agents by attention">
        {[...nodes].sort((a, b) => activityRank(a) - activityRank(b)).map(agent => <li key={agent.id} style={{ ["--depth" as string]: depthOf(agent.id) }}>
          <div role="button" tabIndex={0} aria-pressed={selectedId === agent.id} aria-label={agentSummary(agent)} data-agent-id={agent.id} className="ag-phone-select"
            onClick={() => select(agent.id)} onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); select(agent.id); } }}>
            <LiveAgentCardView agent={agent} selected={selectedId === agent.id} now={clock} renderEventIcon={renderEventIcon} onRespond={onSelect ? () => select(agent.id) : undefined} />
          </div>
        </li>)}
      </ul> : <div className="min-h-0 flex-1" style={{ opacity: shown ? 1 : 0 }}><ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        colorMode={colorMode}
        onInit={(inst) => {
          rfRef.current = inst;
          setReady(true);
        }}
        onMoveStart={(event) => {
          if (event) readerMoved.current = true;
        }}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable
        edgesFocusable={false}
        deleteKeyCode={null}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnDrag
        minZoom={minZoom}
        maxZoom={1.75}
        aria-label="Agent topology"
      >
        <Background bgColor="var(--bg-root)" gap={16} size={1} color="hsl(var(--foreground) / 0.06)" />
        {nodes.length > MINIMAP_MIN_NODES && (
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            style={{ width: 168, height: 104 }}
            className="!hidden sm:!block"
            ariaLabel="Agent topology overview"
          />
        )}
        <Controls
          showInteractive={false}
          position="bottom-right"
          fitViewOptions={{ padding: `${FIT_PADDING}px`, maxZoom: 1 }}
        />
      </ReactFlow></div>}
    </div>
  );
}
