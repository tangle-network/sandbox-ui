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
  type FinalConnectionState,
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
  type Rect,
  useEdgesState,
  useNodesState,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Maximize2, Minimize2, Plus, X } from "lucide-react";
import {
  createContext,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
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
  COMPACT_NODE_SIZE,
  COMPACT_TILE,
  ACTION_OUTPUT_ROWS,
  AGENT_BODY_ROWS,
  isStructuralKind,
  OUTPUT_PREVIEW_CHARS,
  STRUCTURAL_OUTPUT_ROWS,
  triggerNodeIndex,
  type WfDirection,
  type WfEdgeKind,
  type WfEdgeSpec,
  type WfNodeData,
  type WfNodeState,
  type WfNodeStatus,
  type WfProblem,
} from "./model";
import {
  buildFlowGraph,
  clearOfNodeBoxes,
  CLUSTER_HALF_SIZE,
  indexProblems,
  mergeRunState,
  type NodeBox,
  WF_EDGE_TYPE,
  type WfFlowEdge,
  worstSeverity,
} from "./flow-graph";
import { clampPreview, fmtCost, fmtDuration, fmtTokens } from "./format";
import { classifyOutput, NodeOutputBody } from "./node-output";
import { shortModel } from "./naming";
import {
  edgeColor,
  emptySlotLabel,
  NodeMark,
  problemBorder,
  ProblemMarker,
  ProblemMessages,
  PROBLEM_SURFACE,
  problemTitle,
  STATUS_COLOR,
  STATUS_LABEL,
  StatusFooter,
  StatusPill,
  statusBorder,
  TONE_ACCENT,
} from "./node-ui";

/** How much of the canvas a fit leaves as margin. React Flow reads a numeric
 *  padding as a scale factor, not a fraction — 0.16 fits the graph into 1/1.16
 *  of the frame. */
export const FIT_VIEW = { padding: 0.16 } as const;

/**
 * Zoom CEILING for a fit at the given density. Full cards at 1 are already
 * their designed size — zooming a two-node graph past that just blows the cards
 * up to fill the canvas. Compact tiles are small BY DESIGN, so fitting them
 * into the same canvas legitimately zooms past 1; capping them there strands a
 * short compact graph as specks in empty space.
 */
export function fitZoomCeiling(compact: boolean): number {
  return compact ? 1.5 : 1;
}

/**
 * Zoom FLOOR for a fit at the given density — the point below which the graph
 * stops shrinking to fit and becomes pannable instead.
 *
 * It depends on density for the same reason the ceiling does, because what a
 * floor BUYS depends on what the node is made of. A compact node is a logo: at
 * 0.55 the tile is still 42px and every step is recognisable at a glance, so
 * refusing to shrink past it keeps the graph worth looking at. An expanded card
 * is made of TEXT, and its text stops being readable around 0.75 — well before
 * any zoom that would fit a real pipeline. Holding those cards at the compact
 * floor therefore buys nothing legible and costs the right-hand column, which
 * gets sliced by the canvas edge. Letting them shrink shows the whole shape
 * instead, and reading one card is a click (or a zoom) away either way.
 */
export function fitZoomFloor(compact: boolean): number {
  return compact ? 0.55 : 0.35;
}

/**
 * The rectangle the LAID-OUT nodes occupy, in flow coordinates.
 *
 * Read straight off the layouter's own position + size rather than through
 * React Flow's `getNodesBounds`. Both of that helper's forms prefer a node's
 * MEASURED box — the standalone one falls back to it, and the `useReactFlow`
 * one resolves every node through the store's `nodeLookup`, which holds nothing
 * else — and measurement (a ResizeObserver) lags a relayout by a frame or more.
 * Framing a fresh layout through either therefore frames the PREVIOUS layout's
 * sizes as often as the new one, which is the same race that keeps `fitView`
 * out of the reframe below. Every structural node carries an explicit
 * width/height, and for exactly this layout that is the authority, so there is
 * nothing to measure and no lookup to consult.
 */
export function layoutBounds(nodes: readonly Node<WfNodeData>[]): Rect {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + (node.width ?? 0));
    maxY = Math.max(maxY, node.position.y + (node.height ?? 0));
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The camera that frames `bounds` inside a `width`×`height` canvas.
 *
 * Whenever the zoom FLOOR clamps the fit (see FIT_VIEW), the graph is
 * deliberately larger than the canvas — it is meant to be panned. React Flow
 * CENTERS what it cannot fit, which splits the overflow across both ends at
 * once: the trigger leaves the leading edge at the same moment the last step
 * leaves the trailing one, so the reader sees neither terminus and has nothing
 * to say which way the graph continues. Anchoring the leading edge instead puts
 * the entry point on screen and leaves every hidden step in ONE direction — the
 * direction the graph already reads in — so what is off-canvas is where panning
 * naturally goes.
 *
 * The anchor is the canvas edge, not the padding inset: padding is slack, and a
 * clamped fit is the case where there is none to give. It is also expressed as
 * a clamp rather than a branch on "does it fit" — a fit the floor did NOT clamp
 * is already centered with slack on both sides, so `max` returns it untouched,
 * and nothing here has to re-derive React Flow's own reading of `padding`.
 */
