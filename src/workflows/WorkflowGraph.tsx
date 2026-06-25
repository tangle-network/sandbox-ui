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
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildWorkflowGraph,
  type WfNodeData,
  type WfNodeState,
  type WfNodeStatus,
  type WfNodeTone,
} from "./model";
import { fmtCost, fmtDuration } from "./format";
import { providerLabel } from "../assistant/provider-label";
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

const TONE_CARD: Record<WfNodeTone, string> = {
  trigger: "border-primary/60 bg-primary/5",
  structural: "border-accent-yellow/50 bg-accent-yellow/5",
  action: "border-border bg-card",
};

const TONE_DOT: Record<WfNodeTone, string> = {
  trigger: "bg-primary",
  structural: "bg-accent-yellow",
  action: "bg-text-muted",
};

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
  queued: "bg-background-tertiary text-text-muted",
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
      return "border-primary ring-2 ring-primary/40 animate-pulse";
    case "succeeded":
      return "border-green-500";
    case "failed":
      return "border-red-500";
    default:
      return "opacity-70";
  }
}

/** A compact key/value chip for the node's meta row. */
function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-background-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">
      {children}
    </span>
  );
}

function WorkflowNode({ data }: NodeProps<Node<WfNodeData>>) {
  const d = data;
  const state = d.state;
  // The model the card shows: what the run ACTUALLY used wins over the requested
  // one, so a fan-out branch / fallback is visible once a run is live.
  const model = state?.model ?? d.model;
  const duration = fmtDuration(state?.durationMs);
  const cost = fmtCost(state?.costUsd);
  const tokens =
    state?.outputTokens !== undefined || state?.inputTokens !== undefined
      ? `${state?.inputTokens ?? 0}/${state?.outputTokens ?? 0} tok`
      : undefined;
  return (
    <div
      className={`relative w-[240px] rounded-lg border px-3 py-2 shadow-sm transition-colors ${
        TONE_CARD[d.tone]
      } ${state ? statusBorder(state.status) : ""}`}
    >
      {!d.isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          className={HANDLE_CLASS}
        />
      )}
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[d.tone]}`}
        />
        <span className="font-medium text-[12px] text-text">{d.title}</span>
        {state ? (
          <span
            className={`ml-auto rounded px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[state.status]}`}
          >
            {STATUS_LABEL[state.status]}
          </span>
        ) : (
          d.badge && (
            <span className="ml-auto rounded bg-background-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">
              {d.badge}
            </span>
          )
        )}
      </div>
      {d.subtitle && (
        <p
          className="mt-1 truncate text-[11px] text-text-muted"
          title={d.subtitle}
        >
          {d.subtitle}
        </p>
      )}
      {/* Meta row: the action kind + (model/cost/duration/tokens once a run is
          live). Kept to short chips; the full detail is in the expand drawer. */}
      {(model || cost || duration || tokens || state) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {d.kind && d.tone === "action" && <MetaChip>{d.kind}</MetaChip>}
          {model && <MetaChip>{model}</MetaChip>}
          {cost && <MetaChip>{cost}</MetaChip>}
          {duration && <MetaChip>{duration}</MetaChip>}
          {tokens && <MetaChip>{tokens}</MetaChip>}
        </div>
      )}
      {/* One-line output/error preview once the node has run. Error is red. */}
      {state?.status === "failed" && state.error && (
        <p
          className="mt-1.5 line-clamp-2 text-[10px] text-red-400"
          title={state.error}
        >
          {state.error}
        </p>
      )}
      {state?.outputPreview && state.status !== "failed" && (
        <p
          className="mt-1.5 line-clamp-2 text-[10px] text-text-muted"
          title={state.outputPreview}
        >
          {state.outputPreview}
        </p>
      )}
      {d.provider && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-background-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">
          <ProviderIcon
            id={d.provider}
            displayName={providerLabel(d.provider)}
            size={12}
            className="rounded-[2px]"
          />
          {providerLabel(d.provider)}
        </span>
      )}
      <Handle
        type="source"
        id="out"
        position={Position.Bottom}
        className={HANDLE_CLASS}
      />
      {d.hasBranches && (
        <Handle
          type="source"
          id="branch"
          position={Position.Right}
          className={HANDLE_CLASS}
        />
      )}
    </div>
  );
}

// Stable identity so React Flow doesn't warn about a new nodeTypes object.
const NODE_TYPES = { wfNode: WorkflowNode };

export interface WorkflowGraphProps {
  /** Workflow YAML to render. */
  yaml: string;
  /** "full" = interactive (pan/zoom/drag + controls); "preview" = static fit. */
  variant?: "full" | "preview";
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
  className,
  nodeState,
  onNodeClick,
}: WorkflowGraphProps) {
  const colorMode = useColorMode();
  const { nodes, edges, error } = useMemo(() => {
    const graph = buildWorkflowGraph(yaml);
    return {
      error: graph.error,
      nodes: graph.nodes.map(
        (n): Node<WfNodeData> => ({
          id: n.id,
          type: "wfNode",
          position: n.position,
          // Merge live run state (if any) onto the static node data so the node
          // component renders status/cost/output without a separate channel.
          data: nodeState?.[n.id]
            ? { ...n.data, state: nodeState[n.id] }
            : n.data,
        }),
      ),
      edges: graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        type: "smoothstep",
      })),
    };
  }, [yaml, nodeState]);

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node<WfNodeData>) => {
      onNodeClick?.(node.id, node.data);
    },
    [onNodeClick],
  );

  if (error || nodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-border border-dashed p-4 text-center text-text-muted text-xs ${className ?? ""}`}
      >
        {error ?? "Nothing to show"}
      </div>
    );
  }

  const isPreview = variant === "preview";
  return (
    <div className={`wf-graph ${className ?? ""}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={colorMode}
        onNodeClick={onNodeClick ? handleNodeClick : undefined}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        // Node dragging is reserved for the full editor; a preview stays
        // read-only so its layout can't be disturbed. Both variants pan + zoom so
        // a dense graph is explorable.
        nodesDraggable={!isPreview}
        nodesConnectable={false}
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
        <Background gap={16} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
