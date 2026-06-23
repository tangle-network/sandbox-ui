import { describe, expect, it } from "vitest";
import { assistantIsThinking, buildAssistantTimeline } from "./build-timeline";
import { type AssistantState, initialAssistantState } from "./reducer";
import type { ChatMessage, PendingProposal } from "./types";

function state(over: Partial<AssistantState>): AssistantState {
  return { ...initialAssistantState(), ...over };
}

const PROPOSAL_NODE = "PROPOSAL";
const renderProposal = (p: PendingProposal) => `${PROPOSAL_NODE}:${p.callId}`;

describe("buildAssistantTimeline", () => {
  it("maps user and assistant messages to message items in order", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", text: "hi" },
      { id: "a1", role: "assistant", text: "hello" },
    ];
    const items = buildAssistantTimeline(state({ messages }), renderProposal);
    expect(items).toEqual([
      { id: "u1", kind: "message", role: "user", content: "hi" },
      {
        id: "a1",
        kind: "message",
        role: "assistant",
        content: "hello",
        isStreaming: false,
      },
    ]);
  });

  it("maps a tool chip to a tool item with mapped status and a human label", () => {
    const messages: ChatMessage[] = [
      {
        id: "tool-c1",
        role: "tool",
        text: "",
        tool: { name: "validate_workflow", status: "ok" },
      },
    ];
    const [item] = buildAssistantTimeline(state({ messages }), renderProposal);
    expect(item.kind).toBe("tool");
    if (item.kind !== "tool") return;
    expect(item.call.status).toBe("success");
    expect(item.call.type).toBe("unknown");
    expect(item.call.label.length).toBeGreaterThan(0);
  });

  it("carries the error text as detail on a failed tool", () => {
    const messages: ChatMessage[] = [
      {
        id: "tool-c1",
        role: "tool",
        text: "boom",
        tool: { name: "run_workflow", status: "failed" },
      },
    ];
    const [item] = buildAssistantTimeline(state({ messages }), renderProposal);
    if (item.kind !== "tool") throw new Error("expected tool item");
    expect(item.call.status).toBe("error");
    expect(item.call.detail).toBe("boom");
  });

  it("maps a status note to a status item", () => {
    const messages: ChatMessage[] = [
      { id: "s1", role: "status", text: "Action cancelled." },
    ];
    const [item] = buildAssistantTimeline(state({ messages }), renderProposal);
    expect(item).toEqual({
      id: "s1",
      kind: "status",
      label: "Action cancelled.",
    });
  });

  it("skips the empty open assistant bubble and reports thinking", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", text: "hi" },
      { id: "a1", role: "assistant", text: "" },
    ];
    const s = state({ messages, status: "streaming", streamingId: "a1" });
    const items = buildAssistantTimeline(s, renderProposal);
    expect(items.map((i) => i.id)).toEqual(["u1"]); // empty bubble dropped
    expect(assistantIsThinking(s)).toBe(true);
  });

  it("shows the reasoning preview only while the answer is pending", () => {
    const s = state({
      messages: [
        { id: "u1", role: "user", text: "hi" },
        { id: "a1", role: "assistant", text: "" },
      ],
      status: "streaming",
      streamingId: "a1",
      reasoning: "Let me think about this…",
    });
    const items = buildAssistantTimeline(s, renderProposal);
    expect(items.some((i) => i.id === "reasoning" && i.kind === "custom")).toBe(
      true,
    );
    // Once the answer streams, the reasoning preview drops away.
    const answered = buildAssistantTimeline(
      { ...s, messages: [{ id: "a1", role: "assistant", text: "done" }] },
      renderProposal,
    );
    expect(answered.some((i) => i.id === "reasoning")).toBe(false);
  });

  it("appends the per-turn cost once the turn settles", () => {
    const s = state({
      messages: [{ id: "a1", role: "assistant", text: "done" }],
      status: "idle",
      usage: { costUsd: 0.0049, balanceUsd: 5, promptTokens: null, completionTokens: null, durationMs: null, replayed: false },
    });
    const cost = buildAssistantTimeline(s, renderProposal).find(
      (i) => i.id === "usage",
    );
    expect(cost?.kind).toBe("status");
    if (cost?.kind === "status") expect(cost.label).toContain("$0.0049");
  });

  it("renders pending proposals via the injected renderer", () => {
    const proposal: PendingProposal = {
      proposalId: "p1",
      callId: "c1",
      name: "create_workflow",
      args: {},
    };
    const items = buildAssistantTimeline(
      state({ pendingProposals: [proposal], status: "awaiting_confirm" }),
      renderProposal,
    );
    const card = items.find((i) => i.id === "proposal-c1");
    expect(card?.kind).toBe("custom");
    if (card?.kind === "custom") expect(card.content).toBe("PROPOSAL:c1");
  });
});
