/**
 * n8n-style node-graph view of a workflow, rendered from its YAML definition.
 * Used full-size on the workflow detail page and as a compact, non-interactive
 * preview on assistant proposal cards. Both share one graph model + node
 * component; only interactivity and sizing differ by `variant`.
 */

import {
  Background,
  BaseEdge,
  type ColorMode,
  Controls,
  EdgeLabelRenderer,
  type EdgeProps,
  getNodesBounds,
  getSmoothStepPath,
  getViewportForBounds,
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
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  COMPACT_NODE_SIZE,
  COMPACT_TILE,
  triggerNodeIndex,
  type WfDirection,
  type WfEdgeKind,
  type WfEdgeSpec,
  type WfNodeData,
  type WfNodeState,
  type WfNodeStatus,
} from "./model";
import {
  buildFlowGraph,
  mergeRunState,
  WF_EDGE_TYPE,
  type WfFlowEdge,
} from "./flow-graph";
import { clampPreview, fmtCost, fmtDuration, fmtTokens } from "./format";
import { classifyOutput, NodeOutputBody } from "./node-output";
import { shortModel } from "./naming";
import {
  edgeColor,
  NodeMark,
  progressFill,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_PILL,
  statusBorder,
  TONE_ACCENT,
} from "./node-ui";

/** Track color behind a progress bar — a faint wash of the muted token. */
const MUTED_TRACK =
  "color-mix(in srgb, hsl(var(--muted-foreground)) 22%, transparent)";

/**
 * How the graph frames itself. The floor is the point of it: fitting a long
 * pipeline into a short panel by zooming out without limit is what shrank the
 * nodes to unreadable specks. Below `minZoom` the graph stops shrinking and
 * becomes pannable instead — a legible graph you scroll beats an illegible one
 * that fits.
 *
 * The CEILING depends on density. Full cards at 1 are already their designed
 * size — zooming a two-node graph past that just blows the cards up to fill the
 * canvas. Compact tiles are small BY DESIGN, so fitting them into the same
 * canvas legitimately zooms past 1; capping them there strands a short compact
 * graph as specks in empty space.
 */
const FIT_VIEW = { padding: 0.16, minZoom: 0.55 } as const;

/** Zoom ceiling for a fit at the given density (see FIT_VIEW). */
export function fitZoomCeiling(compact: boolean): number {
  return compact ? 1.5 : 1;
}

/** How long a layout transition (the density toggle) runs — short enough that
 *  the toggle feels immediate, long enough to read as the same graph being
 *  reframed rather than replaced. */
export const LAYOUT_TRANSITION_MS = 220;

/**
 * When the RENDERED density flips inside the layout tween, as a fraction of
 * LAYOUT_TRANSITION_MS. The box morphs first and the incoming content fades in
 * mid-motion (see `.wf-node-body-in`) — flipping while everything is already
 * moving is what keeps the swap from reading as a pop. Direction matters: the
 * two densities' shells are closest in size near the COMPACT geometry, so
 * growing (→ expanded) flips just after the box starts to grow, and shrinking
 * (→ compact) flips once the card has nearly collapsed.
 */
const DENSITY_FLIP_AT = { grow: 0.12, shrink: 0.75 } as const;

/** Motion is opt-OUT, so it is only used where the reader's preference can be
 *  read and says nothing against it. Somewhere without `matchMedia` cannot say
 *  a reader tolerates movement, so it gets none. */
