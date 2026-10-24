/**
 * What `AgentGraph` draws: an agent's card, the frame around a grid of leaf
 * workers, and the curved edge a message or delegation travels along.
 *
 * The visual vocabulary is the workflow graph's own (`node-ui.tsx`): the same
 * model brand mark, status colours, resting elevation and selection ring, so an
 * agent run and a workflow run read as one system.
 */

import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  Handle,
  type InternalNode,
  type Node,
  type NodeProps,
  Position,
  useInternalNode,
} from "@xyflow/react";
import {
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleQuestionMark,
  CircleStop,
  CircleX,
  Hourglass,
  LoaderCircle,
  type LucideIcon,
  Users,
} from "lucide-react";
import { MOTION_CONTROL } from "../lib/motion";
import type {
  AgentFrame,
  AgentGraphDirection,
  AgentGraphEdgeKind,
  AgentGraphNode,
  AgentGraphStatus,
} from "./agent-graph-layout";
import { SELECTION_OUTLINE } from "./canvas-theme";
import { fmtCost, fmtTokenTotal } from "./format";
import type { WfNodeStatus } from "./model";
import {
  KIND_ACCENT,
  NodeMark,
  RESTING_BORDER,
  RESTING_SHADOW,
  STATUS_COLOR,
  statusBorder,
} from "./node-ui";

const MUTED = "hsl(var(--muted-foreground))";

/** One word, one glyph and one colour per agent status — never colour alone.
 *  `flow` is the workflow status whose border, glow and edge colour it shares. */
export const AGENT_STATUS: Record<
  AgentGraphStatus,
  { label: string; icon: LucideIcon; color: string; flow: WfNodeStatus }
> = {
  running: { label: "Running", icon: LoaderCircle, color: STATUS_COLOR.running, flow: "running" },
  waiting: { label: "Waiting", icon: Hourglass, color: STATUS_COLOR.waiting, flow: "waiting" },
  succeeded: { label: "Done", icon: CircleCheck, color: STATUS_COLOR.succeeded, flow: "succeeded" },
  failed: { label: "Failed", icon: CircleX, color: STATUS_COLOR.failed, flow: "failed" },
  stopped: { label: "Stopped", icon: CircleStop, color: MUTED, flow: "succeeded" },
  idle: { label: "Idle", icon: CirclePause, color: MUTED, flow: "queued" },
  unknown: { label: "Unknown", icon: CircleQuestionMark, color: MUTED, flow: "queued" },
};

/** A status this table has no entry for (a newer host) reads as unknown, not as a crash. */
export function agentStatus(status: AgentGraphStatus) {
  return AGENT_STATUS[status] ?? AGENT_STATUS.unknown;
}

export function StatusGlyph({ status, size }: { status: AgentGraphStatus; size: number }) {
  const s = agentStatus(status);
  const Icon = s.icon;
  return (
    <Icon
      aria-hidden
      size={size}
      strokeWidth={2.25}
      className={status === "running" ? "shrink-0 motion-safe:animate-spin [animation-duration:1.6s]" : "shrink-0"}
      style={{ color: s.color }}
    />
  );
}

function cardBorder(status: AgentGraphStatus) {
  if (status === "unknown") return { borderColor: "hsl(var(--muted-foreground) / 0.45)", borderStyle: "dashed" as const };
  if (status === "idle") return { borderColor: "hsl(var(--border))" };
  if (status === "stopped") return { borderColor: RESTING_BORDER, boxShadow: RESTING_SHADOW };
  return statusBorder(agentStatus(status).flow);
}

/** The words a reader without the picture receives for one agent. */
export function agentSummary(agent: AgentGraphNode): string {
  const cost = fmtCost(agent.costUsd ?? undefined);
  const tokens = fmtTokenTotal(agent.tokens);
  return [
    agent.label,
    agent.role,
    agent.harness,
    agent.model,
    agentStatus(agent.status).label,
    agent.turn,
    cost,
    tokens,
  ]
    .filter(Boolean)
    .join(", ");
}

