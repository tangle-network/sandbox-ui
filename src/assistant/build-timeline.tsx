/**
 * Maps the assistant reducer state onto AgentTimeline items — the convergence
 * point with sandbox-ui's chat surface. The transcript (user/assistant bubbles,
 * tool-activity chips, status notes), the live reasoning preview, the per-turn
 * cost, and the pending proposal cards all become a single ordered item list the
 * AgentTimeline renders. Pure given its inputs (the proposal card is supplied by
 * the host via `renderProposal`), so the mapping is unit-testable.
 */

import type { ReactNode } from "react";
import type { AgentTimelineItem } from "@tangle-network/ui/chat";
import type { ToolCallData, ToolCallStatus } from "@tangle-network/ui/run";
import { describeToolActivity } from "./presentation";
import type { AssistantState } from "./reducer";
import type { ChatMessage, PendingProposal, ToolActivityStatus } from "./types";

const TOOL_STATUS: Record<ToolActivityStatus, ToolCallStatus> = {
  running: "running",
  ok: "success",
  failed: "error",
};

/**
 * True while a turn is streaming but the model hasn't emitted its first answer
 * token yet — drives AgentTimeline's ThinkingIndicator so a reasoning gap reads
 * as "thinking", not a frozen panel.
 */
export function assistantIsThinking(state: AssistantState): boolean {
  if (state.status !== "streaming") return false;
  const streaming = state.streamingId
    ? state.messages.find((m) => m.id === state.streamingId)
    : undefined;
  // Thinking until the open assistant bubble receives text (a tool_call closes
  // the bubble, so a running tool also reads as no-open-bubble = still working).
  return !streaming || streaming.text === "";
}

function formatUsd(usd: number): string {
  // Per-turn costs are fractions of a cent; show enough precision to be honest.
  return `$${usd.toFixed(usd < 0.01 ? 4 : 2)}`;
}

function messageItem(
  m: ChatMessage,
  streamingId: string | null,
): AgentTimelineItem | null {
  switch (m.role) {
    case "user":
      return { id: m.id, kind: "message", role: "user", content: m.text };
    case "assistant": {
      const isStreaming = m.id === streamingId;
      // Skip the empty open bubble while thinking — the indicator covers that
      // slot; an empty message item would render as a blank bubble.
      if (m.text === "" && isStreaming) return null;
      return {
        id: m.id,
        kind: "message",
        role: "assistant",
        content: m.text,
        isStreaming,
      };
    }
    case "status":
      return { id: m.id, kind: "status", label: m.text };
    case "tool": {
      const name = m.tool?.name ?? "tool";
      const status = TOOL_STATUS[m.tool?.status ?? "running"];
      const call: ToolCallData = {
        id: m.id,
        type: "unknown",
        label: describeToolActivity(name),
        status,
        // The tool message's text carries the error text on failure.
        detail: status === "error" && m.text ? m.text : undefined,
      };
      return { id: m.id, kind: "tool", call };
    }
  }
}

export function buildAssistantTimeline(
  state: AssistantState,
  renderProposal: (proposal: PendingProposal) => ReactNode,
): AgentTimelineItem[] {
  const items: AgentTimelineItem[] = [];

  for (const m of state.messages) {
    const item = messageItem(m, state.streamingId);
    if (item) items.push(item);
  }

  // Reasoning preview — dim, only while the answer is still pending.
  if (assistantIsThinking(state) && state.reasoning) {
    items.push({
      id: "reasoning",
      kind: "custom",
      content: (
        <p className="whitespace-pre-wrap px-1 text-muted-foreground text-xs italic">
          {state.reasoning}
        </p>
      ),
    });
  }

  // Per-turn cost, shown once a turn settles.
  if (
    state.status !== "streaming" &&
    state.usage &&
    state.usage.costUsd != null
  ) {
    items.push({
      id: "usage",
      kind: "status",
      label: state.usage.replayed
        ? "Replayed from a previous turn — no charge."
        : `This turn cost ${formatUsd(state.usage.costUsd)}.`,
    });
  }

  // Pending proposal cards (mutating actions awaiting confirmation). The host
  // owns the rich card (YAML/graph preview + connect affordances).
  for (const p of state.pendingProposals) {
    items.push({
      id: `proposal-${p.callId}`,
      kind: "custom",
      content: renderProposal(p),
    });
  }

  return items;
}