function motionAllowed(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === false
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The layout tween's easing — gentle into and out of the motion, so neither
 *  end of the morph reads as a snap. */
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

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
 * The node the HOST considers selected, if any. Carried by context rather than
 * merged into node data because selection is not a property of the workflow:
 * writing it into `data` would rebuild the node objects on every selection
 * change, which is the one thing the run-state merge works hard to avoid.
 */
export const SelectedNodeContext = createContext<string | undefined>(undefined);

/** The selected node's ring. An `outline` rather than a border or a box-shadow
 *  because both of those are already spoken for — the border carries tone and
 *  run status, the shadow carries the running/waiting glow — and an outline
 *  composes with both without disturbing the laid-out box. */
const SELECTION_OUTLINE: CSSProperties = {
  outline: "2px solid hsl(var(--primary))",
  outlineOffset: 2,
};

/** Whether the canvas is currently an EDITOR — read by the node so its
 *  connection handles become visible targets rather than the invisible anchors
 *  a read-only diagram wants. A handle you cannot see is a handle you cannot
 *  find, and dragging one is the whole gesture. */
export const ConnectableContext = createContext<boolean>(false);

/**
 * Whether an edge is the HOST's to change. Only a declared edge is: a fork edge
 * is fan-out structure derived from a structural action's own config, and an
 * edge out of a trigger is what "nothing points at this node" renders as.
 * Neither appears in anyone's declared topology, so neither can be connected,
 * deleted, or guarded — offering the gesture would invite an edit with nowhere
 * to land.
 */
export function isEditableEdge(edge: {
  source: string;
  data?: { kind?: WfEdgeKind } | undefined;
}): boolean {
  return edge.data?.kind !== "fork" && triggerNodeIndex(edge.source) === null;
}

/**
 * The run status FOOTER: a progress bar (queued = near-empty, running = pulsing
 * partial, terminal = full) over a caption row. Pinned to the card's BOTTOM via
 * `mt-auto` so it lands at the same place on every node regardless of how much
 * content sits above it — unlike an inline strip, whose height drifts. The
 * caption reads agent rounds on the left and elapsed on the right; status itself
 * is carried by the bar color + the header pill, so it is NOT restated here. The
 * caption row always renders (even when empty) so the footer band keeps a
 * constant height across nodes.
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
    <div className="wf-node-body-in mt-auto border-border border-t">
      <div
        className="h-1 w-full overflow-hidden"
        style={{ background: MUTED_TRACK }}
      >
        {/* Only a RUNNING bar animates. A `waiting` run is stopped at this node
            until a human answers it, and a moving bar would say otherwise. */}
        <div
          data-testid="wf-node-progress"
          className={`h-full ${status === "running" ? "animate-pulse" : ""}`}
          style={{
            width: progressFill(status),
            background: STATUS_COLOR[status],
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-1 text-[10px] text-muted-foreground leading-[15px]">
        {/* Both spans always render (even empty) and the line box is pinned, so a
            node with nothing to caption keeps the same footer height as one with
            rounds AND elapsed — the band the layout reserved. */}
        <span className="min-h-[15px] truncate">{roundsLabel ?? ""}</span>
        <span className="min-h-[15px] shrink-0 tabular-nums">{elapsed ?? ""}</span>
      </div>
    </div>
  );
}

/**
 * What an expanded card says where its output WOULD be, when it has none. The
 * card is sized for the output it may yet have (the layout is computed once,
 * before any run state, so it can never reflow mid-run) — leaving that space
 * blank reads as a broken card rather than as a step with nothing to report. A
 * running node is the exception: its output may still be on its way, so it waits
 * quietly rather than claiming there is none.
 */
function emptySlotLabel(status: WfNodeStatus): string | undefined {
  switch (status) {
    case "queued":
      return "Not run yet";
    case "succeeded":
      return "No output";
    case "failed":
      return "No error reported";
    default:
      return undefined;
  }
}

/** The status pill in a card's header — the one place the run state is spelled
 *  out in words. */
