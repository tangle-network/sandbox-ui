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
import { LatestEvents } from "../run/latest-events";
import {
  AGENT_CARD,
  FRAME_CAPTION,
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
  AgentCardView,
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
    const viewport = el.querySelector<HTMLElement>(".ag-graph-viewport") ?? el;
    const read = () => {
      const r = viewport.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      setSize((prev) =>
        prev && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev
          : { width: r.width, height: r.height },
      );
    };
    observer.current = new ResizeObserver(read);
    observer.current.observe(viewport);
    read();
  }, []);
  return [size, measure];
}

/** Keep the selected card inside the actual viewport without resetting the reader's camera. */
function revealSelection(inst: ReactFlowInstance, wrapper: HTMLDivElement | null, id: string) {
  const node = inst.getInternalNode(id), box = wrapper?.querySelector(".ag-graph-viewport")?.getBoundingClientRect();
  const width = node?.measured.width ?? node?.width, height = node?.measured.height ?? node?.height;
  if (!node || !box || !width || !height) return;
  const current = inst.getViewport(), position = node.internals.positionAbsolute;
  const zoom = Math.max(0.02, Math.min(current.zoom, (box.width - 2 * FIT_PADDING) / width, (box.height - 2 * FIT_PADDING) / height));
  const x = Math.max(FIT_PADDING - position.x * zoom, Math.min(box.width - FIT_PADDING - (position.x + width) * zoom, current.x));
  const y = Math.max(FIT_PADDING - position.y * zoom, Math.min(box.height - FIT_PADDING - (position.y + height) * zoom, current.y));
  if (x !== current.x || y !== current.y || zoom !== current.zoom) void inst.setViewport({ x, y, zoom });
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
  showLatestEvents = true,
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
  const priorLayout = useRef<AgentLayout | null>(null);
  const layout = useMemo(() => {
    if (!layouts || layouts.key !== layoutKey || !canvas) return null;
    return priorLayout.current = selectedId && priorLayout.current && layouts.all.includes(priorLayout.current)
      ? priorLayout.current : pickAgentLayout(layouts.all, canvas, FIT_PADDING);
  }, [layouts, layoutKey, canvas, selectedId]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const rfRef = useRef<ReactFlowInstance | null>(null);

  const flowNodes = useMemo((): Node[] => {
    if (!layout) return [];
    const frames: AgentFrameNode[] = layout.frames.map((frame) => ({
      id: frame.group.id,
      type: "agentFrame",
      position: { x: frame.x, y: frame.y },
      width: frame.width, height: frame.height, measured: rfRef.current?.getInternalNode(frame.group.id)?.measured,
      zIndex: -1,
      selectable: false,
      focusable: false,
      draggable: false,
      data: { frame, direction },
    }));
    const cards: (AgentCardNode | LiveAgentCardNode)[] = [];
    for (const id of topology.agentIds) {
      const agent = byId.get(id);
      const position = layout.positions.get(id);
      if (!agent || !position) continue;
      const selected = selectedId === id;
      const owned = layout.frames.find(frame => frame.group.parentId === id);
      const width = owned ? owned.width - 24 : card.width, height = owned ? FRAME_CAPTION - 16 : card.height;
      const measured = rfRef.current?.getInternalNode(id)?.measured;
      cards.push({
        id,
        type: live ? "liveAgent" : "agent",
        position,
        width, height, measured: measured?.width === width && measured.height === height ? measured : undefined,
        className: `${AGENT_NODE_CLASS}${owned ? " ag-frame-owner" : ""}`,
        draggable: false,
        ariaRole: "button",
        ariaLabel: agentSummary(agent),
        domAttributes: { "aria-pressed": selected },
        data: { agent, selected, direction, now: clock, onOpen: onSelect ? () => onSelect(agent.id) : undefined, renderEventIcon },
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
      if (layout.frames.some(frame => frame.group.id === target && frame.group.parentId === s.from)) continue;
      const id = `spawn:${s.from}:${target}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        source: s.from,
        target,
        type: "smoothstep",
        pathOptions: { borderRadius: 14 },
        selectable: false,
        focusable: false,
        style: { stroke: edgeColor(undefined), strokeWidth: 1.5 },
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

  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const readerMoved = useRef(false);
  const selection = useRef(selectedId);
  selection.current = selectedId;
  const framed = useRef<string | null>(null);
  useEffect(() => { if (narrow) { rfRef.current = null; setReady(false); setShown(false); framed.current = null; } }, [narrow]);
  const layoutIdentity = layout ? `${layoutKey}:${layout.columns}` : null;
  const minZoom = layout && canvas ? Math.max(0.02, Math.min(0.2, (canvas.width - 2 * FIT_PADDING) / layout.width, (canvas.height - 2 * FIT_PADDING) / layout.height)) : 0.2;
  useEffect(() => {
    const inst = rfRef.current;
    if (!ready || !inst || !layoutIdentity || !canvas) return;
    const relayout = framed.current !== layoutIdentity;
    const preserveView = !relayout && readerMoved.current;
    if (preserveView && !selection.current) return;
    const animate = framed.current !== null && relayout && animateMotion;
    framed.current = layoutIdentity;
    readerMoved.current = preserveView;
    const frame = requestAnimationFrame(() => {
      if (preserveView) revealSelection(inst, wrapperRef.current, selection.current!);
      else if (live) void inst.setViewport({ x: FIT_PADDING, y: FIT_PADDING, zoom: 1 }, { duration: animate ? tokenMilliseconds("--duration-base", wrapperRef.current) : 0 });
      else void inst.fitView({
        padding: `${FIT_PADDING}px`,
        maxZoom: 1,
        minZoom,
        duration: animate ? tokenMilliseconds("--duration-base", wrapperRef.current) : 0,
      });
      setShown(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, layoutIdentity, canvas, minZoom, animateMotion, live]);

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
  const readingOrder = useRef<string[]>([]);
  const known = new Set(readingOrder.current);
  readingOrder.current = [...readingOrder.current.filter(id => byId.has(id)), ...nodes.filter(agent => !known.has(agent.id)).sort((a, b) => activityRank(a) - activityRank(b)).map(agent => agent.id)];
  const parentOf = new Map(edges.filter(e => e.kind === "spawn").map(e => [e.to, e.from]));
  const depthOf = (id: string) => { const seen = new Set([id]); let depth = 0; while (parentOf.has(id) && !seen.has(parentOf.get(id)!)) { id = parentOf.get(id)!; seen.add(id); depth++; } return depth; };
  const counts = ["needs-you", "failed", "quiet"].map(status => { const matches = nodes.filter(agent => status === "quiet" ? quietActivity(agent, clock) : agent.status === status); return { status, matches, current: matches.find(agent => agent.id === selectedId) ?? matches[0] }; });
  const caption = <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 text-xs text-muted-foreground" aria-label="Run status">
    <span className="shrink-0 whitespace-nowrap">{nodes.length} agents</span>
    {counts.filter(group => group.matches.length).map(group => <button type="button" key={group.status} className="ag-status-button rounded-full border border-border px-2 py-1" style={{ color: group.status === "quiet" ? "var(--surface-warning-text)" : agentStatus(group.status as AgentGraphStatus).color }} onClick={() => {
      const index = group.matches.findIndex(agent => agent.id === selectedId);
      const next = group.matches[(index + 1) % group.matches.length]; select(next.id);
      const p = layout?.positions.get(next.id);
      if (p) void rfRef.current?.setCenter(p.x + card.width / 2, p.y + card.height / 2, { zoom: 1, duration: animateMotion ? tokenMilliseconds("--duration-base", wrapperRef.current) : 0 });
    }}><span className="shrink-0">{group.matches.length} {group.status === "needs-you" ? "needs you" : group.status}</span><span className="ag-caption-target">{group.current.label}{group.status === "failed" && <span className="font-normal"> · {group.current.result ?? group.current.turn ?? "Failure cause not recorded"}</span>}</span></button>)}
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
      {showLatestEvents && live && <LatestEvents agents={nodes} now={now} live={live} selectedId={selectedId} onSelect={onSelect ? select : undefined} />}
      {narrow ? <ul className="ag-graph-viewport ag-phone-list overflow-auto" aria-label="Agents by attention">
        {readingOrder.current.map(id => byId.get(id)!).map(agent => <li key={agent.id} style={{ ["--depth" as string]: depthOf(agent.id) }}>
          <div role="button" tabIndex={0} aria-pressed={selectedId === agent.id} aria-label={agentSummary(agent)} data-agent-id={agent.id} className="ag-phone-select"
            onClick={() => select(agent.id)} onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); select(agent.id); } }}>
            {live || agent.status === "succeeded" || agent.status === "stopped"
              ? <LiveAgentCardView agent={agent} parentLabel={byId.get(parentOf.get(agent.id) ?? "")?.label} selected={selectedId === agent.id} now={clock} renderEventIcon={renderEventIcon} onOpen={onSelect ? () => select(agent.id) : undefined} />
              : <AgentCardView agent={agent} parentLabel={byId.get(parentOf.get(agent.id) ?? "")?.label} selected={selectedId === agent.id} now={clock} direction={direction} onOpen={onSelect ? () => select(agent.id) : undefined} />}
          </div>
        </li>)}
      </ul> : <div className="ag-graph-viewport min-h-0 flex-1" style={{ opacity: shown ? 1 : 0 }}><ReactFlow
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
