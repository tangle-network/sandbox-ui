/**
 * The second layout pass: hand the graph `model.ts` built to ELK's layered
 * algorithm (the Eclipse Layout Kernel, via `elkjs`) and take back positions,
 * routed edges and the frames around parallel fan-outs.
 *
 * `model.ts` stays the source of every node, its size and its edges, and its
 * own layered layout stays the synchronous first answer. What it cannot do is
 * what a branching workflow needs: order the nodes in a layer to minimise
 * crossings, route a long edge around the cards it skips, return a loop around
 * the outside, and reserve room on each edge for its guard chip. ELK does all
 * four, so a graph with any of those gets this pass; a plain line keeps the
 * fold `model.ts` already draws well.
 *
 * `elkjs` is an OPTIONAL peer, imported at call time. A host without it, or a
 * layout that throws, gets `null` back and keeps the synchronous layout: the
 * graph is never lost to the better layouter being unavailable.
 */

import type {
  ELK,
  ElkExtendedEdge,
  ElkNode,
  ElkPoint,
  LayoutOptions,
} from "elkjs/lib/elk-api";
import {
  type FlowGraph,
  WF_EDGE_TYPE,
  type WfFlowEdge,
  type WfGroupFrame,
} from "./flow-graph";
import type { WfDirection } from "./model";
import { COMPACT_TILE, triggerNodeIndex } from "./model";

/** One ELK instance per page. `null` once loading failed, so a host without
 *  the peer pays for one failed import, not one per render. */
let elkInstance: Promise<ELK | null> | undefined;

function loadElk(): Promise<ELK | null> {
  elkInstance ??= import("elkjs/lib/elk.bundled.js")
    .then((mod) => {
      const Elk = (mod as { default: new () => ELK }).default;
      return new Elk();
    })
    .catch(() => null);
  return elkInstance;
}

/**
 * Whether the graph is worth the ELK pass: anything but a plain line. A line
 * has nothing to order or route, and `model.ts` folds a long one into rows
 * that read in order, which a layered layout would not improve.
 */
