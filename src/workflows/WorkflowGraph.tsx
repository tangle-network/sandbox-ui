/**
 * n8n-style node-graph view of a workflow, rendered from its YAML definition.
 * Used full-size on the workflow detail page and as a compact, non-interactive
 * preview on assistant proposal cards. Both share one graph model + node
 * component; only interactivity and sizing differ by `variant`.
 */

import {
  Background,
  type ColorMode,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Bell,
  Box,
  Cable,
  Circle,
  Clock,
  type LucideIcon,
  Maximize2,
  Minimize2,
  Repeat,
  Sparkles,
  Split,
  Webhook,
} from "lucide-react";
import {
  createContext,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type WfDirection,
  type WfNodeData,
  type WfNodeState,
  type WfNodeStatus,
  type WfNodeTone,
} from "./model";
import { buildFlowGraph, mergeRunState } from "./flow-graph";
import { clampPreview, fmtCost, fmtDuration, fmtTokens } from "./format";
import { providerLabel } from "./provider-label";
import { ProviderIcon } from "../integrations/provider-logo";

/** Tracks the app's dark/light class so React Flow's chrome (edges, controls,
 *  background) themes with the rest of the app. */
function useColorMode(): ColorMode {
  const [mode, setMode] = useState<ColorMode>(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );
  useEffect(() => {
    const el = document.documentElement;
    const update = () =>
      setMode(el.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return mode;
}

/** Flow direction for the current graph, so the node component can place its
 *  edge handles on the correct sides (edges enter the leading edge and leave the
 *  trailing edge) without threading a prop through React Flow's node renderer. */
export const DirectionContext = createContext<WfDirection>("LR");

// Tone accent color (theme-reactive CSS, resolving against the raw brand vars so
// it needs no registered utility): trigger = primary indigo; structural
// (parallel/foreach control flow) = warning amber; action = muted neutral. Drives
// the node's dot and a subtle border/background tint via inline style.
const TONE_ACCENT: Record<WfNodeTone, string> = {
  trigger: "hsl(var(--primary))",
  structural: "var(--surface-warning-text)",
  action: "hsl(var(--muted-foreground))",
};

// Status colors, shared by the node (dot/progress) and the edges so a node and
// the hop pointing at it read as one. These are INLINE styles, so they must use
// the RAW brand tokens (`hsl(var(--muted-foreground))`, `hsl(var(--primary))`) —
// NOT the `--color-*` @theme aliases, which exist in this library's Storybook but
// are undefined in a consumer that only imports `tokens.css` (e.g. platform-web),
// where a `var(--color-*)` stroke silently resolves to `none` (invisible edge).
// green/red match the node status borders (green-500 / red-500).
const EDGE_MUTED = "hsl(var(--muted-foreground))";
const EDGE_DONE = "#22c55e";
const EDGE_FAIL = "#ef4444";
const EDGE_RUNNING = "hsl(var(--primary))";
const STATUS_COLOR: Record<WfNodeStatus, string> = {
  queued: EDGE_MUTED,
  running: EDGE_RUNNING,
  succeeded: EDGE_DONE,
  failed: EDGE_FAIL,
};

/** Compact (collapsed) density for the current graph — read by the node so it
 *  renders the icon-tile summary instead of the full card. Set by the density
 *  toggle (and forced on for the proposal-card preview). */
export const DensityContext = createContext<boolean>(false);

// One lucide glyph per action/trigger kind so a node's type reads at a glance.
const KIND_ICON: Record<string, LucideIcon> = {
  schedule: Clock,
  provider_event: Webhook,
  trigger: Webhook,
  "agent.run": Sparkles,
  "integration.invoke": Cable,
  notify: Bell,
  parallel: Split,
  foreach: Repeat,
  "sandbox.spawn": Box,
};

/** The type icon in a tinted square, colored by tone. */
function NodeIcon({
  kind,
  accent,
  box,
  glyph,
}: {
  kind?: string;
  accent: string;
  box: number;
  glyph: number;
}) {
  const Icon = (kind && KIND_ICON[kind]) || Circle;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-md"
      style={{
        width: box,
        height: box,
        background: `color-mix(in srgb, ${accent} 16%, transparent)`,
        color: accent,
      }}
    >
      <Icon size={glyph} strokeWidth={2} />
    </span>
  );
}

/** Run progress strip: queued = near-empty, running = pulsing partial, terminal
 *  = full (green/red). The footer surfaces agent rounds (left) and elapsed
 *  (right) — the "progress monitor" element, present on any node that has run.
 *  Status itself is carried by the bar color + the header pill, so it is NOT
 *  restated here. */
function ProgressStrip({
  status,
  rounds,
  elapsed,
}: {
  status: WfNodeStatus;
  rounds?: number;
  elapsed?: string;
}) {
  const color = STATUS_COLOR[status];
  const fill =
    status === "succeeded" || status === "failed"
      ? "100%"
      : status === "running"
        ? "58%"
        : "6%";
  // `!== undefined` (not truthiness) so an explicit `rounds: 0` — a just-started
  // agent — still renders "0 rounds" rather than being hidden.
  const roundsLabel =
    rounds !== undefined
      ? `${rounds} round${rounds === 1 ? "" : "s"}`
      : undefined;
  return (
    <div className="mt-1.5">
      <div
        className="h-1 w-full overflow-hidden rounded-full"
        style={{
          background: "color-mix(in srgb, hsl(var(--muted-foreground)) 22%, transparent)",
        }}
      >
        <div
          className={`h-full rounded-full ${status === "running" ? "animate-pulse" : ""}`}
          style={{ width: fill, background: color }}
        />
      </div>
      {(roundsLabel || elapsed) && (
        <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
          <span className="truncate">{roundsLabel ?? ""}</span>
          {elapsed && <span className="shrink-0">{elapsed}</span>}
        </div>
      )}
    </div>
  );
}

// Handles are positioned anchors for edges; we hide the dots so edges appear to
// connect to the node body for a clean diagram look.
const HANDLE_CLASS = "!h-2 !w-2 !min-w-0 !border-0 !bg-transparent opacity-0";

const STATUS_LABEL: Record<WfNodeStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
};

// Status badge colour. `running` reuses the primary accent (the card also
// pulses); succeeded/failed use the green/red palette already in the design
// system (see TONE + run-history coloring).
const STATUS_BADGE: Record<WfNodeStatus, string> = {
  queued: "bg-surface-container-high text-muted-foreground",
  running: "bg-primary/15 text-primary",
  succeeded: "bg-green-600/10 text-green-600",
  failed: "bg-red-500/10 text-red-400",
};

// Border/ring override applied ON TOP of the tone card when a node has live run
// state — so the currently-running node pulses and terminal nodes read green/red
// at a glance.
function statusBorder(status: WfNodeStatus): string {
  switch (status) {
    case "running":
      // The soft glow (inline, see WorkflowNode) + the animated inbound edge carry
      // the "live" signal — no whole-card pulse, which would fade the text too.
      return "border-primary ring-1 ring-primary/40";
    case "succeeded":
      return "border-green-500";
    case "failed":
      return "border-red-500";
    default:
      return "opacity-70";
  }
}

/** A compact key/value chip for the node's meta row. Truncates (with a title
 *  tooltip) so a long value — e.g. a provider-prefixed model id — can't overflow
 *  the fixed card width or wrap past the reserved meta rows. */
function MetaChip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block max-w-[150px] truncate rounded bg-surface-container-high px-1.5 py-0.5 align-middle text-[10px] text-muted-foreground"
    >
      {children}
    </span>
  );
}

