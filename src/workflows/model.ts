/**
 * Turns a workflow YAML definition into a positioned node/edge graph for the
 * visualizer. Pure and React-Flow-agnostic so the parsing + layout is unit
 * testable on its own; the component maps these shapes onto React Flow nodes.
 *
 * The workflow model is a linear spine (trigger → action → action …) with
 * one-level fan-out: a `parallel` action has N leaf branches and a `foreach`
 * action has one leaf template. Branches dangle to the right of their structural
 * node on the spine; they never continue the chain (the schema forbids nesting),
 * so the spine stays a single readable column.
 */

import { parse as parseYaml } from "yaml";
import { providerLabel } from "../assistant/provider-label";

export type WfNodeTone = "trigger" | "structural" | "action";

export type WfNodeStatus = "queued" | "running" | "succeeded" | "failed";

/**
 * Live RUN state for one node, supplied by the host (keyed by node id) and
 * merged onto {@link WfNodeData.state} at render time. Absent ⇒ the graph shows
 * the static definition only (the assistant-proposal preview path). Driven from
 * a workflow run's per-action results so the graph animates as the run executes.
 */
export interface WfNodeState {
  status: WfNodeStatus;
  /** Amount booked for this action, USD. */
  costUsd?: number;
  /** Wall-clock the action took, ms. */
  durationMs?: number;
  /** Model the action actually used (may differ from the requested model). */
  model?: string;
  /** Failure message, when the node failed. */
  error?: string;
  /** Short preview of the action's output (or a failure's partial text). */
  outputPreview?: string;
  /** Input/output token usage, when known. */
  inputTokens?: number;
  outputTokens?: number;
}

// Extends Record<string, unknown> so it satisfies React Flow's node-data
// constraint — letting the graph use the typed `Node<WfNodeData>` /
// `NodeProps<Node<WfNodeData>>` generics instead of unsafe `as unknown as` casts.
export interface WfNodeData extends Record<string, unknown> {
  /** Headline for the node, e.g. "Run agent". */
  title: string;
  /** The action/trigger kind verbatim, e.g. "agent.run", "schedule". Always set
   *  so a card can label what it is regardless of which subtitle it shows. */
  kind: string;
  /** Secondary detail, e.g. an integration path or a cron expression. */
  subtitle?: string;
  /** Requested model (agent.run), shown as a chip even before a run. */
  model?: string;
  /** `integration.invoke` provider.method path. */
  path?: string;
  /** Notable config fields for the expand drawer (kept small + stringified). */
  detail?: Record<string, string>;
  /** Connector slug (e.g. `github`) for the provider chip, when one applies. */
  provider?: string;
  /** Small corner tag, e.g. "×3" for a parallel fan-out. */
  badge?: string;
  /** Whether this node fans out to branch leaves (renders a right handle). */
  hasBranches: boolean;
  /** Whether this node is the spine root (no incoming/target handle). */
  isRoot: boolean;
  tone: WfNodeTone;
  /** Live run state, merged in by the host at render time (never from YAML). */
  state?: WfNodeState;
}

export interface WfNode {
  id: string;
  position: { x: number; y: number };
  data: WfNodeData;
}

export interface WfEdge {
  id: string;
  source: string;
  target: string;
  /** "out" for spine edges (bottom handle), "branch" for fan-out (right). */
  sourceHandle: "out" | "branch";
}

export interface WfGraph {
  nodes: WfNode[];
  edges: WfEdge[];
  /** Set when the YAML couldn't be parsed into a renderable graph. */
  error: string | null;
}

// Layout constants (px). The spine runs down x=0; branches sit to the right.
const ROW_GAP = 112;
const BRANCH_X = 300;
const BRANCH_ROW_GAP = 84;
// Extra clearance below a branch stack so the next spine node (and its own
// branches) can't overlap a tall structural node's dangling leaves.
const BRANCH_STACK_PADDING = 40;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/** Host of an https URL for a compact `notify` subtitle; the raw value if it
 *  isn't a parseable URL (e.g. a `${...}` expression). */
function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Describe the single `do` leaf or top-level action as node data. The action
 *  object is a single-key map (`{ "integration.invoke": {...} }`), mirroring the
 *  YAML schema. */
/** Collect a small, stringified map of notable config for the expand drawer.
 *  Bounded to the named keys and short values so the drawer stays readable and
 *  the node data never carries an arbitrarily large payload. */
