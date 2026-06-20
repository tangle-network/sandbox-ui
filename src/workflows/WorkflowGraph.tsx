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
import { useEffect, useMemo, useState } from "react";
import {
  buildWorkflowGraph,
  type WfNodeData,
  type WfNodeTone,
} from "./model";
import { providerLabel } from "../assistant/provider-label";

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

function WorkflowNode({ data }: NodeProps) {
  const d = data as unknown as WfNodeData;
  return (
    <div
      className={`relative w-[240px] rounded-lg border px-3 py-2 shadow-sm ${TONE_CARD[d.tone]}`}
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
        {d.badge && (
          <span className="ml-auto rounded bg-background-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">
            {d.badge}
          </span>
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
      {d.provider && (
        <span className="mt-1.5 inline-block rounded bg-background-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">
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
}

export function WorkflowGraph({
  yaml,
  variant = "full",
  className,
}: WorkflowGraphProps) {
  const colorMode = useColorMode();
  const { nodes, edges, error } = useMemo(() => {
    const graph = buildWorkflowGraph(yaml);
    return {
      error: graph.error,
      nodes: graph.nodes.map(
        (n): Node => ({
          id: n.id,
          type: "wfNode",
          position: n.position,
          data: n.data as unknown as Record<string, unknown>,
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
  }, [yaml]);

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