function StatusPill({ status }: { status: WfNodeStatus }) {
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-[1px] font-medium text-[10px]"
      style={STATUS_PILL[status]}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// Handles are positioned anchors for edges; we hide the dots so edges appear to
// connect to the node body for a clean diagram look.
const HANDLE_CLASS = "!h-2 !w-2 !min-w-0 !border-0 !bg-transparent opacity-0";

/** On an EDITABLE canvas the handle stops being a hidden anchor and becomes the
 *  thing you drag. Drawn as a small ring in the muted token so it reads as an
 *  affordance without competing with the node's own mark or status border. */
const HANDLE_CONNECTABLE_CLASS =
  "!h-2.5 !w-2.5 !min-w-0 !rounded-full !border !border-border !bg-muted-foreground/70 opacity-100 transition-opacity hover:!bg-primary";

/**
 * Where a compact node's edges attach. The compact BOX spans the icon tile AND
 * its name (so a name can never collide with a neighbour), but the edges belong
 * to the TILE — at the box's default anchors they would leave from the whitespace
 * beside the name. These pin each handle to the tile's own edge midpoint.
 *
 * Every anchor is given as an explicit `left`/`top` with a centering transform,
 * overriding React Flow's per-side defaults (which offset by half the handle and
 * anchor Bottom/Right from the far edge). Restating all four in one coordinate
 * system is what makes the anchor exactly the tile's edge — and not, say, 4px
 * past it, which is what the library's own bottom transform would have done.
 */
function compactHandleStyle(
  position: Position,
  isLR: boolean,
): CSSProperties {
  // LR: tile centered along the box's top. TB: tile at the box's leading edge.
  const tileLeft = isLR ? (COMPACT_NODE_SIZE.width - COMPACT_TILE) / 2 : 0;
  const center = COMPACT_TILE / 2;
  const anchor = (left: number, top: number): CSSProperties => ({
    left,
    top,
    right: "auto",
    bottom: "auto",
    transform: "translate(-50%, -50%)",
  });
  switch (position) {
    case Position.Left:
      return anchor(tileLeft, center);
    case Position.Right:
      return anchor(tileLeft + COMPACT_TILE, center);
    case Position.Top:
      return anchor(tileLeft + center, 0);
    default:
      return anchor(tileLeft + center, COMPACT_TILE);
  }
}

export function WorkflowNode({ id, data }: NodeProps<Node<WfNodeData>>) {
  const d = data;
  const state = d.state;
  const direction = useContext(DirectionContext);
  const compact = useContext(DensityContext);
  const connectable = useContext(ConnectableContext);
  const hostSelection = useContext(SelectedNodeContext);
  // Compared only once the host HAS a selection: `undefined === undefined` would
  // otherwise ring a node whose id is also unset, so "nothing is selected" would
  // render as "this one is".
  const selected = hostSelection !== undefined && hostSelection === id;
  const isLR = direction === "LR";
  const targetPos = isLR ? Position.Left : Position.Top;
  const sourcePos = isLR ? Position.Right : Position.Bottom;
  const accent = TONE_ACCENT[d.tone];
  const isAgent = d.kind === "agent.run";
  // What the card says the step IS. For an agent, the model a run ACTUALLY used
  // supersedes the requested one, so a fan-out branch / fallback model is visible
  // once live — shortened the same way the definition's model was, so the label
  // doesn't grow a vendor prefix the moment the run starts.
  const subtitle =
    isAgent && state?.model ? shortModel(state.model) : d.subtitle;
  // The brand mark names the SAME model the subtitle does. A run that fell back to
  // another lab would otherwise sit under its requested lab's logo — an Anthropic
  // mark beside the words "gpt-5.4".
  const markModel = isAgent && state?.model ? state.model : d.model;
  // Whether this card may render the bands a RUN adds — the metrics line, the
  // output block, the "nothing to report" line, and the status footer. It mirrors
  // `nodeHeight` (model.ts), which reserves those rows for an action but NOT for a
  // trigger: a trigger only fires, so it is spaced by its static height alone.
  // Render a run band on a trigger and it has nowhere to go — it overflows the box
  // the layout gave it. The two rules are one rule; keep them in step.
  const runBands = state !== undefined && d.tone !== "trigger";
  const duration = fmtDuration(state?.durationMs);
  const cost = fmtCost(state?.costUsd);
  // Tokens are an agent.run concern; other kinds never show a token count.
  const tokens = isAgent
    ? fmtTokens(state?.inputTokens, state?.outputTokens)
    : undefined;
  // The output block once a node has run: a failure's error or a success/partial
  // output preview. Bound the host-supplied string before it hits the DOM (the
  // card shows a short preview; CSS clamping is visual only), then classify it so
  // JSON renders as key/value and prose as prose. Null while there's nothing to
  // show yet (queued, or a running node before its first token) — and also when
  // the preview classifies to `empty` (e.g. whitespace-only host data), so the
  // card never shows a bare "Output"/"Error" label over an empty body.
  const runOutput = ((): {
    shape: ReturnType<typeof classifyOutput>;
    tone: "default" | "error";
    label: string;
  } | null => {
    const source =
      state?.status === "failed" && state.error
        ? { text: state.error, tone: "error" as const, label: "Error" }
        : state && state.status !== "failed" && state.outputPreview
          ? {
              text: state.outputPreview,
              tone: "default" as const,
              label: "Output",
            }
          : null;
    if (!source) return null;
    // Reject blank/whitespace-only host text up front: otherwise `clampPreview`
    // can turn long whitespace into a bare "…" that classifies as text and
    // resurrects the block the empty check is meant to suppress. The empty check
    // below still guards the case where classification itself yields nothing (e.g.
    // a lone-surrogate-only preview stripped to "").
    const trimmed = source.text.trim();
    if (!trimmed) return null;
    // Flatten markdown ONLY for an agent's own answer, which is the thing that
    // reads as a word dump. An error (a stack trace, a diff, a shell glob) and a
    // non-agent node's output (an API response body) are not markdown, and
    // condensing them REWRITES them — see classifyOutput.
    const shape = classifyOutput(
      clampPreview(trimmed),
      isAgent && source.tone !== "error",
    );
    return shape.kind === "empty"
      ? null
      : { shape, tone: source.tone, label: source.label };
  })();

  const handleClass = connectable ? HANDLE_CONNECTABLE_CLASS : HANDLE_CLASS;
  const handles = (
    <>
      {!d.isRoot && (
        <Handle
          type="target"
          position={targetPos}
          className={handleClass}
          style={compact ? compactHandleStyle(targetPos, isLR) : undefined}
        />
      )}
      <Handle
        type="source"
        position={sourcePos}
        className={handleClass}
        style={compact ? compactHandleStyle(sourcePos, isLR) : undefined}
      />
    </>
  );

  // COMPACT (the default): an n8n-style icon tile with the node's name alongside.
  // The tile is the node; the name is unboxed, on the canvas. Everything else —
  // prompts, metrics, output — is a click away in the node detail, or one density
  // toggle away on the card.
  //
  // The name sits UNDER the tile in LR and BESIDE it in TB, because an edge leaves
  // the tile's trailing edge: the right in LR (clear of a name below it), the
  // BOTTOM in TB (which is exactly where a name below it would be). Same node, laid
  // out so that no edge is ever drawn through a word. See COMPACT_NODE_SIZE_TB.
  if (compact) {
    return (
      <div
        className={`relative flex h-full w-full ${
          isLR ? "flex-col items-center" : "flex-row items-center"
        }`}
      >
        {handles}
        <span
          className="relative flex items-center justify-center rounded-xl border bg-card shadow-sm transition-colors"
          style={{
            width: COMPACT_TILE,
            height: COMPACT_TILE,
            ...(state
              ? statusBorder(state.status)
              : {
                  borderColor: `color-mix(in srgb, ${accent} 40%, hsl(var(--border)))`,
                }),
            // The TILE is the compact node (the name beside it is unboxed), so
            // the selection ring belongs to it and not to the wider box.
            ...(selected ? SELECTION_OUTLINE : {}),
          }}
        >
          {/* Fade the CONTENT in when the density swap lands mid layout-morph;
              the shell (this bordered tile / the card border) stays opaque so
              the node never blinks out. */}
          <span className="wf-node-body-in flex items-center justify-center">
            <NodeMark
              kind={d.kind}
              provider={d.provider}
              model={markModel}
              accent={accent}
              tile={Math.round(COMPACT_TILE * 0.62)}
            />
          </span>
          {d.badge && !state && (
            <span className="-right-1.5 -top-1.5 absolute rounded-full border border-border bg-card px-1.5 py-[1px] font-medium text-[10px] text-muted-foreground">
              {d.badge}
            </span>
          )}
          {state && (
            <span
              className={`-right-1 -top-1 absolute h-2.5 w-2.5 rounded-full border-2 ${
                state.status === "running" ? "animate-pulse" : ""
              }`}
              style={{
                background: STATUS_COLOR[state.status],
                borderColor: "hsl(var(--card))",
              }}
              aria-label={STATUS_LABEL[state.status]}
            />
          )}
        </span>
        <div
          className={`wf-node-body-in min-w-0 ${
            isLR ? "mt-2 w-full px-1 text-center" : "ml-2 flex-1 text-left"
          }`}
        >
          <div
            className="truncate font-semibold text-[12px] text-foreground leading-tight"
            title={d.title}
          >
            {d.title}
          </div>
          {subtitle && (
            <div
              className="truncate text-[11px] text-muted-foreground leading-tight"
              title={subtitle}
            >
              {subtitle}
            </div>
          )}
          {/* A run's headline numbers — what n8n shows under an executed node.
              Absent until the node has actually produced them. */}
          {(duration || cost) && (
            <div className="truncate text-[10px] text-muted-foreground/90 leading-tight tabular-nums">
              {[duration, cost].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    );
  }

  // EXPANDED: identity (mark + title + subtitle), then what it does, then what it
  // did — each its own band, in that order, over a bottom-pinned status footer.
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-colors"
      style={{
        ...(state
          ? statusBorder(state.status)
          : {
              borderColor: `color-mix(in srgb, ${accent} 40%, hsl(var(--border)))`,
            }),
        ...(selected ? SELECTION_OUTLINE : {}),
      }}
    >
      {handles}
      {/* The content region owns its overflow: each band is `shrink-0`, so a band
          that renders taller than its reservation (a consumer's font metrics) is
          CLIPPED here rather than squeezed — a squeezed band cuts a line of text
          in half, and pushes the pinned footer off the card. Fades in when the
          density swap lands mid layout-morph; the card's border/surface (the
          root) stays opaque so the node never blinks out. */}
      <div className="wf-node-body-in flex min-h-0 flex-1 flex-col overflow-hidden px-3.5 pt-2.5 pb-2">
        <div className="flex shrink-0 items-center gap-2.5">
          <NodeMark
            kind={d.kind}
            provider={d.provider}
            model={markModel}
            accent={accent}
            tile={34}
          />
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-semibold text-[13px] text-foreground leading-tight"
              title={d.title}
            >
              {d.title}
            </div>
            {subtitle && (
              <div
                className="truncate text-[11px] text-muted-foreground leading-tight"
                title={subtitle}
              >
                {subtitle}
              </div>
            )}
          </div>
          {state ? (
            <StatusPill status={state.status} />
          ) : (
            d.badge && (
              <span className="shrink-0 rounded-full border border-border bg-surface-container-high px-2 py-[1px] font-medium text-[10px] text-muted-foreground">
                {d.badge}
              </span>
            )
          )}
        </div>

        {/* What the step actually says: the agent's prompt, the notify URL, the
            events a trigger listens for. Two lines, then it's a click away. */}
        {d.description && (
          <p
            className="mt-2 line-clamp-2 shrink-0 text-[11px] text-muted-foreground leading-snug"
            title={d.description}
          >
            {d.description}
          </p>
        )}

        {/* Run metrics as ONE quiet line, not a row of boxes: cost and tokens are
            values, and values don't need a container each. Elapsed lives in the
            footer, beside the progress it belongs to. */}
        {runBands && (cost || tokens) && (
          <div className="mt-2 shrink-0 truncate text-[11px] text-muted-foreground tabular-nums">
            {[cost, tokens].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* Content-aware output/error block — JSON renders as key/value, prose as
            prose. Suppressed for a failure with no error. */}
        {runBands && runOutput && (
          <div className="mt-2 min-h-0 shrink-0 rounded-lg border border-border bg-surface-container-high/60 px-2 py-1.5">
            <div className="mb-1 font-semibold text-[9px] text-muted-foreground uppercase tracking-[0.09em]">
              {runOutput.label}
            </div>
            <NodeOutputBody
              shape={runOutput.shape}
              tone={runOutput.tone}
              rows={2}
            />
          </div>
        )}

        {/* A card with nothing to report SAYS so, rather than showing a void. */}
        {runBands && state && !runOutput && emptySlotLabel(state.status) && (
          <div className="mt-2 flex flex-1 items-center text-[11px] text-muted-foreground italic">
            {emptySlotLabel(state.status)}
          </div>
        )}
      </div>
      {runBands && state && (
        <StatusFooter
          status={state.status}
          rounds={isAgent ? state.rounds : undefined}
          elapsed={duration}
        />
      )}
    </div>
  );
}

/** Chip styling shared by the guard summary and the cycle badge, so an edge's
 *  two possible annotations read as one pair rather than two designs. */
const EDGE_CHIP_CLASS =
  "rounded-full border border-border bg-card/90 px-1.5 py-[1px] text-[10px] leading-tight backdrop-blur";

/**
 * An edge with something to say: a guard summary, a cycle marker, or both. Only
 * a declared topology produces either, so everything else stays on React Flow's
 * built-in `smoothstep` renderer and is unaffected by this component's
 * existence.
 *
 * The guard chip is truncated with its full text on `title`: a summary is
 * usually a few words, but it is host-supplied and nothing bounds it, and an
 * unbounded label on an edge overlaps the nodes either side of it.
 */
function WfEdgeRenderer({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<WfFlowEdge>) {
  // The same path shape the built-in edges draw, so a decorated edge and a
  // plain one in the same graph are the same line with different furniture.
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const backEdge = data?.backEdge === true;
  const whenLabel = data?.whenLabel;
  const visits = data?.maxNodeVisits;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {/* `nodrag nopan` so dragging a label pans nothing and drags nothing —
            the chips are readouts, not handles. They STACK rather than sit side
            by side: the corridor the layout reserves (EDGE_LABEL_LANE) is sized
            for one chip, and a guarded cycle carries two. */}
        <div
          className="nodrag nopan absolute flex flex-col items-center gap-0.5"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {whenLabel && (
            <span
              title={whenLabel}
              className={`${EDGE_CHIP_CLASS} max-w-40 truncate text-muted-foreground`}
            >
              {whenLabel}
            </span>
          )}
          {backEdge && (
            <span
              title={
                visits !== undefined
                  ? `Loops back — each node runs at most ${visits} time${visits === 1 ? "" : "s"} per run`
                  : "Loops back to a step that has already run"
              }
              className={`${EDGE_CHIP_CLASS} shrink-0 text-foreground`}
            >
              {visits !== undefined ? `↺ ≤${visits}` : "↺"}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// Stable identities so React Flow doesn't warn about a new types object.
const NODE_TYPES = { wfNode: WorkflowNode };
const EDGE_TYPES = { [WF_EDGE_TYPE]: WfEdgeRenderer };

export function buildStyledEdges(
  base: WfFlowEdge[],
  nodeState: Record<string, WfNodeState> | undefined,
  /** Per-node visit budget, stamped onto cycle-closing edges so the loop states
   *  its own bound. Omitted ⇒ the badge shows the loop without a number. */
  maxNodeVisits?: number,
): WfFlowEdge[] {
  return base.map((e) => {
    const status = nodeState?.[e.target]?.status;
    const color = edgeColor(nodeState ? status : undefined);
    const backEdge = e.data?.backEdge === true;
    return {
      ...e,
      // The active hop flows; everything else is static. A cycle-closing edge
      // never flows even into a running target: it is the loop's RETURN path,
      // and animating it would read as the run travelling backwards.
      animated: !backEdge && status === "running",
      style: {
        strokeWidth: 1.75,
        stroke: color,
        // Dashed, so a return path is distinguishable from a forward hop before
        // its badge is read — and at a zoom where the badge isn't legible.
        ...(backEdge ? { strokeDasharray: "6 3" } : {}),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color,
      },
      ...(backEdge && maxNodeVisits !== undefined && e.data
        ? { data: { ...e.data, maxNodeVisits } }
        : {}),
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
  /** Start collapsed (compact icon tiles) rather than expanded. Defaults to
   *  `true`: a graph is read structure-first, and the tiles are what make the
   *  shape of the run legible at a glance — the per-node detail is one density
   *  toggle (or one node click) away. The full variant exposes the toggle; the
   *  preview variant is always compact. */
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
  /**
   * The graph's DECLARED topology, replacing the spine inferred from `do`-list
   * order — see {@link WfEdgeSpec}. Name endpoints with the exported id helpers
   * (`actionNodeId`, `branchNodeId`, `TRIGGER_NODE_ID`).
   *
   * Immutability contract, as for `nodeState`: the layout memo keys on this
   * array's reference, so pass a stable one (a `useMemo`, or a value derived
   * once per fetch) rather than a fresh literal each render.
   */
  edges?: readonly WfEdgeSpec[];
  /** Per-node visit budget for a cyclic graph, shown on cycle-closing edges.
   *  Meaningless without `edges` (an inferred spine cannot loop). */
  maxNodeVisits?: number;
  /** The node to ring as selected — e.g. the one whose detail panel is open.
   *  Selection is the host's state; the graph only reflects it. */
  selectedNodeId?: string;
  /** Click handler for a node (e.g. open a detail drawer). Absent ⇒ nodes are
   *  non-interactive on click. */
  onNodeClick?: (nodeId: string, data: WfNodeData) => void;
  /**
   * Editing gestures. Supplying `onEdgeConnect` turns the canvas from a diagram
   * into an EDITOR: node handles become visible and draggable, an edge can be
   * selected and removed with Delete/Backspace, and clicking one asks to edit
   * its guard. Omit all three — the default — and the graph stays the read-only
   * visualisation it has always been.
   *
   * Every callback speaks node ids (`actionNodeId`, `branchNodeId`), never
   * positions: this component reports the gesture, and turning it into a
   * definition edit is the host's job — it owns the YAML, and only it knows
   * what a `needs` row is. Fan-out and trigger edges never fire any of these
   * ({@link isEditableEdge}), because neither is a row in anyone's topology.
   *
   * The canvas holds no pending state: an accepted edit comes back as new
   * `yaml` + `edges`, and a rejected one simply never arrives.
   */
  onEdgeConnect?: (sourceId: string, targetId: string) => void;
  onEdgeDelete?: (sourceId: string, targetId: string) => void;
  onEdgeClick?: (sourceId: string, targetId: string) => void;
}

export function WorkflowGraph({
  yaml,
  variant = "full",
  direction = "LR",
  defaultCompact = true,
  className,
  nodeState,
  edges: declaredEdges,
  maxNodeVisits,
  selectedNodeId,
  onNodeClick,
  onEdgeConnect,
  onEdgeDelete,
  onEdgeClick,
}: WorkflowGraphProps) {
  // One gesture turns the canvas into an editor, so one prop decides it: a host
  // that cannot accept a new connection has no business showing a drag handle
  // for one. The other two callbacks refine an editor, they don't create one.
  const editable = onEdgeConnect !== undefined;
  const colorMode = useColorMode();
  const isPreview = variant === "preview";
  // The proposal-card preview is always compact (a small thumbnail); the full
  // variant defaults per prop and lets the user toggle density.
  const [userCompact, setUserCompact] = useState(defaultCompact);
  const compact = isPreview || userCompact;
  // What the nodes RENDER (content + handle anchors). Inside a layout tween it
  // TRAILS `compact` — the target density drives the layout and the camera at
  // once, while the rendered swap lands mid-motion (DENSITY_FLIP_AT); the
  // transition effect keeps the two in step on every non-tweened path.
  const [displayCompact, setDisplayCompact] = useState(compact);
  const rfRef = useRef<ReactFlowInstance<Node<WfNodeData>, WfFlowEdge> | null>(
    null,
  );
  // The canvas wrapper — measured when reframing, since the viewport math needs
  // the frame's real width/height and the RF instance doesn't expose them.
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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
        ...(declaredEdges ? { edges: declaredEdges } : {}),
      }),
    [yaml, hasRunOverlay, direction, compact, declaredEdges],
  );

  // Edges restyled from the current run state (colored by each edge's target
  // status; the active hop animates). Derived from the STABLE structural edges +
  // nodeState, so a poll/SSE tick repaints edge color/flow without touching node
  // layout. Neutral throughout the static definition/preview view (no nodeState).
  const styledEdges = useMemo<WfFlowEdge[]>(() => {
    const styled = buildStyledEdges(structural.edges, nodeState, maxNodeVisits);
    // `deletable` is React Flow's own gate on the Delete key. A read-only canvas
    // says so on the elements themselves rather than resting on `deleteKeyCode`
    // alone — the same stance nodes take, which are marked undeletable in both
    // modes. On an editable canvas only a declared edge may go: this keeps a
    // fork or trigger edge from ever reaching onEdgesDelete, belt to the
    // suspenders the handler wears anyway.
    return styled.map((e) => ({
      ...e,
      deletable: editable ? isEditableEdge(e) : false,
    }));
  }, [structural.edges, nodeState, maxNodeVisits, editable]);

  const [nodes, setNodes, onNodesChange] = useNodesState(structural.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(styledEdges);
  // Live mirrors for the layout transition below: the tween reads its STARTING
  // geometry from whatever is currently rendered (including a mid-flight tween
  // it is redirecting), and re-merges the current run state into every frame it
  // writes — without the transition effect re-firing on node/state ticks.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const nodeStateRef = useRef(nodeState);
  nodeStateRef.current = nodeState;

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

  // Move the graph to a NEW layout when the STRUCTURE changes (a definition
  // edit, orientation, the density toggle, a run-overlay transition). A
  // run-state tick doesn't change `structural`, so a live run is never yanked
  // around.
  //
  // For a same-node relayout with motion allowed — the density toggle — node
  // geometry and the camera tween TOGETHER through React Flow's store, so the
  // edges re-route against the moving nodes on every frame. (A CSS transform
  // transition can't give that: edge paths are computed from store positions,
  // so they would snap to the final layout while the nodes glided.) The node
  // CONTENT swaps at the start and its box morphs around it — the card clips
  // via overflow-hidden, so mid-tween content reads as a reveal, not a spill.
  //
  // Every other transition — a different node set, reduced motion, a hidden
  // canvas — lands ATOMICALLY: nodes and camera written in the same pass, never
  // a lingering frame of the new layout under the old camera.
  //
  // The end viewport is computed from the STRUCTURAL nodes' own geometry — the
  // layouter's authoritative position + size for exactly this layout — never
  // from `fitView`, which reads React Flow's MEASURED node boxes. Measurement
  // (a ResizeObserver) lags a relayout by a frame or more, so a fitView here
  // raced it and framed the OLD node sizes as often as the new ones.
  const didInitialSeedRef = useRef(false);
  useEffect(() => {
    // The run state is merged at WRITE time — read fresh from the ref inside
    // every setNodes this effect makes — so a status tick landing mid-tween is
    // carried by the very next frame instead of being stomped by a snapshot
    // taken when the tween started (and then stranded if no later tick comes).
    const withRunState = (nodes: Node<WfNodeData>[]) => {
      const state = nodeStateRef.current;
      if (!state) return nodes;
      return nodes.map((n) =>
        state[n.id] ? { ...n, data: { ...n.data, state: state[n.id] } } : n,
      );
    };
    // ReactFlow's `fitView` prop frames the initial render — the first pass
    // only seeds the nodes and leaves the viewport alone.
    if (!didInitialSeedRef.current) {
      didInitialSeedRef.current = true;
      setNodes(withRunState(structural.nodes));
      setDisplayCompact(compact);
      return;
    }
    const inst = rfRef.current;
    const frame = wrapperRef.current?.getBoundingClientRect();
    // A hidden canvas (display:none ancestor) has no frame to fit into.
    if (!inst || !frame || frame.width === 0 || frame.height === 0) {
      setNodes(withRunState(structural.nodes));
      setDisplayCompact(compact);
      return;
    }
    const endViewport = getViewportForBounds(
      getNodesBounds(structural.nodes),
      frame.width,
      frame.height,
      FIT_VIEW.minZoom,
      fitZoomCeiling(compact),
      FIT_VIEW.padding,
    );
    const prev = nodesRef.current;
    const prevById = new Map(prev.map((n) => [n.id, n]));
    const sameNodeSet =
      prev.length === structural.nodes.length &&
      structural.nodes.every((n) => prevById.has(n.id));
    if (
      !sameNodeSet ||
      !motionAllowed() ||
      typeof requestAnimationFrame === "undefined"
    ) {
      setNodes(withRunState(structural.nodes));
      setDisplayCompact(compact);
      inst.setViewport(endViewport);
      return;
    }
    // The rendered density lands mid-tween: growing flips early, shrinking
    // flips once the card has nearly collapsed (see DENSITY_FLIP_AT).
    const flipTimer = setTimeout(
      () => setDisplayCompact(compact),
      LAYOUT_TRANSITION_MS *
        (compact ? DENSITY_FLIP_AT.shrink : DENSITY_FLIP_AT.grow),
    );
    const startViewport = inst.getViewport();
    const startedAt = performance.now();
    let raf = requestAnimationFrame(function step(now: number) {
      const t = Math.min(1, (now - startedAt) / LAYOUT_TRANSITION_MS);
      const e = easeInOutCubic(t);
      setNodes(
        withRunState(
          t >= 1
            ? structural.nodes
            : structural.nodes.map((n) => {
                const p = prevById.get(n.id);
                if (!p || p.width === undefined || p.height === undefined) {
                  return n;
                }
                const width = lerp(p.width, n.width ?? p.width, e);
                const height = lerp(p.height, n.height ?? p.height, e);
                return {
                  ...n,
                  position: {
                    x: lerp(p.position.x, n.position.x, e),
                    y: lerp(p.position.y, n.position.y, e),
                  },
                  width,
                  height,
                  style: { ...n.style, width, height },
                };
              }),
        ),
      );
      inst.setViewport({
        x: lerp(startViewport.x, endViewport.x, e),
        y: lerp(startViewport.y, endViewport.y, e),
        zoom: lerp(startViewport.zoom, endViewport.zoom, e),
      });
      if (t < 1) raf = requestAnimationFrame(step);
    });
    // Cancelling un-schedules the next frame and the pending density flip.
    // When the layout changes again mid-flight, the replacing tween starts
    // from the CURRENT rendered geometry (nodesRef), so a rapid double-toggle
    // redirects smoothly instead of jumping to either end — and a bounce that
    // reverses before its flip fired never swaps the content at all.
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(flipTimer);
    };
  }, [structural, compact, setNodes]);

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node<WfNodeData>) => {
      onNodeClick?.(node.id, node.data);
    },
    [onNodeClick],
  );

  /**
   * Enter/Space on a focused node opens its detail, exactly as a click does.
   * React Flow makes a node TABBABLE but gives it no activation key of its own,
   * so a keyboard user could reach every node and open none of them — the
   * detail panel was mouse-only.
   *
   * The handler sits on the flow wrapper and reads the node id off the focused
   * element, because React Flow reports keys from the canvas rather than
   * per-node: `onNodeClick` has no keyboard counterpart to hang this on.
   */
  const handleNodeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!(event.target instanceof HTMLElement)) return;
      const nodeId = event.target
        .closest(".react-flow__node")
        ?.getAttribute("data-id");
      if (!nodeId) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      // Space scrolls the page by default, and Enter would otherwise also
      // reach whatever the node renders.
      event.preventDefault();
      onNodeClick?.(node.id, node.data);
    },
    [nodes, onNodeClick],
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
      <DensityContext.Provider value={displayCompact}>
      <SelectedNodeContext.Provider value={selectedNodeId}>
      <ConnectableContext.Provider value={editable}>
      <div ref={wrapperRef} className={`wf-graph ${className ?? ""}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        colorMode={colorMode}
        onInit={(inst) => {
          rfRef.current = inst;
        }}
        onNodeClick={onNodeClick ? handleNodeClick : undefined}
        // React Flow forwards unknown props onto its wrapper, so a keydown
        // from a focused node bubbles here.
        onKeyDown={onNodeClick ? handleNodeKeyDown : undefined}
        fitView
        fitViewOptions={{ ...FIT_VIEW, maxZoom: fitZoomCeiling(compact) }}
        proOptions={{ hideAttribution: true }}
        // Node dragging is reserved for the full editor; a preview stays
        // read-only so its layout can't be disturbed. Both variants pan + zoom so
        // a dense graph is explorable.
        nodesDraggable={!isPreview}
        nodesConnectable={editable}
        // Without editing callbacks the graph is a read-only run VISUALIZATION:
        // dragging (full variant) and pan/zoom aid exploration, but a node/edge
        // must never be deletable or reconnectable. With onNodesChange/
        // onEdgesChange wired (needed so React Flow can persist measured sizes),
        // the Delete/Backspace key would otherwise remove a selected node from
        // the view until the next re-seed.
        //
        // An EDITOR arms the delete key and lets edges take focus — but only for
        // edges, never nodes: a node is a `do` entry, and removing one is a list
        // edit the step list owns, not a canvas gesture. `edgesReconnectable`
        // stays off because dragging an existing edge's end is two edits at once
        // (a delete and an add) with no way to express a half-applied one.
        deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
        edgesReconnectable={false}
        elementsSelectable={!isPreview}
        edgesFocusable={editable}
        onConnect={
          editable
            ? (connection) => {
                if (connection.source && connection.target) {
                  onEdgeConnect(connection.source, connection.target);
                }
              }
            : undefined
        }
        onEdgesDelete={
          editable
            ? (deleted) => {
                for (const edge of deleted) {
                  if (isEditableEdge(edge)) {
                    onEdgeDelete?.(edge.source, edge.target);
                  }
                }
              }
            : undefined
        }
        onEdgeClick={
          editable
            ? (_event, edge) => {
                if (isEditableEdge(edge)) {
                  onEdgeClick?.(edge.source, edge.target);
                }
              }
            : undefined
        }
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
      </ConnectableContext.Provider>
      </SelectedNodeContext.Provider>
      </DensityContext.Provider>
    </DirectionContext.Provider>
  );
}