export function framingViewport(
  bounds: Rect,
  width: number,
  height: number,
  compact: boolean,
): Viewport {
  const fit = getViewportForBounds(
    bounds,
    width,
    height,
    fitZoomFloor(compact),
    fitZoomCeiling(compact),
    FIT_VIEW.padding,
  );
  /** Slide `offset` just far enough that the bounds' leading edge is on canvas. */
  const anchored = (offset: number, origin: number) =>
    offset + Math.max(0, -(offset + origin * fit.zoom));
  return {
    zoom: fit.zoom,
    x: anchored(fit.x, bounds.x),
    y: anchored(fit.y, bounds.y),
  };
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

/**
 * Whether the GRAPH is showing a run — read by the node so its card matches what
 * the layout reserved for it.
 *
 * `nodeHeight` reserves the run bands for every action the moment the graph has
 * any run state, because the layout is computed once and cannot revisit the
 * decision. A node the host has no entry for would otherwise render its
 * definition card — identity and nothing else — inside a box sized for a run,
 * leaving over a hundred pixels of void under it. A run's graph is in run mode
 * for all of its nodes, or none.
 */
export const RunModeContext = createContext<boolean>(false);

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
 * The AUTHORING problems anchored to each node, keyed by node id — read by the
 * node so its card can say it is the broken one.
 *
 * Delivered as CONTEXT rather than merged onto node data, unlike run state,
 * because the two arrive on different clocks. Run state ticks against a fixed
 * definition, so merging it into `data` costs nothing; a problem list changes
 * with the DRAFT, and merging it would put the problems into the memo the
 * layout is keyed on — relaying out the whole canvas on every keystroke of an
 * invalid draft.
 */
export const NodeProblemsContext = createContext<
  ReadonlyMap<string, readonly WfProblem[]>
>(new Map());

/** Removing the trigger this node stands for, when the host offers it. Null ⇒
 *  no control is drawn. A trigger is the one node with a delete gesture on the
 *  canvas: every other node is a `do` entry, whose removal is a list edit (see
 *  `deletable: false` in flow-graph.ts), while an `on:` entry has no list of its
 *  own to be edited in. */
export const TriggerDeleteContext = createContext<
  ((nodeId: string) => void) | null
>(null);

/** Inserting a step ON an edge, from the control the edge draws at its midpoint.
 *  Reaches the edge renderer as context because React Flow edge `data` is
 *  serialisable payload, not a place to hang a host callback. */
export const EdgeInsertContext = createContext<
  ((sourceId: string, targetId: string) => void) | null
>(null);

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

// Handles are positioned anchors for edges; we hide the dots so edges appear to
// connect to the node body for a clean diagram look.
const HANDLE_CLASS = "!h-2 !w-2 !min-w-0 !border-0 !bg-transparent opacity-0";

/** On an EDITABLE canvas the handle stops being a hidden anchor and becomes the
 *  thing you drag. Drawn as a small ring in the muted token so it reads as an
 *  affordance without competing with the node's own mark or status border.
 *
 *  `!z-10` is load-bearing, not styling: the handle straddles the node card's
 *  edge, and without it the card paints OVER the handle — every pointer event
 *  lands on the card, so a connection drag can never start. Verified with a
 *  live-browser hit-test (`elementFromPoint` returned the card at every pixel
 *  of the handle; the identical drag landed once the handle was raised).
 *  jsdom cannot catch a stacking regression, which is why the class is pinned
 *  by name in WorkflowNode.test.tsx. */
const HANDLE_CONNECTABLE_CLASS =
  "!z-10 !h-2.5 !w-2.5 !min-w-0 !rounded-full !border !border-border !bg-muted-foreground/70 opacity-100 transition-opacity hover:!bg-primary";

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

export function WorkflowNode({
  id,
  data,
  // Set only where the LAYOUT decides a node's own sides — a folded row that
  // runs right-to-left, or the step that turns the corner and leaves downward.
  // A straight layer flow leaves them to the direction, below.
  sourcePosition,
  targetPosition,
}: NodeProps<Node<WfNodeData>>) {
  const d = data;
  const state = d.state;
  const direction = useContext(DirectionContext);
  const compact = useContext(DensityContext);
  const runMode = useContext(RunModeContext);
  const connectable = useContext(ConnectableContext);
  const hostSelection = useContext(SelectedNodeContext);
  // What the DRAFT says is wrong with this step, and — for a trigger — the
  // host's offer to remove it. Both are authoring concerns: absent on every
  // read-only and run graph, where the contexts hold their defaults.
  const problems = useContext(NodeProblemsContext).get(id);
  const problemSeverity = worstSeverity(problems);
  const removeTrigger = useContext(TriggerDeleteContext);
  const isTrigger = triggerNodeIndex(id) !== null;
  // Compared only once the host HAS a selection: `undefined === undefined` would
  // otherwise ring a node whose id is also unset, so "nothing is selected" would
  // render as "this one is".
  const selected = hostSelection !== undefined && hostSelection === id;
  const isLR = direction === "LR";
  const targetPos = targetPosition ?? (isLR ? Position.Left : Position.Top);
  const sourcePos = sourcePosition ?? (isLR ? Position.Right : Position.Bottom);
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
  // Whether this card may render the bands a RUN adds — the output block, the
  // "nothing to report" line, and the status footer. It mirrors `nodeHeight`
  // (model.ts), which reserves those rows for an action but NOT for a trigger: a
  // trigger only fires, so it is spaced by its static height alone. Render a run
  // band on a trigger and it has nowhere to go — it overflows the box the layout
  // gave it. The two rules are one rule; keep them in step.
  //
  // Keyed on the GRAPH's mode rather than on this node's own state, for the same
  // reason: the reservation was made for every action the moment the graph had a
  // run, so a node the host sent no entry for is still a run card — one that has
  // simply not been reached. Keyed on `state` instead, it rendered its definition
  // card into a run-sized box and left the difference blank.
  const runBands = runMode && d.tone !== "trigger";
  // A node in a run graph that the host sent no entry for has not been reached.
  // `buildStyledEdges` already resolves it that way — the edge INTO such a node
  // is drawn in the queued neutral — so the card follows the same rule rather
  // than inventing a second one, and the card fills the box the run reserved.
  const runStatus: WfNodeStatus | undefined = runBands
    ? (state?.status ?? "queued")
    : state?.status;
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
    // Bounded so the LINE clamp is what decides how much shows, rather than the
    // text running out first: the character bound keeps an oversized payload out
    // of the DOM and nothing more.
    //
    // Flatten markdown ONLY for an agent's own answer, which is the thing that
    // reads as a word dump. An error (a stack trace, a diff, a shell glob) and a
    // non-agent node's output (an API response body) are not markdown, and
    // condensing them REWRITES them — see classifyOutput.
    const shape = classifyOutput(
      clampPreview(trimmed, OUTPUT_PREVIEW_CHARS),
      isAgent && source.tone !== "error",
    );
    return shape.kind === "empty"
      ? null
      : { shape, tone: source.tone, label: source.label };
  })();

  /**
   * Remove this trigger. Two escapes, because the control sits INSIDE a node and
   * both of the node's own gestures would otherwise fire with it: `nodrag nopan`
   * is React Flow's own opt-out, so pressing the button never starts a node drag
   * or a canvas pan, and the click is stopped from bubbling to the wrapper that
   * carries `onNodeClick` — removing a trigger must not also open it.
   */
  const triggerDeleteButton =
    isTrigger && removeTrigger ? (
      <button
        type="button"
        data-testid="wf-trigger-delete"
        title="Remove this trigger"
        aria-label="Remove this trigger"
        // 24x24 is the smallest target the accessibility guidance accepts, and
        // this one REMOVES a trigger — the costliest thing on the card to hit by
        // accident and the worst to miss. The visible ring stays 16px: the extra
        // 4px on each side is transparent padding, so the corner mark is no
        // bigger while the thing a finger has to land on is.
        className="nodrag nopan -m-1 flex h-6 w-6 shrink-0 items-center justify-center p-1 text-muted-foreground transition hover:text-[var(--surface-danger-text)]"
        onClick={(event) => {
          event.stopPropagation();
          removeTrigger(id);
        }}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card shadow-sm">
          <X size={10} aria-hidden />
        </span>
      </button>
    ) : null;

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
          data-testid="wf-node-card"
          className="relative flex items-center justify-center rounded-xl border bg-card shadow-sm transition-colors"
          style={{
            width: COMPACT_TILE,
            height: COMPACT_TILE,
            ...(state
              ? statusBorder(state.status)
              : problemSeverity
                ? problemBorder(problemSeverity)
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
          {/* The tile's corners carry the authoring marks: the problem on the
              leading one, the trigger's own remove control on the trailing one.
              The trailing corner is shared with the fan-out badge and the run
              dot, and neither can meet a trigger — only a `parallel` is badged,
              and a canvas offering the control is a definition being edited
              rather than a run. */}
          {problems && problemSeverity && (
            <ProblemMarker
              problems={problems}
              severity={problemSeverity}
              className="-left-1.5 -top-1.5 absolute"
            />
          )}
          {triggerDeleteButton && (
            <span className="-right-1.5 -top-1.5 absolute">
              {triggerDeleteButton}
            </span>
          )}
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
              {...(state.status === "running" ? { "data-motion": "essential" } : {})}
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

  // EXPANDED: the card's anatomy follows what the node IS, because a single
  // anatomy has to reserve for the worst case and every other node then pays for
  // it (see nodeHeight). An agent is answer-first; control flow is a chip; a
  // decision keeps its question; every other action gets a response well. Each
  // branch's bands must add up to what nodeHeight reserved for that kind — they
  // are one decision written twice, and model.test.ts asserts the per-kind
  // arithmetic so the build fails when they drift.
  const cardShell = (children: ReactNode) => (
    <div
      data-testid="wf-node-card"
      className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-colors"
      style={{
        ...(runStatus
          ? statusBorder(runStatus)
          : problemSeverity
            ? problemBorder(problemSeverity)
            : {
                borderColor: `color-mix(in srgb, ${accent} 40%, hsl(var(--border)))`,
              }),
        ...(selected ? SELECTION_OUTLINE : {}),
      }}
    >
      {handles}
      {children}
    </div>
  );

  // The identity row every card but the agent's keeps: a node you cannot name is
  // not a node.
  const identityRow = (
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
      {problems && problemSeverity && (
        <ProblemMarker problems={problems} severity={problemSeverity} />
      )}
      {runStatus ? (
        <StatusPill status={runStatus} />
      ) : (
        d.badge && (
          <span className="shrink-0 rounded-full border border-border bg-surface-container-high px-2 py-[1px] font-medium text-[10px] text-muted-foreground">
            {d.badge}
          </span>
        )
      )}
      {triggerDeleteButton}
    </div>
  );

  // The run's numbers move INTO the footer caption rather than costing a band of
  // their own. Dropping the metrics row is what pays for the answer body, and
  // the caption had room for the values already — so the card gets shorter
  // without the reader losing what the step spent.
  const footer = runStatus ? (
    <StatusFooter
      status={runStatus}
      rounds={isAgent ? state?.rounds : undefined}
      cost={cost}
      tokens={tokens}
      elapsed={duration}
    />
  ) : null;

  // The description, clamped to the two lines the layout reserves for it.
  const descriptionBand = (emphasized: boolean) =>
    d.description ? (
      <p
        className={`mt-2 line-clamp-2 shrink-0 text-[11px] leading-snug ${
          emphasized ? "text-foreground" : "text-muted-foreground"
        }`}
        title={d.description}
      >
        {d.description}
      </p>
    ) : null;

  // What a card says where its output WOULD be, when it has none — a step with
  // nothing to report SAYS so, rather than showing a void.
  const emptySlot =
    runStatus && !runOutput && emptySlotLabel(runStatus) ? (
      <div className="mt-2 flex flex-1 items-center text-[11px] text-muted-foreground italic">
        {emptySlotLabel(runStatus)}
      </div>
    ) : null;

  // The framed well: a caption over a clamped, content-aware body. For these
  // kinds the output is an ATTRIBUTE of the step rather than the point of it.
  // `grow shrink-0`, not `shrink-0`: the well FILLS the space its kind reserved
  // rather than hugging a one-line body and leaving an orphan gap above the
  // footer. Most outputs are far shorter than the reservation — the reservation
  // is sized for the worst case and cannot shrink to the actual one, since the
  // layout is fixed before any output exists — so a hugging well left the common
  // card looking half-finished. Growing costs nothing and reads as a panel.
  // `shrink-0` stays: a squeezed well would cut a line of text in half.
  const outputWell = (rows: number) =>
    runOutput ? (
      <div className="mt-2 min-h-0 grow shrink-0 rounded-lg border border-border bg-surface-container-high/60 px-2 py-1.5">
        <div className="mb-1 font-semibold text-[9px] text-muted-foreground uppercase tracking-[0.09em]">
          {runOutput.label}
        </div>
        <NodeOutputBody
          shape={runOutput.shape}
          tone={runOutput.tone}
          rows={rows}
        />
      </div>
    ) : (
      emptySlot
    );

  const body = (children: ReactNode, justify = "") => (
    /* The content region owns its overflow: each band is `shrink-0`, so a band
       that renders taller than its reservation (a consumer's font metrics) is
       CLIPPED here rather than squeezed — a squeezed band cuts a line of text
       in half, and pushes the pinned footer off the card. Fades in when the
       density swap lands mid layout-morph; the card's border/surface (the
       root) stays opaque so the node never blinks out. */
    <div
      className={`wf-node-body-in flex min-h-0 flex-1 flex-col overflow-hidden px-3.5 pt-2.5 pb-2 ${justify}`}
    >
      {children}
    </div>
  );

  // A definition card, and a trigger in any graph: what the step IS. There is no
  // run to report, so there are no run bands and no footer.
  if (!runBands) {
    return cardShell(body(
      <>
        {identityRow}
        {descriptionBand(false)}
      </>,
    ));
  }

  // A decision asks the reader a question and stops. The question is the card.
  //
  // Its identity STACKS rather than sharing one row, which every other kind can
  // afford to do. "Waiting on you" is the widest pill there is, and beside a
  // 34px mark it left about 120px of a 292px card for the title — so the one
  // node the reader has to act on truncated both the question it was asking
  // ("Approve the rele…") and the options it was offering. Dropping the pill to
  // sit with the options gives the question the card's full width, and costs
  // only the few pixels between a one-line header and a two-line one.
  //
  // The mark/title/subtitle markup below is deliberately NOT `identityRow`: that
  // one is a single row and this one stacks, so there is no shared shape to
  // factor out — only shared pieces. It does mean the two drift if one is
  // changed alone; keep them in step on mark sizing and title truncation.
  if (d.kind === "decision") {
    return cardShell(
      <>
        {body(
          <>
            <div className="flex shrink-0 items-start gap-2.5">
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
                <div className="mt-0.5 flex items-center gap-2">
                  {subtitle && (
                    <span
                      className="truncate text-[11px] text-muted-foreground leading-tight"
                      title={subtitle}
                    >
                      {subtitle}
                    </span>
                  )}
                  {runStatus && (
                    <span className="ml-auto shrink-0">
                      <StatusPill status={runStatus} />
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* A decision that FAILED shows why, in the band its question had.
                The question is moot once the run has stopped on an error —
                nobody is going to answer it — so the two never compete, and the
                error needs no reservation of its own. Its two clamped lines are
                the same two the description band already holds. */}
            {runOutput && runStatus === "failed" ? (
              <div className="mt-2 min-h-0 shrink-0">
                <NodeOutputBody
                  shape={runOutput.shape}
                  tone={runOutput.tone}
                  rows={2}
                />
              </div>
            ) : (
              descriptionBand(true)
            )}
          </>,
        )}
        {footer}
      </>,
    );
  }

  // Control flow routes the run. It books no cost and emits no output; a failure
  // is the only thing it ever has to say, and one line carries it.
  if (isStructuralKind(d.kind)) {
    return cardShell(
      <>
        {body(
          <>
            {identityRow}
            <div className="mt-1.5 min-h-0 shrink-0">
              {runOutput && (
                <NodeOutputBody
                  shape={runOutput.shape}
                  tone={runOutput.tone}
                  rows={STRUCTURAL_OUTPUT_ROWS}
                />
              )}
            </div>
          </>,
          // Centered, because the failure slot is empty on every run that does
          // NOT fail — which is most of them. Reserved space it cannot give back
          // (the layout is fixed before the run) reads as a gap under a
          // top-aligned row, and as breathing room around a centered one.
          "justify-center",
        )}
        {footer}
      </>,
    );
  }

  // An agent, answer-first: its output is not an attribute of the node, it is
  // what the node produced, so it IS the body — no caption, no well, and set in
  // the foreground rather than the muted token. Identity shrinks to a strip,
  // because once a node has answered, the answer identifies it better than its
  // label does.
  //
  // The strip still names the agent as well as the model. Dropping the name and
  // keeping only the model reads fine on one agent and fails on a fan-out: three
  // branches of the same model rendered three cards all labelled "deepseek-chat",
  // with nothing to tell them apart.
  //
  // And the body falls back to the PROMPT when there is no answer yet. Trading
  // the prompt away is only right once there is something to trade it for — a
  // queued branch that shows neither says nothing at all about what it will do.
  // Both share the one reserved body, so the fallback costs no height.
  if (isAgent) {
    const strip = [d.title, subtitle].filter(Boolean).join(" · ");
    return cardShell(
      <>
        {body(
          <>
            <div className="flex shrink-0 items-center gap-1.5">
              <NodeMark
                kind={d.kind}
                provider={d.provider}
                model={markModel}
                accent={accent}
                tile={18}
              />
              <span
                className="truncate font-medium text-[11px] text-muted-foreground"
                title={strip}
              >
                {strip}
              </span>
              <span className="flex-1" />
              {runStatus && <StatusPill status={runStatus} />}
            </div>
            <div className="mt-2 min-h-0 flex-1 text-foreground leading-snug">
              {runOutput ? (
                <NodeOutputBody
                  shape={runOutput.shape}
                  tone={runOutput.tone}
                  rows={AGENT_BODY_ROWS}
                />
              ) : runStatus &&
                runStatus !== "succeeded" &&
                runStatus !== "failed" &&
                d.description ? (
                // What it is ABOUT to do, in the muted token — the answer, when it
                // arrives, is the thing set in the foreground.
                //
                // Only while the node is still going to produce one. A FINISHED
                // node that produced nothing must say so: showing its prompt
                // there reads as the result it never returned.
                <p
                  className="line-clamp-5 text-[11px] text-muted-foreground leading-snug"
                  title={d.description}
                >
                  {d.description}
                </p>
              ) : (
                runStatus && (
                  <span className="text-muted-foreground italic">
                    {emptySlotLabel(runStatus)}
                  </span>
                )
              )}
            </div>
          </>,
        )}
        {footer}
      </>,
    );
  }

  // Every other action: what it is, then what came back.
  return cardShell(
    <>
      {body(
        <>
          {identityRow}
          {outputWell(ACTION_OUTPUT_ROWS)}
        </>,
      )}
      {footer}
    </>,
  );
}

/** Where a connection drag was let go, in viewport coordinates. A touch reports
 *  its position on `changedTouches` — `touches` is empty by the time the last
 *  finger lifts. Null when the event carries no position at all. */
function releasePoint(
  event: MouseEvent | TouchEvent | null | undefined,
): { x: number; y: number } | null {
  if (!event) return null;
  const touch = "changedTouches" in event ? event.changedTouches[0] : null;
  const source = touch ?? ("clientX" in event ? event : null);
  return source ? { x: source.clientX, y: source.clientY } : null;
}

/** The empty canvas itself: React Flow's pane, and the dot grid drawn on it.
 *  Everything else in the graph — a node, an edge, a label, the zoom controls,
 *  the panel — sits ABOVE the pane and is therefore not it. */
const CANVAS_SURFACE_SELECTOR = ".react-flow__pane, .react-flow__background";

/**
 * Whether a release at this point landed on the empty canvas.
 *
 * Identified POSITIVELY — the element under the pointer must BE the pane — and
 * not by listing what to exclude. A blacklist has to enumerate every layer that
 * can sit over the canvas (nodes, edges, edge labels, the controls, the panel,
 * whatever is added next), and each one it misses turns a release meant for that
 * element into a step nobody asked for. Asking "is this the pane" cannot miss
 * one, and it fails CLOSED: an environment with no hit-testing adds nothing
 * rather than adding something wrong.
 *
 * This also carries the frame check on its own, since a release off the graph
 * lands on the page rather than the pane.
 */
function releasedOnCanvas(at: { x: number; y: number }): boolean {
  const under =
    typeof document === "undefined" ? null : document.elementFromPoint(at.x, at.y);
  return under?.matches(CANVAS_SURFACE_SELECTOR) === true;
}

/**
 * The laid-out node boxes an edge's cluster has to keep clear of, in the same
 * flow coordinates the edge's own label point is expressed in.
 *
 * Taken from the LAYOUT rather than from React Flow's node store. The layout's
 * dimensions are authoritative — the card renders at exactly that box (see
 * `WfNode.height`) — so they need no measurement pass to become true, and they
 * change only when the layout does, which is precisely when a cluster needs to
 * be placed again. Reading the store instead would mean subscribing to a map
 * React Flow mutates in place, whose identity never changes and so never
 * notifies: the clearance would be computed once against unmeasured nodes and
 * then never revisited.
 */
export const NodeBoxesContext = createContext<readonly NodeBox[]>([]);

/** Chip styling shared by the guard summary and the cycle badge, so an edge's
 *  two possible annotations read as one pair rather than two designs. */
const EDGE_CHIP_CLASS =
  "rounded-full border border-border bg-card/90 px-1.5 py-[1px] text-[10px] leading-tight backdrop-blur";

/**
 * An edge with something to say: a guard summary, a cycle marker, an authoring
 * problem, or the insert control an EDITING canvas draws on it. An edge with
 * none of those stays on React Flow's built-in `smoothstep` renderer and is
 * unaffected by this component's existence.
 *
 * The guard chip is truncated with its full text on `title`: a summary is
 * usually a few words, but it is host-supplied and nothing bounds it, and an
 * unbounded label on an edge overlaps the nodes either side of it.
 */
export function WfEdgeRenderer({
  id,
  source,
  target,
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
  const insertStep = useContext(EdgeInsertContext);
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
  const problems = data?.problems;
  const problemSeverity = worstSeverity(problems);
  // Armed only when the edge was marked insertable AND a handler is in context:
  // the two are set together, and requiring both keeps a stale decoration from
  // drawing a button that does nothing.
  const offersInsert = data?.insertable === true && insertStep !== null;
  const nodeBoxes = useContext(NodeBoxesContext);
  const direction = useContext(DirectionContext);
  // A cluster is moved off a card when something in it TAKES THE POINTER — the
  // insert control, or a problem chip whose tooltip is the only place its
  // messages are written. Over a card, either one swallows clicks meant for the
  // node beneath it. A guard or cycle chip is pointer-transparent and reads
  // fine over a card, so a cluster carrying only those keeps its place rather
  // than scattering a dense graph's annotations off their own edges.
  const clearance =
    offersInsert || problemSeverity
      ? clearOfNodeBoxes(
          { x: labelX, y: labelY },
          nodeBoxes,
          direction,
          // A chip is far wider than the control, and in "TB" that width is what
          // has to clear the cards — so the cluster is measured by what it
          // actually carries rather than by its tallest member.
          problemSeverity ? CLUSTER_HALF_SIZE.chip : CLUSTER_HALF_SIZE.control,
        )
      : 0;
  // The clearance runs along the CROSS axis — the one the layers stack on.
  const isLR = direction === "LR";
  const clusterX = labelX + (isLR ? 0 : clearance);
  const clusterY = labelY + (isLR ? clearance : 0);
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {/* `nodrag nopan` so dragging a label pans nothing and drags nothing —
            the chips are readouts, not handles. They STACK rather than sit side
            by side: the corridor the layout reserves (EDGE_LABEL_LANE) is sized
            for one chip, and a guarded cycle carries two.

            `zIndex` is load-bearing, not styling. React Flow lays the label
            layer out BEFORE the node layer in tree order, and both sit at
            z-index auto/0 inside the viewport's stacking context — so a node
            paints over anything a label puts under it. An edge that spans more
            than ONE layer has its midpoint inside the layer it skips, i.e.
            squarely on a card: the reserved corridor only ever clears an
            adjacent-layer edge. That leaves the chip unreadable and, worse, the
            insert control unclickable. A positive z-index lifts this cluster
            past every node, since neither React Flow layer opens a stacking
            context of its own. Verified with a live-browser hit-test:
            `elementFromPoint` returned the intervening node's card at the
            control's own centre until this was set. */}
        <div
          className="nodrag nopan absolute flex flex-col items-center gap-0.5"
          style={{
            zIndex: 1,
            transform: `translate(-50%, -50%) translate(${clusterX}px, ${clusterY}px)`,
          }}
        >
          {problems && problemSeverity && (
            <span
              data-testid="wf-edge-problem"
              data-severity={problemSeverity}
              title={problemTitle(problems)}
              className={`${EDGE_CHIP_CLASS} pointer-events-auto max-w-40 truncate`}
              style={PROBLEM_SURFACE[problemSeverity]}
            >
              {/* The visible text is bounded by the corridor the chip sits in, so
                  a second problem collapses to a count. Every message still
                  reaches a reader who cannot hover, through the hidden text. */}
              <span aria-hidden>
                {problems.length === 1
                  ? problems[0].message
                  : `${problems.length} problems`}
              </span>
              <ProblemMessages problems={problems} />
            </span>
          )}
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
          {/* The label layer is `pointer-events: none` (React Flow's own CSS),
              so anything meant to be hovered or pressed has to opt back in —
              which is also what keeps the rest of the corridor pannable. */}
          {offersInsert && (
            <button
              type="button"
              data-testid="wf-edge-insert"
              title="Insert a step here"
              aria-label="Insert a step here"
              className="pointer-events-auto flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm backdrop-blur transition hover:border-primary hover:text-primary"
              // The label layer is a PORTAL, and a React synthetic event bubbles
              // through the component tree rather than the DOM one — so this
              // press reaches the edge wrapper that carries `onEdgeClick`, and
              // inserting a step would also ask to edit the edge's guard. The
              // chips beside it are readouts and let the click through on
              // purpose: pressing one IS pressing the edge.
              onClick={(event) => {
                event.stopPropagation();
                insertStep(source, target);
              }}
            >
              <Plus size={12} aria-hidden />
            </button>
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

/**
 * Fold the AUTHORING decorations onto already-styled edges: the problems
 * anchored to each one, and whether it offers the insert control. Both are drawn
 * by the custom renderer, so an edge that gains either is switched onto it —
 * everything else keeps the built-in `smoothstep` it has always had.
 *
 * A problem also RECOLOURS the edge, from the same table the node it points at
 * is tinted from, because a chip alone is unreadable at the zoom a whole
 * pipeline is viewed at — but only while the graph is NOT showing a run.
 * A run's colour is the more urgent reading of the same line and wins, exactly
 * as a node's run border wins over its problem border; the chip still renders,
 * so nothing is lost on the one edge that could carry both.
 *
 * `insertable` is a predicate rather than a flag so this pass never has to
 * re-derive which edges are the host's to change — {@link isEditableEdge}
 * already answers that for delete and guard.
 */
export function decorateAuthoringEdges(
  edges: WfFlowEdge[],
  byEdge: ReadonlyMap<string, readonly WfProblem[]>,
  insertable: (edge: WfFlowEdge) => boolean,
  hasRunOverlay: boolean,
): WfFlowEdge[] {
  if (byEdge.size === 0 && !edges.some(insertable)) return edges;
  return edges.map((e) => {
    const problems = byEdge.get(e.id);
    const severity = worstSeverity(problems);
    const offersInsert = insertable(e);
    if (!severity && !offersInsert) return e;
    const stroke =
      severity && !hasRunOverlay ? PROBLEM_SURFACE[severity].color : undefined;
    return {
      ...e,
      type: WF_EDGE_TYPE,
      data: {
        ...(e.data ?? { kind: "spine" as WfEdgeKind }),
        ...(problems ? { problems } : {}),
        ...(offersInsert ? { insertable: true } : {}),
      },
      ...(stroke
        ? {
            style: { ...e.style, stroke },
            markerEnd:
              e.markerEnd && typeof e.markerEnd === "object"
                ? { ...e.markerEnd, color: stroke }
                : e.markerEnd,
          }
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
  /**
   * Start collapsed (compact icon tiles) rather than expanded.
   *
   * Defaults to whether the graph has a RUN: a definition is read
   * structure-first, so it opens as tiles, while a run is read result-first and
   * opens as cards — the answers are the reason the reader opened it. Passing
   * the prop pins the density either way; the full variant still exposes the
   * toggle, and the preview variant is always compact.
   */
  defaultCompact?: boolean;
  /** Sizing for the wrapper; the caller controls height. */
  className?: string;
  /**
   * Fold a long single-file pipeline into rows instead of one unbounded line,
   * so it uses both axes of the panel rather than running off one edge. Only a
   * straight chain folds; anything with fan-out keeps its layered flow. "LR"
   * only. Defaults to `false`.
   */
  wrap?: boolean;
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
   * its guard. Omit it — the default — and the graph stays the read-only
   * visualisation it has always been.
   *
   * `onEdgeConnect` is the ONE prop that decides it. Every other editing
   * callback below (`onEdgeDelete`, `onEdgeClick`, `onEdgeInsert`,
   * `onNodeInsert`, `onTriggerAdd`, `onTriggerDelete`) refines an editor and is
   * inert without it — a canvas that cannot accept a new connection has no
   * business drawing an add control either.
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
  /**
   * Add a step ON an edge: the edge draws a "+" at its midpoint, and pressing it
   * reports the pair it sits between. The layout widens the corridor between
   * layers to hold the control, so arming this RELAYS OUT the graph — a compact
   * canvas pitches its layers at 20px, which is the whole button.
   *
   * Offered on exactly the edges the other three gestures are ({@link
   * isEditableEdge}): inserting on a fan-out or trigger edge would name a pair
   * that exists in no definition. "Add a step at the very start" is the
   * {@link onNodeInsert} drop instead — dragged from the first step's inbound
   * handle onto empty canvas, which names one node rather than a synthesized
   * edge. (A definition with no `on:` at all has no inbound handle on its first
   * step, because nothing points at it; there the step list is the only way in.)
   */
  onEdgeInsert?: (sourceId: string, targetId: string) => void;
  /**
   * Add a step at the loose end of a connection dragged from a node's handle and
   * released over empty canvas — the canvas's answer to "and then what?".
   * `side` is which handle it left from: `"after"` for the outbound one (the new
   * step follows `nodeId`), `"before"` for the inbound one (it precedes it).
   *
   * Reported for ANY node, including a trigger and a fan-out branch leaf: unlike
   * an edge gesture, this names a node that certainly exists, and whether a step
   * may go beside it is a question about the definition's schema — which this
   * library does not model and the host already answers.
   */
  onNodeInsert?: (nodeId: string, side: "before" | "after") => void;
  /**
   * The `on:` list gains an entry. Drawn as a canvas control rather than a
   * per-node one, because the workflow that most needs it is the one with NO
   * trigger — which has no trigger node to hang a "+" on.
   *
   * Offered whenever it is supplied, including on a definition that ALREADY has
   * a trigger: `on:` is a list with OR semantics, and a second subscription is a
   * normal thing to want. Whether THIS workflow may take another one is a
   * question about the definition's schema and the provider behind it, which
   * this library does not model — a host that must cap the list withholds the
   * callback.
   */
  onTriggerAdd?: () => void;
  /** Remove the `on:` entry a trigger node stands for — the one node deletion
   *  that IS a canvas gesture (every other node is a `do` entry, reordered and
   *  removed in the list the host owns). Read the entry's position back with
   *  `triggerNodeIndex`. */
  onTriggerDelete?: (nodeId: string) => void;
  /**
   * AUTHORING problems anchored to the nodes and edges that carry them, so a
   * compile error is visible on the canvas rather than only in a list beside it.
   * See {@link WfProblem} — and note it is a separate channel from `nodeState`,
   * which is what a node DID rather than what is wrong with what it says.
   *
   * A problem tints the node's border in either density, and states itself on a
   * mark in the card's identity row (a corner of the compact tile). A graph
   * showing a RUN is not an authoring surface — its cards and edges state the
   * run instead, which takes precedence over a problem's colour on both, and the
   * problem's mark and chip still render beside it.
   *
   * What the canvas gives is a LOCATOR: which step or dependency is at fault,
   * with the messages on the mark's `title` and in the accessibility tree. It is
   * deliberately not a reader for them — at the zoom a whole pipeline is viewed
   * at, a panel of message text on the canvas is unreadable, and the host
   * already owns the problem list that the messages are read and acted on in.
   *
   * Pairing contract: anchors are positional node ids, so a problem list must be
   * derived from the SAME definition passed as `yaml`. Hand over a list computed
   * against an older draft and an id that still exists may now name a different
   * step, which puts the diagnostic on an innocent one — the graph cannot tell
   * the two apart, any more than it can for a run's `nodeState`. A host that
   * validates asynchronously therefore holds each result against the text it was
   * computed from, and passes neither until they agree.
   *
   * Immutability contract, as for `edges`: the index is memoized on this array's
   * reference, so pass a stable one.
   */
  problems?: readonly WfProblem[];
}

export function WorkflowGraph({
  yaml,
  variant = "full",
  direction = "LR",
  defaultCompact,
  className,
  wrap = false,
  nodeState,
  edges: declaredEdges,
  maxNodeVisits,
  selectedNodeId,
  onNodeClick,
  onEdgeConnect,
  onEdgeDelete,
  onEdgeClick,
  onEdgeInsert,
  onNodeInsert,
  onTriggerAdd,
  onTriggerDelete,
  problems,
}: WorkflowGraphProps) {
  // One gesture turns the canvas into an editor, so one prop decides it: a host
  // that cannot accept a new connection has no business showing a drag handle
  // for one. Every other editing callback refines an editor, it doesn't create
  // one — hence the pairing below rather than each affordance arming itself.
  const editable = onEdgeConnect !== undefined;
  const insertOnEdge = editable ? onEdgeInsert : undefined;
  const insertArmed = insertOnEdge !== undefined;
  const insertAtNode = editable ? onNodeInsert : undefined;
  const addTrigger = editable ? onTriggerAdd : undefined;
  const deleteTrigger = editable ? onTriggerDelete : undefined;
  const colorMode = useColorMode();
  const isPreview = variant === "preview";
  // The proposal-card preview is always compact (a small thumbnail); the full
  // variant defaults per prop and lets the user toggle density.
  //
  // Unpinned, the density follows whether there is a RUN to read. A definition
  // is structure — the tiles are what make its shape legible at a glance, and
  // there are no results to show. A run is read for its results, and opening it
  // as tiles puts every answer behind a toggle the reader has to find first.
  // Read ONCE, as the initial state: flipping density on a later tick would
  // yank the canvas out from under someone who had chosen the other one.
  const [userCompact, setUserCompact] = useState(
    defaultCompact ?? nodeState === undefined,
  );
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
  // Whether the graph has been framed against a REAL canvas yet. Until it has,
  // the camera is still ours to set; afterwards it belongs to the reader, and
  // only a relayout moves it.
  const framedRef = useRef(false);
  // Bumped whenever framing might newly be possible — the instance arriving, or
  // the canvas being measured. Inert once the graph is framed.
  const [framingCue, setFramingCue] = useState(0);

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
        wrap,
        // The insert control lives IN the gap between two layers, so the gap is
        // reserved here — where the layout is decided — rather than measured
        // afterwards. It is the one editing prop that reaches the layout, which
        // is why arming it re-lays the graph out.
        reserveEdgeInsert: insertArmed,
        ...(declaredEdges ? { edges: declaredEdges } : {}),
      }),
    [
      yaml,
      hasRunOverlay,
      direction,
      compact,
      wrap,
      insertArmed,
      declaredEdges,
    ],
  );

  // The boxes a decorated edge's cluster must keep clear of. Derived from the
  // layout, so it is recomputed exactly when the layout moves and never carries
  // a position from a previous one.
  const nodeBoxes = useMemo<NodeBox[]>(
    () =>
      structural.nodes.map((node) => ({
        x: node.position.x,
        y: node.position.y,
        width: node.width ?? 0,
        height: node.height ?? 0,
      })),
    [structural],
  );

  // The problems, indexed by what they are anchored to. Keyed on the array's
  // identity (the documented contract), so a host that rebuilds the list only
  // when its validation settles re-indexes only then.
  const problemIndex = useMemo(() => indexProblems(problems), [problems]);

  // Edges restyled from the current run state (colored by each edge's target
  // status; the active hop animates). Derived from the STABLE structural edges +
  // nodeState, so a poll/SSE tick repaints edge color/flow without touching node
  // layout. Neutral throughout the static definition/preview view (no nodeState).
  const styledEdges = useMemo<WfFlowEdge[]>(() => {
    const run = buildStyledEdges(structural.edges, nodeState, maxNodeVisits);
    // The authoring pass runs AFTER the run styling, so a problem's colour wins
    // over the run colour on the one edge that could carry both.
    const styled = decorateAuthoringEdges(
      run,
      problemIndex.byEdge,
      (edge) => insertArmed && isEditableEdge(edge),
      hasRunOverlay,
    );
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
  }, [
    structural.edges,
    nodeState,
    maxNodeVisits,
    editable,
    problemIndex,
    insertArmed,
    hasRunOverlay,
  ]);

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
    // The instance only arrives an async tick after mount (React Flow defers
    // `onInit` past its own viewport setup), so the first pass has no camera to
    // move: it seeds the nodes and leaves framing to the effect below.
    if (!didInitialSeedRef.current) {
      didInitialSeedRef.current = true;
      setNodes(withRunState(structural.nodes));
      setDisplayCompact(compact);
      return;
    }
    const inst = rfRef.current;
    const frame = wrapperRef.current?.getBoundingClientRect();
    // A hidden canvas (display:none ancestor) has no frame to fit into. Leave
    // `framedRef` alone so the framing effect below takes the graph the moment
    // the canvas has a size.
    if (!inst || !frame || frame.width === 0 || frame.height === 0) {
      setNodes(withRunState(structural.nodes));
      setDisplayCompact(compact);
      return;
    }
    const endViewport = framingViewport(
      layoutBounds(structural.nodes),
      frame.width,
      frame.height,
      compact,
    );
    // This relayout IS the frame for the new structure — the effect below must
    // not also claim it once the canvas is measured.
    framedRef.current = true;
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

  /**
   * Own the INITIAL frame.
   *
   * React Flow's `fitView` prop paints a first approximation before anything
   * can be measured, and it fires exactly ONCE — the moment the nodes report a
   * size, against whatever width/height the pane happens to have then. A canvas
   * that is still 0×0 at that instant (a lazily-mounted chunk, a flex panel, a
   * tab that mounts hidden) is framed against nothing, and nothing ever refits
   * it. That fit also CENTERS a graph too big to fit, which is what pushed the
   * trigger off the leading edge (see framingViewport).
   *
   * So the prop stays as the pre-paint approximation — dropping it would flash
   * the graph at zoom 1 before this ran — and the real frame is taken here, as
   * soon as there is an instance and a canvas with a size. Once taken, the
   * camera is the reader's: later resizes are left alone rather than yanking
   * someone who has panned somewhere deliberately.
   */
  useEffect(() => {
    if (framedRef.current) return;
    const inst = rfRef.current;
    const frame = wrapperRef.current?.getBoundingClientRect();
    if (!inst || !frame || frame.width === 0 || frame.height === 0) return;
    inst.setViewport(
      framingViewport(
        layoutBounds(structural.nodes),
        frame.width,
        frame.height,
        compact,
      ),
    );
    framedRef.current = true;
  }, [framingCue, structural, compact]);

  // Re-attempt framing when a late-measured canvas finally has a size. Only
  // until the graph is framed — after that a resize is the reader's business,
  // and observing one would fight whatever they have panned to.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (framedRef.current) {
        observer.disconnect();
        return;
      }
      setFramingCue((cue) => cue + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node<WfNodeData>) => {
      onNodeClick?.(node.id, node.data);
    },
    [onNodeClick],
  );

  /**
   * A connection dragged from a handle and released over EMPTY CANVAS: the
   * "and then what?" gesture, reported as the node it left and which end of it.
   *
   * Three things have to be true, and each rules out a different non-gesture:
   *
   *  - Nothing was under the pointer (`toNode`/`toHandle`). React Flow ends
   *    EVERY connection drag through this callback, including one that landed on
   *    a handle and already went out through `onConnect`.
   *  - The release landed on the empty canvas — the PANE, positively identified.
   *    This is what rules out everything the first test does not: React Flow
   *    sets `toNode` only when a handle was found within its connection radius,
   *    so letting go in the middle of a wide card reports no target at all, and
   *    without this a release aimed at a node added a step instead. It rules out
   *    the same way a release on the zoom controls, on an edge, or right off the
   *    graph does — React Flow listens for the pointer-up on the document, so
   *    letting go anywhere on the page ends the drag, and pulling away from the
   *    canvas is exactly how a gesture is abandoned.
   *
   * The gesture also needs both of its own ends: a drag that reports no node or
   * no handle it started from names nothing to insert beside.
   */
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (!insertAtNode) return;
      if (state.toNode || state.toHandle) return;
      const from = state.fromNode;
      const fromHandle = state.fromHandle;
      if (!from || !fromHandle) return;
      const at = releasePoint(event);
      if (!at || !releasedOnCanvas(at)) return;
      insertAtNode(from.id, fromHandle.type === "target" ? "before" : "after");
    },
    [insertAtNode],
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
      // Read through the ref the tween already maintains, so this callback keeps
      // a stable identity (like its sibling handleNodeClick) instead of being
      // rebuilt on every run-state tick. An event fires after commit, so the ref
      // holds the nodes currently on screen — which is the set the press means.
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      // The key is CONSUMED here, so say so both ways: preventDefault stops
      // Space scrolling the page, and stopPropagation keeps a key we have
      // already acted on from also reaching the host around the graph (a form
      // that submits on Enter should not, when the user meant "open this node").
      // Both run only once a node is resolved — a press on canvas chrome, or on
      // nothing, is not ours to swallow.
      event.preventDefault();
      event.stopPropagation();
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
      <DensityContext.Provider value={displayCompact}>
      <RunModeContext.Provider value={hasRunOverlay}>
      <SelectedNodeContext.Provider value={selectedNodeId}>
      <ConnectableContext.Provider value={editable}>
      <NodeBoxesContext.Provider value={nodeBoxes}>
      <NodeProblemsContext.Provider value={problemIndex.byNode}>
      <TriggerDeleteContext.Provider value={deleteTrigger ?? null}>
      <EdgeInsertContext.Provider value={insertOnEdge ?? null}>
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
          // The camera only becomes ours to set once the instance exists, so
          // its arrival is what lets the framing effect take the real frame.
          // Guarded, so a host or a stub that hands us the instance more than
          // once re-renders nothing after the frame has been taken.
          if (!framedRef.current) setFramingCue((cue) => cue + 1);
        }}
        onNodeClick={onNodeClick ? handleNodeClick : undefined}
        // React Flow forwards unknown props onto its wrapper, so a keydown
        // from a focused node bubbles here.
        onKeyDown={onNodeClick ? handleNodeKeyDown : undefined}
        // A pre-paint approximation only — the authoritative frame is taken by
        // the framing effect once the canvas has been measured. Without it the
        // graph would paint once at zoom 1, top-left, before that lands.
        fitView
        fitViewOptions={{
          ...FIT_VIEW,
          minZoom: fitZoomFloor(compact),
          maxZoom: fitZoomCeiling(compact),
        }}
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
        onConnectEnd={insertAtNode ? handleConnectEnd : undefined}
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
            {/* Deliberately given no `fitViewOptions`, so its fit runs against
                the canvas `minZoom` (0.2) rather than FIT_VIEW's floor. The
                floor governs framing we do FOR the reader — never shrink a
                pipeline to specks unasked; asking for a fit outright is the one
                moment they have said the whole graph matters more than the size
                of it, and this button is that ask. */}
            <Controls showInteractive={false} position="bottom-right" />
            <Panel position="top-left" className="flex items-center gap-1">
              {addTrigger && (
                <button
                  type="button"
                  data-testid="wf-trigger-add"
                  onClick={addTrigger}
                  title="Add a trigger"
                  aria-label="Add a trigger"
                  className="flex items-center gap-1 rounded-md border border-border bg-card/80 px-2 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
                >
                  <Plus size={12} aria-hidden />
                  Trigger
                </button>
              )}
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
      </EdgeInsertContext.Provider>
      </TriggerDeleteContext.Provider>
      </NodeProblemsContext.Provider>
      </NodeBoxesContext.Provider>
      </ConnectableContext.Provider>
      </SelectedNodeContext.Provider>
      </RunModeContext.Provider>
      </DensityContext.Provider>
    </DirectionContext.Provider>
  );
}
