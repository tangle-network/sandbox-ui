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
import { motionAllowed, useColorMode } from "./canvas-theme";
import { edgeColor } from "./node-ui";

const NODE_TYPES = { agent: AgentCard, agentFrame: AgentFrameBox };
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
}: AgentGraphProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [canvas, measureCanvas] = useCanvasSize();
  const colorMode = useColorMode(wrapperRef, nodes.length > 0);

  // The tree is rebuilt only when its shape changes: a host polling a live run
  // hands over new arrays every tick, and a status change must not re-layout.
  const nextTopology = buildAgentTopology(nodes, edges);
  const topologyRef = useRef(nextTopology);
  if (topologyRef.current.key !== nextTopology.key) topologyRef.current = nextTopology;
  const topology = topologyRef.current;

  // Every grid width is laid out once per tree; a resize only re-picks.
  const [layouts, setLayouts] = useState<{ key: string; all: AgentLayout[] } | null>(null);
  const layoutKey = `${direction}:${topology.key}`;
  useEffect(() => {
    let live = true;
    Promise.all(candidateColumns(topology).map((c) => layoutAgents(topology, direction, c))).then(
      (all) => {
        if (live) setLayouts({ key: layoutKey, all });
      },
    );
    return () => {
      live = false;
    };
  }, [topology, direction, layoutKey]);
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
        statuses: frame.group.memberIds.map(
          (id) => byId.get(id)?.status ?? ("unknown" as AgentGraphStatus),
        ),
      },
    }));
    const cards: AgentCardNode[] = [];
    for (const id of topology.agentIds) {
      const agent = byId.get(id);
      const position = layout.positions.get(id);
      if (!agent || !position) continue;
      const selected = selectedId === id;
      cards.push({
        id,
        type: "agent",
        position,
        width: AGENT_CARD.width,
        height: AGENT_CARD.height,
        className: AGENT_NODE_CLASS,
        draggable: false,
        ariaRole: "button",
        ariaLabel: agentSummary(agent),
        domAttributes: { "aria-pressed": selected },
        data: { agent, selected, direction },
      });
    }
    return [...frames, ...cards];
  }, [layout, topology, byId, selectedId, direction]);

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
      // A grid's edge carries the loudest state among its workers.
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
  }, [layout, topology, edges, byId]);

  // Framing: fit the whole run when it first appears and whenever its layout
  // changes (new agents, a new grid width). A resize alone refits only until
  // the reader pans or zooms — after that the camera is theirs.
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const [ready, setReady] = useState(false);
  // Hidden until the first fit lands, so the run never flashes unframed.
  const [shown, setShown] = useState(false);
  const readerMoved = useRef(false);
  const framed = useRef<string | null>(null);
  const layoutIdentity = layout ? `${layoutKey}:${layout.columns}` : null;
  useEffect(() => {
    const inst = rfRef.current;
    if (!ready || !inst || !layoutIdentity || !canvas) return;
    const relayout = framed.current !== layoutIdentity;
    if (!relayout && readerMoved.current) return;
    const animate = framed.current !== null && relayout && motionAllowed();
    framed.current = layoutIdentity;
    readerMoved.current = false;
    const frame = requestAnimationFrame(() => {
      void inst.fitView({
        padding: `${FIT_PADDING}px`,
        maxZoom: 1,
        minZoom: 0.2,
        duration: animate ? 220 : 0,
      });
      setShown(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, layoutIdentity, canvas]);

  const select = useCallback(
    (id: string) => {
      if (byId.has(id)) onSelect?.(id);
    },
    [byId, onSelect],
  );
  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => select(node.id),
    [select],
  );
  // React Flow makes a node tabbable but gives it no activation key; Enter and
  // Space on a focused card select it, as a click does.
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!(event.target instanceof HTMLElement)) return;
      if (!event.target.classList.contains("react-flow__node")) return;
      const id = event.target.getAttribute("data-id");
      if (!id || !byId.has(id)) return;
      event.preventDefault();
      event.stopPropagation();
      select(id);
    },
    [byId, select],
  );

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
      className={`agent-graph relative transition-opacity duration-150 ease-out motion-reduce:transition-none ${layout && shown ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
      data-layout={layout && shown ? "ready" : "pending"}
      data-columns={layout?.columns}
    >
      <ReactFlow
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
          // Only a gesture has an event; our own fitView calls do not.
          if (event) readerMoved.current = true;
        }}
        onNodeClick={handleNodeClick}
        onKeyDown={handleKeyDown}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable
        edgesFocusable={false}
        deleteKeyCode={null}
        // A pane, not a page: two-finger scroll pans, pinch (or ctrl+scroll) zooms.
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnDrag
        minZoom={0.2}
        maxZoom={1.75}
        aria-label="Agent topology"
      >
        <Background gap={18} size={1.4} color="hsl(var(--muted-foreground) / 0.38)" />
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
      </ReactFlow>
    </div>
  );
}