export type AgentCardNode = Node<
  { agent: AgentGraphNode; selected: boolean; direction: AgentGraphDirection },
  "agent"
>;

/** Set on each card's React Flow wrapper — the element that takes keyboard
 *  focus — so the card inside can draw the focus ring. */
export const AGENT_NODE_CLASS = "group/agent !outline-none";

const HANDLE_CLASS = "!h-1 !w-1 !min-w-0 !border-0 !bg-transparent opacity-0";

function Handles({ direction, source = true }: { direction: AgentGraphDirection; source?: boolean }) {
  return (
    <>
      <Handle
        type="target"
        position={direction === "LR" ? Position.Left : Position.Top}
        isConnectable={false}
        className={HANDLE_CLASS}
      />
      {source && (
        <Handle
          type="source"
          position={direction === "LR" ? Position.Right : Position.Bottom}
          isConnectable={false}
          className={HANDLE_CLASS}
        />
      )}
    </>
  );
}

export function AgentCard({ data }: NodeProps<AgentCardNode>) {
  const { agent, selected, direction } = data;
  const s = agentStatus(agent.status);
  const meta = [agent.role, agent.harness].filter(Boolean).join(" · ");
  const cost = fmtCost(agent.costUsd ?? undefined);
  const tokens = fmtTokenTotal(agent.tokens);
  return (
    <div
      data-status={agent.status}
      data-selected={selected || undefined}
      title={agentSummary(agent)}
      className={`relative flex h-full w-full cursor-pointer flex-col justify-between rounded-xl border bg-card px-3 pt-2.5 pb-2 text-left hover:-translate-y-px motion-reduce:hover:translate-y-0 after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:opacity-0 after:shadow-[0_10px_28px_-10px_hsl(var(--foreground)/0.45)] after:transition-opacity after:duration-150 after:ease-out hover:after:opacity-100 motion-reduce:after:transition-none group-focus-visible/agent:outline-2 group-focus-visible/agent:outline-offset-4 group-focus-visible/agent:outline-ring ${MOTION_CONTROL}`}
      style={{
        boxShadow: RESTING_SHADOW,
        ...cardBorder(agent.status),
        ...(selected ? SELECTION_OUTLINE : {}),
      }}
    >
      <Handles direction={direction} />
      <div className="flex min-w-0 items-center gap-2.5">
        <NodeMark kind="agent.run" model={agent.model ?? undefined} accent={KIND_ACCENT["agent.run"]} tile={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-[13px] text-foreground leading-[18px] tracking-[-0.01em]">
            {agent.label}
          </div>
          <div className="truncate text-[11px] text-muted-foreground leading-4">{meta || " "}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 self-start">
          <StatusGlyph status={agent.status} size={15} />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4">
        <span className="shrink-0 font-medium" style={{ color: s.color === MUTED ? undefined : s.color }}>
          {s.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {agent.turn ? agent.turn : ""}
        </span>
        {(cost ?? tokens) && (
          <span className="shrink-0 text-muted-foreground tabular-nums">{cost ?? tokens}</span>
        )}
      </div>
    </div>
  );
}

export type AgentFrameNode = Node<
  { frame: AgentFrame; statuses: readonly AgentGraphStatus[]; direction: AgentGraphDirection },
  "agentFrame"
>;

/** The statuses a grid caption counts: the ones a reader looks for. */
const CAPTION_STATUSES: readonly AgentGraphStatus[] = ["running", "waiting", "failed"];

export function AgentFrameBox({ data }: NodeProps<AgentFrameNode>) {
  const { frame, statuses, direction } = data;
  const counts = CAPTION_STATUSES.map((status) => ({
    status,
    n: statuses.filter((s) => s === status).length,
  })).filter((c) => c.n > 0);
  const words = [
    `${frame.group.memberIds.length} agents`,
    ...counts.map((c) => `${c.n} ${agentStatus(c.status).label.toLowerCase()}`),
  ].join(", ");
  return (
    <div
      className="relative h-full w-full rounded-2xl border"
      style={{
        background: "color-mix(in srgb, hsl(var(--muted-foreground)) 7%, transparent)",
        borderColor: "hsl(var(--foreground) / 0.08)",
      }}
    >
      <Handles direction={direction} source={false} />
      <div className="flex h-[26px] items-center gap-2.5 px-3 text-[11px] text-muted-foreground leading-4">
        <span className="sr-only">{words}</span>
        <span aria-hidden className="flex items-center gap-1.5 font-medium">
          <Users size={12} strokeWidth={2} />
          {frame.group.memberIds.length} agents
        </span>
        {counts.map((c) => (
          <span key={c.status} aria-hidden className="flex items-center gap-1 tabular-nums">
            <StatusGlyph status={c.status} size={11} />
            {c.n}
          </span>
        ))}
      </div>
    </div>
  );
}

export type AgentMessageEdge = Edge<
  { kind: Exclude<AgentGraphEdgeKind, "spawn">; count?: number; label?: string },
  "agentMessage"
>;

/** The secondary edges' colours: a message is quiet, a delegation is the
 *  primary accent's wash. Both stay well under a spawn edge's weight. */
export const MESSAGE_EDGE_COLOR: Record<Exclude<AgentGraphEdgeKind, "spawn">, string> = {
  message: "color-mix(in srgb, hsl(var(--muted-foreground)) 70%, transparent)",
  delegation: "color-mix(in srgb, hsl(var(--primary)) 75%, transparent)",
};

type Box = { x: number; y: number; w: number; h: number };

function boxOf(node: InternalNode): Box {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    w: node.measured.width ?? node.width ?? 0,
    h: node.measured.height ?? node.height ?? 0,
  };
}

/** Where the line from a box's centre toward `toward` leaves the box, `gap`px out. */
function exitPoint(b: Box, toward: { x: number; y: number }, gap: number) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: cx, y: cy };
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : b.w / 2 / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : b.h / 2 / Math.abs(dy),
  );
  return { x: cx + dx * scale + (dx / len) * gap, y: cy + dy * scale + (dy / len) * gap };
}

