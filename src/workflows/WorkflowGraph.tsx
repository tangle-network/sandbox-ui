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
import { Maximize2, Minimize2 } from "lucide-react";
import {
  createContext,
  type MouseEvent as ReactMouseEvent,
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
} from "./model";
import { buildFlowGraph, mergeRunState } from "./flow-graph";
import { clampPreview, fmtCost, fmtDuration, fmtTokens } from "./format";
import { classifyOutput, NodeOutputBody } from "./node-output";
import {
  edgeColor,
  EDGE_RUNNING,
  MetaChip,
  NodeIcon,
  progressFill,
  STATUS_BADGE,
  STATUS_COLOR,
  STATUS_LABEL,
  statusBorder,
  TONE_ACCENT,
} from "./node-ui";
import { providerLabel } from "./provider-label";
import { ProviderIcon } from "../integrations/provider-logo";

/** Track color behind a progress bar — a faint wash of the muted token. */
const MUTED_TRACK =
  "color-mix(in srgb, hsl(var(--muted-foreground)) 22%, transparent)";

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

/** Compact (collapsed) density for the current graph — read by the node so it
 *  renders the icon-tile summary instead of the full card. Set by the density
 *  toggle (and forced on for the proposal-card preview). */
export const DensityContext = createContext<boolean>(false);

/**
 * The run status FOOTER: a progress bar (queued = near-empty, running = pulsing
 * partial, terminal = full green/red) over a caption row. Pinned to the card's
 * BOTTOM via `mt-auto` so it lands at the same place on every node regardless of
 * how much content sits above it — unlike an inline strip, whose height drifts.
 * The caption reads agent rounds on the left and elapsed on the right; status
 * itself is carried by the bar color + the header pill, so it is NOT restated
 * here. The caption row always renders (even when empty) so the footer band keeps
 * a constant height across nodes.
 */