function pickDetail(
  cfg: Record<string, unknown>,
  keys: string[],
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = cfg[key];
    if (v === undefined || v === null) continue;
    const text =
      typeof v === "string"
        ? v
        : typeof v === "number" || typeof v === "boolean"
          ? String(v)
          : Array.isArray(v)
            ? `${v.length} item${v.length === 1 ? "" : "s"}`
            : "…";
    out[key] = text.length > 200 ? `${text.slice(0, 200)}…` : text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function describeAction(action: unknown): WfNodeData {
  const rec = asRecord(action);
  const [kind] = Object.keys(rec);
  const cfg = asRecord(rec[kind]);
  switch (kind) {
    case "sandbox.spawn":
      return {
        title: "Spawn sandbox",
        kind,
        subtitle: str(cfg.template),
        detail: pickDetail(cfg, ["template", "size", "region"]),
        hasBranches: false,
        isRoot: false,
        tone: "action",
      };
    case "integration.invoke": {
      const path = str(cfg.path);
      return {
        title: "Integration",
        kind,
        subtitle: path,
        path,
        provider: path?.split(".")[0],
        detail: pickDetail(cfg, ["path"]),
        hasBranches: false,
        isRoot: false,
        tone: "action",
      };
    }
    case "notify": {
      const url = str(cfg.url);
      return {
        title: "Notify",
        kind,
        subtitle: url ? urlHost(url) : undefined,
        detail: pickDetail(cfg, ["url"]),
        hasBranches: false,
        isRoot: false,
        tone: "action",
      };
    }
    case "agent.run":
      return {
        title: "Run agent",
        kind,
        subtitle: str(cfg.model) ?? str(cfg.profile) ?? str(cfg.prompt),
        model: str(cfg.model),
        detail: pickDetail(cfg, [
          "profile",
          "model",
          "maxRounds",
          "size",
          "prompt",
        ]),
        hasBranches: false,
        isRoot: false,
        tone: "action",
      };
    case "parallel": {
      const branches = Array.isArray(cfg.branches) ? cfg.branches : [];
      return {
        title: "Parallel",
        kind,
        subtitle: `${branches.length} branch${branches.length === 1 ? "" : "es"}`,
        badge: branches.length > 0 ? `×${branches.length}` : undefined,
        hasBranches: branches.length > 0,
        isRoot: false,
        tone: "structural",
      };
    }
    case "foreach":
      return {
        title: "For each",
        kind,
        subtitle: typeof cfg.items === "string" ? cfg.items : "list",
        detail: pickDetail(cfg, ["items"]),
        // Only fans out when a `do` template is actually present.
        hasBranches: Boolean(cfg.do),
        isRoot: false,
        tone: "structural",
      };
    default:
      return {
        title: kind ? kind : "Action",
        kind: kind ?? "action",
        hasBranches: false,
        isRoot: false,
        tone: "action",
      };
  }
}

/** Describe the `on:` trigger as the spine's root node. */
function describeTrigger(on: unknown): WfNodeData {
  const rec = asRecord(on);
  if (rec.provider_event) {
    const ev = asRecord(rec.provider_event);
    const connection = str(ev.connection);
    const event = str(ev.event);
    const actions = Array.isArray(ev.actions)
      ? ev.actions.filter((a): a is string => typeof a === "string")
      : [];
    const repo = str(ev.repo);
    let subtitle = connection ? providerLabel(connection) : "Event";
    if (event) subtitle += ` · ${event}`;
    if (actions.length > 0) subtitle += ` (${actions.join("/")})`;
    if (repo) subtitle += ` on ${repo}`;
    return {
      title: "Trigger",
      kind: "provider_event",
      subtitle,
      provider: connection,
      hasBranches: false,
      isRoot: true,
      tone: "trigger",
    };
  }
  if (rec.schedule) {
    const sch = asRecord(rec.schedule);
    const cron = str(sch.cron);
    const tz = str(sch.timezone);
    return {
      title: "Schedule",
      kind: "schedule",
      subtitle: cron ? (tz ? `${cron} (${tz})` : cron) : undefined,
      hasBranches: false,
      isRoot: true,
      tone: "trigger",
    };
  }
  return {
    title: "Trigger",
    kind: "trigger",
    hasBranches: false,
    isRoot: true,
    tone: "trigger",
  };
}

/** Build a positioned graph from a workflow YAML string. Never throws —
 *  malformed YAML or an empty definition returns an `error` the UI can fall
 *  back on (e.g. show the raw YAML while authoring). */
export function buildWorkflowGraph(yaml: string): WfGraph {
  if (!yaml || yaml.trim() === "") {
    return { nodes: [], edges: [], error: "No definition" };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(yaml);
  } catch {
    return { nodes: [], edges: [], error: "Invalid YAML" };
  }
  const def = asRecord(parsed);
  const actions = Array.isArray(def.do) ? def.do : [];
  if (!def.on && actions.length === 0) {
    return { nodes: [], edges: [], error: "Empty workflow" };
  }

  const nodes: WfNode[] = [];
  const edges: WfEdge[] = [];
  let y = 0;
  let prevId: string | null = null;

  const addEdge = (source: string, target: string, branch: boolean) => {
    edges.push({
      id: `${source}->${target}`,
      source,
      target,
      sourceHandle: branch ? "branch" : "out",
    });
  };

  if (def.on) {
    nodes.push({
      id: "trigger",
      position: { x: 0, y },
      data: describeTrigger(def.on),
    });
    prevId = "trigger";
    y += ROW_GAP;
  }

  actions.forEach((action, i) => {
    const id = `a${i}`;
    const data = describeAction(action);
    nodes.push({ id, position: { x: 0, y }, data });
    if (prevId) addEdge(prevId, id, false);
    prevId = id;

    // Fan-out leaves dangle to the right; the spine continues from the
    // structural node, not from the leaves.
    const rec = asRecord(action);
    const children: unknown[] =
      "parallel" in rec
        ? Array.isArray(asRecord(rec.parallel).branches)
          ? (asRecord(rec.parallel).branches as unknown[])
          : []
        : "foreach" in rec
          ? // A foreach with no `do` template has no child to render.
            [asRecord(rec.foreach).do].filter(Boolean)
          : [];

    if (children.length > 0) {
      let by = y;
      children.forEach((child, j) => {
        const cid = `${id}-b${j}`;
        nodes.push({
          id: cid,
          position: { x: BRANCH_X, y: by },
          data: describeAction(child),
        });
        addEdge(id, cid, true);
        by += BRANCH_ROW_GAP;
      });
      // Advance past the branch stack so the next spine node clears it.
      y += Math.max(
        ROW_GAP,
        children.length * BRANCH_ROW_GAP + BRANCH_STACK_PADDING,
      );
    } else {
      y += ROW_GAP;
    }
  });

  return { nodes, edges, error: null };
}