/**
 * A curve from one card's border to another's, bowed to the right of its
 * direction of travel: two agents messaging each other both ways draw two
 * separate arcs instead of one line over another, and a curve never hides
 * under the straight spawn edges of the tree.
 */
export function messageCurve(a: Box, b: Box) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(90, Math.max(24, len * 0.22));
  const control = { x: (ac.x + bc.x) / 2 - (dy / len) * bend, y: (ac.y + bc.y) / 2 + (dx / len) * bend };
  const start = exitPoint(a, control, 2);
  const end = exitPoint(b, control, 4);
  return {
    path: `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`,
    mid: {
      x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
      y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
    },
  };
}

export function AgentMessageEdgeView({ id, source, target, data, markerEnd }: EdgeProps<AgentMessageEdge>) {
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  if (!from || !to || !data) return null;
  const { path, mid } = messageCurve(boxOf(from), boxOf(to));
  const color = MESSAGE_EDGE_COLOR[data.kind] ?? MESSAGE_EDGE_COLOR.message;
  const count = data.count ?? 1;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={10}
        style={{ stroke: color, strokeWidth: 1.25, strokeDasharray: "4 4", fill: "none" }}
      />
      {count > 1 && (
        <EdgeLabelRenderer>
          <div
            title={data.label ? `${data.label} ×${count}` : `${count} ${data.kind}s`}
            className="nodrag nopan pointer-events-auto absolute rounded-full border bg-card px-1.5 font-medium text-[10px] text-muted-foreground tabular-nums leading-4 shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              borderColor: color,
            }}
          >
            ×{count}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