export function wantsElkLayout(graph: FlowGraph): boolean {
  if (graph.error || graph.nodes.length < 3) return false;
  const outdegree = new Map<string, number>();
  const indegree = new Map<string, number>();
  for (const e of graph.edges) {
    if (e.data?.whenLabel !== undefined || e.data?.backEdge) return true;
    outdegree.set(e.source, (outdegree.get(e.source) ?? 0) + 1);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  for (const n of outdegree.values()) if (n > 1) return true;
  for (const n of indegree.values()) if (n > 1) return true;
  return false;
}

/**
 * A join that runs when ANY of its inputs fails (`join: any_failed`) is a
 * failure handler, not a step in the flow: the factory's `failed` node is fed
 * by ten steps across every stage. Drawn as ten real edges it pulls the whole
 * layout toward one corner and buries the flow under lines that only matter
 * when something breaks. Its inputs are laid out and drawn as one caption on
 * the node instead; the node itself still lays out and opens like any other.
 */
export function isFailureSink(graph: FlowGraph, nodeId: string): boolean {
  const node = graph.nodes.find((n) => n.id === nodeId);
  // A handler that leads somewhere (`failed -> notify`) stays in the flow:
  // folded, it would have no inputs to place it by, and its successors would
  // be laid out ahead of the steps that can fail.
  return (
    node?.data.config?.join === "any_failed" &&
    !graph.edges.some((e) => e.source === nodeId)
  );
}

/** Options for {@link layoutWithElk}. */
export interface ElkLayoutOptions {
  /** Fold failure handlers' inputs into a caption (see {@link
   *  isFailureSink}). Off on an editing canvas, where those inputs are edges
   *  an author can select, delete or carry a problem on. Defaults to on. */
  foldFailureInputs?: boolean;
}

/**
 * ELK options for one flow direction. Every value here was chosen against the
 * shapes the catalogue ships (a 22-step factory with two loops and a ten-way
 * failure join, a four-lane review) rather than taken as defaults:
 *  - model order breaks ties, so a layer reads in the order the author wrote
 *    the steps unless reordering removes a crossing;
 *  - cycle breaking follows the same order, so the edge drawn as the loop's
 *    return is the one that points back up the definition, as the model's own
 *    back-edge classification marks it;
 *  - orthogonal routing keeps every edge on horizontal and vertical runs, and
 *    a guard chip sits on its edge's longest run (see the renderer). Chips are
 *    NOT given to ELK as label boxes: a label is laid out as a node of its own
 *    layer, which on the factory doubled the layer count and the width.
 */
export function elkLayoutOptions(
  direction: WfDirection,
  spacing: { rank: number; cross: number },
): LayoutOptions {
  return {
    "elk.algorithm": "layered",
    "elk.direction": direction === "LR" ? "RIGHT" : "DOWN",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.cycleBreaking.strategy": "MODEL_ORDER",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
    "elk.layered.feedbackEdges": "true",
    "elk.layered.spacing.nodeNodeBetweenLayers": String(
      Math.max(spacing.rank, 40),
    ),
    "elk.spacing.nodeNode": String(Math.max(spacing.cross, 20)),
    "elk.spacing.edgeNode": "14",
    "elk.spacing.edgeEdge": "10",
    "elk.layered.spacing.edgeNodeBetweenLayers": "14",
    "elk.layered.spacing.edgeEdgeBetweenLayers": "10",
    "elk.padding": "[top=0,left=0,bottom=0,right=0]",
    // One layout, not one per component: a failure sink whose inputs are
    // folded into a caption is a component of its own, and packed apart it
    // lands beside the trigger instead of after the flow.
    "elk.separateConnectedComponents": "false",
  };
}

/**
 * Cut a long layered graph into rows stacked toward `aspect` (width / height
 * of the canvas it is drawn in), so a fourteen-layer pipeline uses the
 * panel's height instead of shrinking to fit one strip. ELK picks the cuts
 * and routes the edges that cross them.
 */
function wrapOptions(aspect: number): LayoutOptions {
  return {
    "elk.aspectRatio": String(aspect),
    "elk.layered.wrapping.strategy": "MULTI_EDGE",
    "elk.layered.wrapping.additionalEdgeSpacing": "16",
    "elk.layered.wrapping.correctionFactor": "1.0",
  };
}

/** The graph in ELK's terms: every node at its authoritative size, and every
 *  edge except a failure sink's inputs. */
/**
 * Where a node's edges attach, relative to its box: the handle the card
 * draws. A compact node's box is much bigger than its tile (the name sits
 * under it), so routing to the box would stop every edge short of the tile it
 * points at. One port per side, at the handle, makes ELK route to exactly
 * where the card draws its connection point.
 */
function handleOffset(
  width: number,
  height: number,
  direction: WfDirection,
  compact: boolean,
): { inX: number; inY: number; outX: number; outY: number } {
  if (direction === "LR") {
    const y = compact ? COMPACT_TILE / 2 : height / 2;
    return { inX: 0, inY: y, outX: width, outY: y };
  }
  const x = compact ? COMPACT_TILE / 2 : width / 2;
  return { inX: x, inY: 0, outX: x, outY: height };
}

/** Fewer items than this stay a column of lanes; more become a grid. */
const GRID_MIN_ITEMS = 5;
const GRID_GAP = 16;

/** A settled foreach's items laid out as one grid, the way a CI matrix is:
 *  a column of fourteen tiles shrinks every node in the graph to fit, while a
 *  5 x 3 block reads at a glance. */
export interface ItemGrid {
  source: string;
  members: string[];
  targets: string[];
  cols: number;
  cellW: number;
  cellH: number;
  /** The block ELK places: the grid plus the frame's padding and caption. */
  width: number;
  height: number;
}

export function itemGrids(
  graph: FlowGraph,
  direction: WfDirection,
): ItemGrid[] {
  const grids: ItemGrid[] = [];
  for (const source of graph.nodes) {
    if (source.data.kind !== "foreach") continue;
    const prefix = `${source.id}-b`;
    const members = graph.nodes.filter(
      (n) => n.id.startsWith(prefix) && /^\d+$/.test(n.id.slice(prefix.length)),
    );
    if (members.length < GRID_MIN_ITEMS) continue;
    const ids = new Set(members.map((n) => n.id));
    const targets = [
      ...new Set(
        graph.edges
          .filter((e) => ids.has(e.source) && !ids.has(e.target))
          .map((e) => e.target),
      ),
    ];
    const cellW = Math.max(...members.map((n) => n.width ?? 0));
    const cellH = Math.max(...members.map((n) => n.height ?? 0));
    // Wider than tall across a landscape band. Down a portrait one, two
    // columns: a phone canvas holds two compact cards side by side at the
    // readable zoom floor, and a third pushes one off screen.
    const cols =
      direction === "LR" ? Math.ceil(Math.sqrt(members.length * 1.6)) : 2;
    const rows = Math.ceil(members.length / cols);
    grids.push({
      source: source.id,
      members: members.map((n) => n.id),
      targets,
      cols,
      cellW,
      cellH,
      width: cols * cellW + (cols - 1) * GRID_GAP + 2 * FRAME_PAD,
      height:
        rows * cellH + (rows - 1) * GRID_GAP + 2 * FRAME_PAD + FRAME_CAPTION,
    });
  }
  return grids;
}

const gridNodeId = (source: string) => `grid:${source}`;

export function toElkGraph(
  graph: FlowGraph,
  direction: WfDirection,
  wrapAspect?: number,
  compact = false,
  foldFailureInputs = true,
): ElkNode {
  const spacing = graph.spacing ?? { rank: 72, cross: 24 };
  const sinks = foldedSinks(graph, foldFailureInputs);
  const grids = itemGrids(graph, direction);
  const inGrid = new Set(grids.flatMap((g) => g.members));
  const isLR = direction === "LR";
  const nodeChild = (n: FlowGraph["nodes"][number]): ElkNode => {
      const width = n.width ?? 0;
      const height = n.height ?? 0;
      const at = handleOffset(width, height, direction, compact);
      return {
        id: n.id,
        width,
        height,
        layoutOptions: {
          "elk.portConstraints": "FIXED_POS",
          // With its inputs folded into a caption, a failure sink has no
          // edges to place it by; it goes last, where a reader looks for how
          // a run ends.
          ...(sinks.has(n.id)
            ? { "elk.layered.layering.layerConstraint": "LAST" }
            : {}),
        },
        ports: [
          { id: `${n.id}:in`, x: at.inX, y: at.inY, width: 0, height: 0 },
          { id: `${n.id}:out`, x: at.outX, y: at.outY, width: 0, height: 0 },
        ],
      };
  };
  const gridChild = (g: ItemGrid): ElkNode => ({
        id: gridNodeId(g.source),
        width: g.width,
        height: g.height,
        layoutOptions: { "elk.portConstraints": "FIXED_POS" },
        ports: [
          {
            id: `${gridNodeId(g.source)}:in`,
            x: isLR ? 0 : g.width / 2,
            y: isLR ? g.height / 2 : 0,
            width: 0,
            height: 0,
          },
          {
            id: `${gridNodeId(g.source)}:out`,
            x: isLR ? g.width : g.width / 2,
            y: isLR ? g.height / 2 : g.height,
            width: 0,
            height: 0,
          },
        ],
      });
  return {
    id: "root",
    layoutOptions: {
      ...elkLayoutOptions(direction, spacing),
      ...(wrapAspect !== undefined ? wrapOptions(wrapAspect) : {}),
    },
    // Model order drives cycle breaking, so a grid takes its first item's
    // place in it: listed ahead of its own foreach, the edge into it would
    // read as a loop back.
    children: graph.nodes.flatMap((n): ElkNode[] => {
      const grid = grids.find((g) => g.members[0] === n.id);
      if (grid) return [gridChild(grid)];
      if (inGrid.has(n.id)) return [];
      return [nodeChild(n)];
    }),
    edges: [
      ...graph.edges
        .filter(
          (e) =>
            !sinks.has(e.target) && !inGrid.has(e.source) && !inGrid.has(e.target),
        )
        .map(
          (e): ElkExtendedEdge => ({
            id: e.id,
            sources: [`${e.source}:out`],
            targets: [`${e.target}:in`],
          }),
        ),
      ...grids.flatMap((g): ElkExtendedEdge[] => [
        {
          id: `${gridNodeId(g.source)}:enter`,
          sources: [`${g.source}:out`],
          targets: [`${gridNodeId(g.source)}:in`],
        },
        ...g.targets.map((t) => ({
          id: `${gridNodeId(g.source)}:leave:${t}`,
          sources: [`${gridNodeId(g.source)}:out`],
          targets: [`${t}:in`],
        })),
      ]),
    ],
  };
}

/** The middle of a polyline's longest straight run: the one place on a routed
 *  edge with room for a chip, and distinct per edge even when several leave
 *  the same node together. */
export function longestRunMidpoint(points: readonly ElkPoint[]): {
  x: number;
  y: number;
} {
  let best = 0;
  let at = { x: points[0].x, y: points[0].y };
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > best) {
      best = len;
      at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return at;
}

/** Flatten an ELK edge's sections into one polyline. */
function edgePoints(edge: ElkExtendedEdge): ElkPoint[] {
  const points: ElkPoint[] = [];
  for (const section of edge.sections ?? []) {
    points.push(section.startPoint, ...(section.bendPoints ?? []), section.endPoint);
  }
  return points;
}

/**
 * Apply an ELK result to the graph: new positions, a route on every edge, and
 * frames around parallel fan-outs. Pure, so the mapping is checkable without
 * running ELK. Returns null when the result does not cover the graph (a node
 * ELK did not place), which the caller treats as "keep the first layout".
 */
/** The failure handlers whose inputs this layout folds. */
function foldedSinks(graph: FlowGraph, fold: boolean): Set<string> {
  if (!fold) return new Set();
  return new Set(
    graph.nodes.filter((n) => isFailureSink(graph, n.id)).map((n) => n.id),
  );
}

export function applyElkLayout(
  graph: FlowGraph,
  laid: ElkNode,
  direction: WfDirection,
  foldFailureInputs = true,
): FlowGraph | null {
  const placed = new Map<string, { x: number; y: number }>();
  for (const child of laid.children ?? []) {
    if (child.x === undefined || child.y === undefined) return null;
    placed.set(child.id, { x: child.x, y: child.y });
  }
  const grids = itemGrids(graph, direction);
  const gridFrames: WfGroupFrame[] = [];
  for (const g of grids) {
    const box = placed.get(gridNodeId(g.source));
    if (!box) return null;
    g.members.forEach((id, k) => {
      const col = k % g.cols;
      const row = Math.floor(k / g.cols);
      placed.set(id, {
        x: box.x + FRAME_PAD + col * (g.cellW + GRID_GAP),
        y: box.y + FRAME_PAD + FRAME_CAPTION + row * (g.cellH + GRID_GAP),
      });
    });
    const source = graph.nodes.find((n) => n.id === g.source);
    const concurrency = source?.data.config?.maxConcurrency;
    // A compact node's port sits on its box, which is wider than its tile;
    // the connector ends at the tile, as the renderer snaps every other edge.
    const tileInset =
      graph.compact && graph.direction === "LR"
        ? (n: { width?: number }) => ((n.width ?? 0) - COMPACT_TILE) / 2
        : () => 0;
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const connectors = (laid.edges ?? [])
      .filter((e) => e.id.startsWith(`${gridNodeId(g.source)}:`))
      .map((e) => {
        const points = edgePoints(e).map((p) => ({ x: p.x, y: p.y }));
        const from = nodeById.get(e.sources[0].replace(/:out$/, ""));
        const to = nodeById.get(e.targets[0].replace(/:in$/, ""));
        if (points.length >= 2 && from) points[0].x -= tileInset(from);
        if (points.length >= 2 && to) points[points.length - 1].x += tileInset(to);
        return { points };
      })
      .filter((c) => c.points.length >= 2);
    gridFrames.push({
      id: `frame:${gridNodeId(g.source)}`,
      x: box.x,
      y: box.y,
      width: g.width,
      height: g.height,
      lanes: g.members.length,
      agents: g.members.filter(
        (id) => graph.nodes.find((n) => n.id === id)?.data.kind === "agent.run",
      ).length,
      forEach: typeof concurrency === "number" ? { concurrency } : {},
      connectors,
    });
  }
  const inGrid = new Set(grids.flatMap((g) => g.members));
  if (graph.nodes.some((n) => !placed.has(n.id))) return null;

  const routed = new Map<string, ElkExtendedEdge>();
  for (const e of laid.edges ?? []) routed.set(e.id, e);

  const sinks = foldedSinks(graph, foldFailureInputs);
  const sinkInputs = new Map<string, number>();
  for (const e of graph.edges) {
    if (sinks.has(e.target)) {
      sinkInputs.set(e.target, (sinkInputs.get(e.target) ?? 0) + 1);
    }
  }
  const nodes = graph.nodes.map((n) => {
    const inputs = sinkInputs.get(n.id);
    return {
      ...n,
      position: placed.get(n.id) as { x: number; y: number },
      ...(inputs !== undefined
        ? {
            data: {
              ...n.data,
              subtitle: `If any of ${inputs} step${inputs === 1 ? "" : "s"} fails`,
            },
          }
        : {}),
    };
  });
  const edges = graph.edges.map((e): WfFlowEdge => {
    if (sinkInputs.has(e.target)) return { ...e, hidden: true };
    // A grid's items are reached through the frame's one connector in and
    // one out; a fork and a join line per item would bury the grid.
    if (inGrid.has(e.source) || inGrid.has(e.target)) {
      return { ...e, hidden: true };
    }
    const r = routed.get(e.id);
    const points = r ? edgePoints(r) : [];
    if (points.length < 2) return e;
    const from = placed.get(e.source) as { x: number; y: number };
    const to = placed.get(e.target) as { x: number; y: number };
    return {
      ...e,
      // A routed edge is drawn by the custom renderer, which is the one that
      // can follow a route.
      type: WF_EDGE_TYPE,
      data: {
        ...(e.data ?? { kind: "spine" }),
        route: {
          points: points.map((p) => ({ x: p.x, y: p.y })),
          label: longestRunMidpoint(points),
          from,
          to,
        },
      },
    };
  });
  const laidOut: FlowGraph = { ...graph, nodes, edges, engine: "elk" };
  const groups = [...gridFrames, ...parallelFrames(laidOut)];
  return groups.length > 0 ? { ...laidOut, groups } : laidOut;
}

/** Air between a frame and the cards inside it, and the band its caption sits
 *  in above them. */
const FRAME_PAD = 10;
const FRAME_CAPTION = 18;

/**
 * Frames around PARALLEL fan-outs: two or more steps that start together
 * because the same steps finished, over unguarded edges. A guarded fan-out is
 * a choice, not parallel work, and gets no frame — its edge chips already say
 * which way it goes. Each member is followed down its own lane (a single
 * unguarded successor that only it feeds) so a review-then-verify lane is
 * framed whole rather than just its first step.
 *
 * A frame that would enclose a card outside the fan-out is dropped: a frame
 * claiming an unrelated step is worse than no frame.
 */
export function parallelFrames(graph: FlowGraph): WfGroupFrame[] {
  // A sibling group's key is its sorted predecessor ids; a single one names
  // the step that fanned out.
  const incomingSource = (key: string) => (key.includes("|") ? null : key);
  const forward = graph.edges.filter((e) => !e.data?.backEdge && !e.hidden);
  const preds = new Map<string, WfFlowEdge[]>();
  const succs = new Map<string, WfFlowEdge[]>();
  for (const e of forward) {
    preds.set(e.target, [...(preds.get(e.target) ?? []), e]);
    succs.set(e.source, [...(succs.get(e.source) ?? []), e]);
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const siblings = new Map<string, string[]>();
  for (const n of graph.nodes) {
    if (triggerNodeIndex(n.id) !== null) continue;
    const incoming = preds.get(n.id) ?? [];
    if (incoming.length === 0) continue;
    if (incoming.some((e) => e.data?.whenLabel !== undefined)) continue;
    if (n.data.config && "if" in n.data.config) continue;
    const key = incoming
      .map((e) => e.source)
      .sort()
      .join("|");
    siblings.set(key, [...(siblings.get(key) ?? []), n.id]);
  }

  const frames: WfGroupFrame[] = [];
  for (const [key, members] of siblings) {
    if (members.length < 2) continue;
    const framed = new Set<string>();
    for (const start of members) {
      let at = start;
      framed.add(at);
      // Follow the lane while it stays a lane: one unguarded way on, into a
      // step only this lane feeds.
      for (let hop = 0; hop < graph.nodes.length; hop += 1) {
        const out = succs.get(at) ?? [];
        if (out.length !== 1 || out[0].data?.whenLabel !== undefined) break;
        const next = out[0].target;
        if ((preds.get(next) ?? []).length !== 1 || framed.has(next)) break;
        const config = byId.get(next)?.data.config;
        if (config && "if" in config) break;
        framed.add(next);
        at = next;
      }
    }
    const boxes = [...framed].map((id) => byId.get(id)).filter(Boolean);
    const x0 = Math.min(...boxes.map((n) => n!.position.x)) - FRAME_PAD;
    const y0 =
      Math.min(...boxes.map((n) => n!.position.y)) - FRAME_PAD - FRAME_CAPTION;
    const x1 =
      Math.max(...boxes.map((n) => n!.position.x + (n!.width ?? 0))) +
      FRAME_PAD;
    const y1 =
      Math.max(...boxes.map((n) => n!.position.y + (n!.height ?? 0))) +
      FRAME_PAD;
    const intrudes = graph.nodes.some((n) => {
      if (framed.has(n.id)) return false;
      const nx1 = n.position.x + (n.width ?? 0);
      const ny1 = n.position.y + (n.height ?? 0);
      return n.position.x < x1 && nx1 > x0 && n.position.y < y1 && ny1 > y0;
    });
    if (intrudes) continue;
    const source = incomingSource(key);
    const sourceNode = source ? byId.get(source) : undefined;
    const concurrency = sourceNode?.data.config?.maxConcurrency;
    frames.push({
      ...(sourceNode?.data.kind === "foreach"
        ? {
            forEach:
              typeof concurrency === "number" ? { concurrency } : {},
          }
        : {}),
      id: `frame:${key}`,
      x: x0,
      y: y0,
      width: x1 - x0,
      height: y1 - y0,
      lanes: members.length,
      agents: boxes.filter((n) => n!.data.kind === "agent.run").length,
    });
  }
  return frames;
}

/**
 * Lay the graph out with ELK. Resolves to null when ELK is unavailable or the
 * layout fails, and the caller keeps the synchronous layout.
 */
export async function layoutWithElk(
  graph: FlowGraph,
  direction: WfDirection,
  compact: boolean,
  canvasAspect = DEFAULT_CANVAS_ASPECT,
  options: ElkLayoutOptions = {},
): Promise<FlowGraph | null> {
  const fold = options.foldFailureInputs ?? true;
  const elk = await loadElk();
  if (!elk) return null;
  try {
    const plain = applyElkLayout(
      graph,
      await elk.layout(toElkGraph(graph, direction, undefined, compact, fold)),
      direction,
      fold,
    );
    if (!plain) return null;
    // Wrapping only ever helps a graph much wider than its canvas; a shape
    // that already fits keeps its single band, which reads in order.
    const plainAspect = boundsAspect(plain);
    if (
      direction !== "LR" ||
      laidOutNodeCount(graph) < WRAP_MIN_NODES ||
      plainAspect < canvasAspect * WRAP_WHEN_WIDER
    ) {
      return plain;
    }
    const wrapped = applyElkLayout(
      graph,
      await elk.layout(toElkGraph(graph, direction, canvasAspect, compact, fold)),
      direction,
      fold,
    );
    if (!wrapped) return plain;
    return fitScale(wrapped, canvasAspect) > fitScale(plain, canvasAspect)
      ? wrapped
      : plain;
  } catch {
    return null;
  }
}

/** The aspect a graph is framed in when the host says nothing: the workflow
 *  page's canvas, about 1100 x 480. */
const DEFAULT_CANVAS_ASPECT = 2.2;

/** How much wider than its canvas a single band must be before wrapping is
 *  tried. */
const WRAP_WHEN_WIDER = 1.6;

/** The nodes ELK places: a grid of items counts once. */
function laidOutNodeCount(graph: FlowGraph): number {
  const grids = itemGrids(graph, "LR");
  return (
    graph.nodes.length -
    grids.reduce((sum, g) => sum + g.members.length, 0) +
    grids.length
  );
}

/** Below this many nodes a graph reads better as one band: cut into rows, a
 *  six-step loop sends its edges across the row break for no gain in size. */
const WRAP_MIN_NODES = 12;

function bounds(graph: FlowGraph): { width: number; height: number } {
  const xs = graph.nodes.flatMap((n) => [n.position.x, n.position.x + (n.width ?? 0)]);
  const ys = graph.nodes.flatMap((n) => [n.position.y, n.position.y + (n.height ?? 0)]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function boundsAspect(graph: FlowGraph): number {
  const { width, height } = bounds(graph);
  return width / Math.max(height, 1);
}

/** The scale a graph fits a unit-height canvas of `aspect` at: bigger is a
 *  more readable graph. */
function fitScale(graph: FlowGraph, aspect: number): number {
  const { width, height } = bounds(graph);
  return Math.min(aspect / Math.max(width, 1), 1 / Math.max(height, 1));
}