function StatusFooter({
  status,
  rounds,
  elapsed,
}: {
  status: WfNodeStatus;
  rounds?: number;
  elapsed?: string;
}) {
  // `!== undefined` (not truthiness) so an explicit `rounds: 0` — a just-started
  // agent — still renders "0 rounds" rather than being hidden.
  const roundsLabel =
    rounds !== undefined
      ? `${rounds} round${rounds === 1 ? "" : "s"}`
      : undefined;
  return (
    <div className="mt-auto border-border/60 border-t">
      <div className="h-1 w-full overflow-hidden" style={{ background: MUTED_TRACK }}>
        {/* Only a RUNNING bar animates. A `waiting` run is stopped at this node
            until a human answers it, and a moving bar would say otherwise. */}
        <div
          data-testid="wf-node-progress"
          className={`h-full ${status === "running" ? "animate-pulse" : ""}`}
          style={{ width: progressFill(status), background: STATUS_COLOR[status] }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-1 text-[9px] text-muted-foreground">
        <span className="truncate">{roundsLabel ?? ""}</span>
        {elapsed && <span className="shrink-0">{elapsed}</span>}
      </div>
    </div>
  );
}

// Handles are positioned anchors for edges; we hide the dots so edges appear to
// connect to the node body for a clean diagram look.
const HANDLE_CLASS = "!h-2 !w-2 !min-w-0 !border-0 !bg-transparent opacity-0";

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
  // The output block once a node has run: a failure's error (red) or a success/
  // partial output preview. Bound the host-supplied string before it hits the DOM
  // (the card shows a short preview; CSS clamping is visual only), then classify
  // it so JSON renders as key/value and prose as prose. Null while there's nothing
  // to show yet (queued, or a running node before its first token) — and also when
  // the preview classifies to `empty` (e.g. whitespace-only host data), so the card
  // never shows a bare "Output"/"Error" label over an empty body.
  const runOutput = ((): {
    shape: ReturnType<typeof classifyOutput>;
    tone: "default" | "error";
    label: string;
  } | null => {
    const source =
      state?.status === "failed" && state.error
        ? { text: state.error, tone: "error" as const, label: "Error" }
        : state && state.status !== "failed" && state.outputPreview
          ? { text: state.outputPreview, tone: "default" as const, label: "Output" }
          : null;
    if (!source) return null;
    // Reject blank/whitespace-only host text up front: otherwise `clampPreview`
    // can turn long whitespace into a bare "…" that classifies as text and
    // resurrects the block the empty check is meant to suppress. The empty check
    // below still guards the case where classification itself yields nothing (e.g.
    // a lone-surrogate-only preview stripped to "").
    const trimmed = source.text.trim();
    if (!trimmed) return null;
    const shape = classifyOutput(clampPreview(trimmed));
    return shape.kind === "empty"
      ? null
      : { shape, tone: source.tone, label: source.label };
  })();

  // Border/glow + static tone tint are shared by both densities. Once a run is
  // live, the status-border className takes over; a running node also gets a soft
  // primary glow so the active step reads at a glance.
  const wrapperClass = `relative flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-colors ${
    state ? statusBorder(state.status) : ""
  }`;
  const wrapperStyle = state
    ? state.status === "running"
      ? { boxShadow: "0 0 22px -6px hsl(var(--primary))" }
      : state.status === "waiting"
        ? // The parked node is the one the viewer has to act on, so it gets the
          // same "look here" glow as the live one — in warning amber, because it
          // is blocked, not working.
          { boxShadow: "0 0 22px -6px var(--surface-warning-text)" }
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
            style={{ background: MUTED_TRACK }}
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

  // EXPANDED: an identity/detail region over a bottom-pinned status footer. The
  // region (`flex-1`) top-aligns the icon header, subtitle, provider chip, metric
  // chips, and the content-aware output block; the footer (`mt-auto`) carries the
  // progress bar + rounds/elapsed and always sits flush at the card's base.
  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {handles}
      <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-2">
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
        {/* Type-aware metric chips: only what applies (model/cost are shown by any
            run; tokens are agent-only). Rounds + elapsed live in the footer. */}
        {(model || cost || tokens) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {model && <MetaChip title={model}>{model}</MetaChip>}
            {cost && <MetaChip>{cost}</MetaChip>}
            {tokens && <MetaChip>{tokens}</MetaChip>}
          </div>
        )}
        {/* Content-aware output/error block with a micro-label — JSON renders as
            key/value, prose as prose. Suppressed for a failure with no error. */}
        {runOutput && (
          <div className="mt-1.5 min-h-0">
            <div className="mb-0.5 font-medium text-[8px] text-muted-foreground/70 uppercase tracking-[0.08em]">
              {runOutput.label}
            </div>
            <NodeOutputBody shape={runOutput.shape} tone={runOutput.tone} rows={2} />
          </div>
        )}
      </div>
      {/* The status footer is an action/branch concern. A trigger only fires (no
          rounds/output/progress), so it reserves no footer rows and skips it —
          rendering one would clip its shorter box. */}
      {state && d.tone !== "trigger" && (
        <StatusFooter
          status={state.status}
          rounds={isAgent ? state.rounds : undefined}
          elapsed={duration}
        />
      )}
    </div>
  );
}

// Stable identity so React Flow doesn't warn about a new nodeTypes object.
const NODE_TYPES = { wfNode: WorkflowNode };

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
  // orientation, the density toggle, or a run-overlay transition) — node ids/count
  // are unchanged across a density flip, so React Flow won't auto-fit and the
  // graph would otherwise be left mis-zoomed. Deferred a frame so it runs after
  // the re-seeded nodes (with their new sizes) commit. A run-state tick doesn't
  // change `structural`, so a live run is never yanked around.
  const didInitialFitRef = useRef(false);
  useEffect(() => {
    // ReactFlow's `fitView` prop already frames the initial render — skip this
    // effect's first run so we don't double-fit on mount.
    if (!didInitialFitRef.current) {
      didInitialFitRef.current = true;
      return;
    }
    const inst = rfRef.current;
    if (!inst || typeof requestAnimationFrame === "undefined") return;
    // cancelAnimationFrame is universally paired with requestAnimationFrame, so
    // the single guard above covers the cleanup too.
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