export function WorkflowNode({ data }: NodeProps<Node<WfNodeData>>) {
  const d = data;
  const state = d.state;
  const direction = useContext(DirectionContext);
  const compact = useContext(DensityContext);
  const isLR = direction === "LR";
  const targetPos = isLR ? Position.Left : Position.Top;
  const sourcePos = isLR ? Position.Right : Position.Bottom;
  const accent = TONE_ACCENT[d.tone];
  const isAgent = d.kind === "agent.run";
  // The model the card shows: what the run ACTUALLY used wins over the requested
  // one, so a fan-out branch / fallback is visible once a run is live.
  const model = state?.model ?? d.model;
  const duration = fmtDuration(state?.durationMs);
  const cost = fmtCost(state?.costUsd);
  // Tokens are an agent.run concern; other kinds never show a token chip.
  const tokens = isAgent
    ? fmtTokens(state?.inputTokens, state?.outputTokens)
    : undefined;
  // Bound the host-supplied preview/error strings before they hit the DOM — the
  // card shows a short preview, and `line-clamp-2` only hides overflow visually.
  const errorText = state?.error ? clampPreview(state.error) : undefined;
  const outputText = state?.outputPreview
    ? clampPreview(state.outputPreview)
    : undefined;

  // Border/glow + static tone tint are shared by both densities. Once a run is
  // live, the status-border className takes over; a running node also gets a soft
  // primary glow so the active step reads at a glance.
  const wrapperClass = `relative flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-colors ${
    state ? statusBorder(state.status) : ""
  }`;
  const wrapperStyle = state
    ? state.status === "running"
      ? { boxShadow: "0 0 22px -6px hsl(var(--primary))" }
      : undefined
    : {
        borderColor: `color-mix(in srgb, ${accent} 42%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${accent} 6%, hsl(var(--card)))`,
      };
  const handles = (
    <>
      {!d.isRoot && (
        <Handle type="target" position={targetPos} className={HANDLE_CLASS} />
      )}
      <Handle type="source" position={sourcePos} className={HANDLE_CLASS} />
    </>
  );

  // COMPACT: icon + title + a one-line summary + tiny cost/time, with a thin
  // progress line while running. The density a toggle collapses to.
  if (compact) {
    return (
      <div className={`${wrapperClass} justify-center px-2.5`} style={wrapperStyle}>
        {handles}
        <div className="flex items-center gap-2.5">
          <NodeIcon kind={d.kind} accent={accent} box={32} glyph={16} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-[12px] text-foreground">
                {d.title}
              </span>
              {state ? (
                <span
                  className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[state.status] }}
                />
              ) : (
                d.badge && (
                  <span className="ml-auto shrink-0 rounded bg-surface-container-high px-1 py-0.5 text-[9px] text-muted-foreground">
                    {d.badge}
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="truncate">{model ?? d.subtitle ?? d.kind}</span>
              {cost && <span className="ml-auto shrink-0">{cost}</span>}
              {duration && <span className="shrink-0">· {duration}</span>}
            </div>
          </div>
        </div>
        {state?.status === "running" && (
          <div
            className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full"
            style={{ background: "color-mix(in srgb, hsl(var(--muted-foreground)) 22%, transparent)" }}
          >
            <div
              className="h-full w-1/2 animate-pulse rounded-full"
              style={{ background: EDGE_RUNNING }}
            />
          </div>
        )}
      </div>
    );
  }

  // EXPANDED: the full card — icon header, type-aware metric chips, output/error
  // preview, run progress strip (with agent rounds), and the provider chip.
  return (
    <div className={`${wrapperClass} px-3 py-2`} style={wrapperStyle}>
      {handles}
      <div className="flex items-center gap-2">
        <NodeIcon kind={d.kind} accent={accent} box={24} glyph={14} />
        <span className="truncate font-medium text-[12px] text-foreground">
          {d.title}
        </span>
        {state ? (
          <span
            className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[state.status]}`}
          >
            {STATUS_LABEL[state.status]}
          </span>
        ) : (
          d.badge && (
            <span className="ml-auto shrink-0 rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {d.badge}
            </span>
          )
        )}
      </div>
      {d.subtitle && (
        <p
          className="mt-1 truncate text-[11px] text-muted-foreground"
          title={d.subtitle}
        >
          {d.subtitle}
        </p>
      )}
      {/* Type-aware metric chips: only what applies (model/cost are shown by any
          run; tokens are agent-only). Duration lives in the progress footer. */}
      {(model || cost || tokens) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {model && <MetaChip title={model}>{model}</MetaChip>}
          {cost && <MetaChip>{cost}</MetaChip>}
          {tokens && <MetaChip>{tokens}</MetaChip>}
        </div>
      )}
      {/* One-line output/error preview once the node has run. Error is red. */}
      {state?.status === "failed" && errorText && (
        <p
          className="mt-1.5 line-clamp-2 text-[10px] text-red-400"
          title={errorText}
        >
          {errorText}
        </p>
      )}
      {outputText && state?.status !== "failed" && (
        <p
          className="mt-1.5 line-clamp-2 text-[10px] text-muted-foreground"
          title={outputText}
        >
          {outputText}
        </p>
      )}
      {/* Progress is an action/branch concern. A trigger only fires (it has no
          rounds, output, or metrics), so it shows just its status in the header
          and reserves no run rows — rendering a strip here would clip. */}
      {state && d.tone !== "trigger" && (
        <ProgressStrip
          status={state.status}
          rounds={isAgent ? state.rounds : undefined}
          elapsed={duration}
        />
      )}
      {d.provider && (
        <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] text-muted-foreground">
          <ProviderIcon
            id={d.provider}
            displayName={providerLabel(d.provider)}
            size={12}
            className="rounded-[2px]"
          />
          {providerLabel(d.provider)}
        </span>
      )}
    </div>
  );
}

// Stable identity so React Flow doesn't warn about a new nodeTypes object.
const NODE_TYPES = { wfNode: WorkflowNode };

/** An edge is colored by the status of the node it points AT, so the run's
 *  "front" lights up: the hop into the running node animates in the primary
 *  accent, completed hops read green, a failed target reads red, and not-yet-
 *  reached (queued) or the static definition view stay neutral. */
function edgeColor(status: WfNodeStatus | undefined): string {
  switch (status) {
    case "running":
      return EDGE_RUNNING;
    case "succeeded":
      return EDGE_DONE;
    case "failed":
      return EDGE_FAIL;
    default:
      return EDGE_MUTED;
  }
}

export function buildStyledEdges(
  base: Edge[],
  nodeState: Record<string, WfNodeState> | undefined,
): Edge[] {
  return base.map((e) => {
    const status = nodeState?.[e.target]?.status;
    const color = edgeColor(nodeState ? status : undefined);
    return {
      ...e,
      // The active hop flows; everything else is static.
      animated: status === "running",
      style: { strokeWidth: 1.75, stroke: color },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color,
      },
    };
  });
}

export interface WorkflowGraphProps {
  /** Workflow YAML to render. */
  yaml: string;
  /** "full" = interactive (pan/zoom/drag + controls); "preview" = static fit. */
  variant?: "full" | "preview";
  /** Flow direction: "LR" (default) reads left-to-right — best for the wide/short
   *  run-detail panel; "TB" is a vertical column. */
  direction?: WfDirection;
  /** Start collapsed (compact icon tiles) rather than expanded. The full variant
   *  exposes a toggle to switch densities; the preview variant is always compact.
   *  Defaults to `false` (expanded). */
  defaultCompact?: boolean;
  /** Sizing for the wrapper; the caller controls height. */
  className?: string;
  /**
   * Live per-node run state, keyed by graph node id (`trigger`, `a0`, `a0-b1`).
   * Absent ⇒ the static definition view (the proposal-card preview passes
   * nothing). When present, each node shows its status/cost/duration/output and
   * the running node pulses.
   *
   * Immutability contract: the node memo keys on this object's reference, so the
   * host MUST pass a NEW top-level `nodeState` object whenever any node's state
   * changes (mutating a nested entry in place will not re-render). Building a
   * fresh record each update — e.g. from a poll/SSE tick — satisfies this.
   */
  nodeState?: Record<string, WfNodeState>;
  /** Click handler for a node (e.g. open a detail drawer). Absent ⇒ nodes are
   *  non-interactive on click. */
  onNodeClick?: (nodeId: string, data: WfNodeData) => void;
}

export function WorkflowGraph({
  yaml,
  variant = "full",
  direction = "LR",
  defaultCompact = false,
  className,
  nodeState,
  onNodeClick,
}: WorkflowGraphProps) {
  const colorMode = useColorMode();
  const isPreview = variant === "preview";
  // The proposal-card preview is always compact (a small thumbnail); the full
  // variant defaults per prop and lets the user toggle density.
  const [userCompact, setUserCompact] = useState(defaultCompact);
  const compact = isPreview || userCompact;
  const rfRef = useRef<ReactFlowInstance<Node<WfNodeData>> | null>(null);

  // Structural graph from the YAML alone — STABLE across nodeState ticks. Built
  // with run-state spacing reserved whenever a run overlay is in play (nodeState
  // supplied), so live state can be merged onto a node WITHOUT reflowing
  // positions. Recomputed only when the definition (or run-mode) changes — never
  // on a token/poll tick — so React Flow keeps each node's identity and measured
  // size instead of tearing the canvas down and re-measuring (which blanked the
  // graph on every update).
  const hasRunOverlay = nodeState !== undefined;
  const structural = useMemo(
    () =>
      buildFlowGraph(yaml, {
        nodeState: hasRunOverlay ? {} : undefined,
        direction,
        compact,
      }),
    [yaml, hasRunOverlay, direction, compact],
  );

  // Edges restyled from the current run state (colored by each edge's target
  // status; the active hop animates). Derived from the STABLE structural edges +
  // nodeState, so a poll/SSE tick repaints edge color/flow without touching node
  // layout. Neutral throughout the static definition/preview view (no nodeState).
  const styledEdges = useMemo(
    () => buildStyledEdges(structural.edges, nodeState),
    [structural.edges, nodeState],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(structural.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges);

  // Re-seed React Flow's nodes when the definition (or run-mode) changes. The
  // merge effect below re-applies the current run state in its own pass, so this
  // only needs the static base nodes.
  useEffect(() => {
    setNodes(structural.nodes);
  }, [structural, setNodes]);

  // Repaint edges whenever the styling (structure or run state) changes. Edge ids
  // are stable, so React Flow updates color/animation in place.
  useEffect(() => {
    setEdges(styledEdges);
  }, [styledEdges, setEdges]);

  // Merge live run state onto the EXISTING nodes — replacing only each node's
  // `data` and preserving its identity, position, and measured size — so a
  // poll/SSE tick repaints status/cost/output in place. Reading the base data
  // from `structural` (not from the previous node) keeps `state` from
  // accumulating; an unchanged node is returned as-is so it never re-renders.
  useEffect(() => {
    const baseById = new Map(structural.nodes.map((n) => [n.id, n.data]));
    setNodes((prev) => mergeRunState(prev, baseById, nodeState));
  }, [nodeState, structural, setNodes]);

  // Reframe the viewport when the layout STRUCTURE changes (a definition edit,
  // orientation, or the density toggle) — node ids/count are unchanged across a
  // density flip, so React Flow won't auto-fit and the graph would otherwise be
  // left mis-zoomed. Deferred a frame so it runs after the re-seeded nodes (with
  // their new sizes) commit. Not triggered by a run-state tick (structural is
  // stable then), so a live run is never yanked around.
  useEffect(() => {
    const inst = rfRef.current;
    if (!inst || typeof requestAnimationFrame === "undefined") return;
    const raf = requestAnimationFrame(() => inst.fitView({ padding: 0.18 }));
    return () => cancelAnimationFrame(raf);
  }, [structural]);

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node<WfNodeData>) => {
      onNodeClick?.(node.id, node.data);
    },
    [onNodeClick],
  );

  if (structural.error || structural.nodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-border border-dashed p-4 text-center text-muted-foreground text-xs ${className ?? ""}`}
      >
        {structural.error ?? "Nothing to show"}
      </div>
    );
  }

  return (
    <DirectionContext.Provider value={direction}>
      <DensityContext.Provider value={compact}>
      <div className={`wf-graph ${className ?? ""}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        colorMode={colorMode}
        onInit={(inst) => {
          rfRef.current = inst;
        }}
        onNodeClick={onNodeClick ? handleNodeClick : undefined}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        // Node dragging is reserved for the full editor; a preview stays
        // read-only so its layout can't be disturbed. Both variants pan + zoom so
        // a dense graph is explorable.
        nodesDraggable={!isPreview}
        nodesConnectable={false}
        // The graph is a read-only run VISUALIZATION: dragging (full variant) and
        // pan/zoom aid exploration, but a node/edge must never be deletable or
        // reconnectable. With onNodesChange/onEdgesChange wired (needed so React
        // Flow can persist measured sizes), the Delete/Backspace key would
        // otherwise remove a selected node from the view until the next re-seed.
        deleteKeyCode={null}
        edgesReconnectable={false}
        elementsSelectable={!isPreview}
        edgesFocusable={false}
        // Wheel-scroll passes through to the page (it doesn't hijack the page to
        // zoom); pan by dragging, zoom via the Controls buttons or pinch.
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={!isPreview}
        panOnDrag
        preventScrolling={false}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background gap={18} />
        {/* The compact proposal-card preview is a glanceable thumbnail — the
            zoom/fit controls and density toggle only clutter it (it still pans +
            pinch-zooms and is always compact). */}
        {!isPreview && (
          <>
            <Controls showInteractive={false} position="bottom-right" />
            <Panel position="top-left">
              <button
                type="button"
                onClick={() => setUserCompact((c) => !c)}
                aria-pressed={userCompact}
                title={userCompact ? "Expand nodes" : "Collapse nodes"}
                className="flex items-center gap-1 rounded-md border border-border bg-card/80 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
              >
                {userCompact ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                {userCompact ? "Expand" : "Compact"}
              </button>
            </Panel>
          </>
        )}
      </ReactFlow>
      </div>
      </DensityContext.Provider>
    </DirectionContext.Provider>
  );
}
