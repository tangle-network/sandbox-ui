/**
 * The converged assistant chat panel, built on sandbox-ui's chat primitives.
 * The reducer state is mapped to an AgentTimeline (transcript, tool chips,
 * reasoning preview, cost, proposal cards) and the composer is a ChatInput. App-
 * shell concerns — the signed-in user, navigation, the credit balance, money
 * formatting, and the workflow-graph renderer — are injected so the panel is
 * portable across hosts. Chat state is owned by the dock and passed in, so the
 * conversation survives the drawer closing.
 */

import { AgentTimeline, ChatInput } from "@tangle-network/ui/chat";
import { History, Minus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { assistantIsThinking, buildAssistantTimeline } from "./build-timeline";
import { isLowBalance, presentError } from "./presentation";
import { ProposalCard } from "./ProposalCard";
import type { AssistantTranscriptView } from "./types";
import type { AssistantChat } from "./useAssistantChat";
import { useAssistantModels } from "./useAssistantModels";
import { useAssistantThreads } from "./useAssistantThreads";
import { useFontScale } from "./usePanelPrefs";

export interface AssistantPanelProps {
  chat: AssistantChat;
  userId: string | null;
  onClose: () => void;
  /** Host navigation for error CTAs and connect targets. */
  navigate?: (path: string) => void;
  /** The user's credit balance, for the header tile + low-balance nudge. */
  balanceUsd?: number | null;
  /** Format a USD amount; defaults to Intl currency formatting. */
  formatMoney?: (usd: number | null) => string;
  /** Render workflow YAML as a node graph in a proposal card (the `./workflows`
   *  WorkflowGraph). When absent, proposals show YAML as text. */
  renderGraph?: (yaml: string) => ReactNode;
  /** Swap ONLY the conversation rendering for a host-supplied renderer (e.g. a
   *  different chat-message component), while the panel keeps owning the header,
   *  composer, model picker, history, transport, and proposal orchestration.
   *  Receives the transcript slice plus a bound proposal card to place. When
   *  absent, the built-in `AgentTimeline` renders the conversation. */
  renderTranscript?: (view: AssistantTranscriptView) => ReactNode;
}

const EMPTY_STATE =
  "Ask me to create a workflow, check your usage, or manage your API keys.";

function defaultFormatMoney(usd: number | null): string {
  if (usd == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(usd);
}

export function AssistantPanel({
  chat,
  userId,
  onClose,
  navigate,
  balanceUsd = null,
  formatMoney = defaultFormatMoney,
  renderGraph,
  renderTranscript,
}: AssistantPanelProps) {
  const models = useAssistantModels();
  const threads = useAssistantThreads(userId);
  const font = useFontScale();
  const [historyOpen, setHistoryOpen] = useState(false);

  const { state } = chat;
  // Always-current chat handle, so an async delete can re-check the LIVE thread
  // + status after awaiting (the closure's `chat`/`state` are render-time stale).
  const chatRef = useRef(chat);
  chatRef.current = chat;
  // Prefer the just-settled turn's balance (from the usage event, immediate)
  // over the injected fetched balance, which may lag a turn behind.
  const effectiveBalance = state.usage?.balanceUsd ?? balanceUsd;
  const errorView = state.error
    ? presentError(state.error.code, state.error.message)
    : null;
  const low = isLowBalance(effectiveBalance) && !errorView;
  const streaming = state.status === "streaming";

  const renderProposal = (proposal: (typeof state.pendingProposals)[number]) => (
    <ProposalCard
      proposal={proposal}
      confirming={
        proposal.proposalId ? chat.confirmingIds.has(proposal.proposalId) : false
      }
      onConfirm={() => chat.confirm(proposal)}
      onCancel={() => chat.cancel(proposal)}
      navigate={navigate}
      renderGraph={renderGraph}
    />
  );

  const isThinking = assistantIsThinking(state);

  const openHistory = () => {
    setHistoryOpen((v) => {
      const next = !v;
      if (next) threads.refresh();
      return next;
    });
  };

  // Delete a past conversation. Deleting the *active* thread is refused while it
  // is mid-turn (the stream is still writing to it). The list row drops
  // optimistically (in the hook), but the LIVE conversation is only reset once
  // the server confirms the delete — so a failed delete never strands the user
  // on a fresh thread while the server still has the conversation.
  const deleteThread = async (threadId: string) => {
    // Refuse deleting the active thread while it is mid-turn. Read LIVE status
    // through the ref (not the render-time `state`) so the guard is authoritative
    // regardless of when this closure was created or how long the confirm sat
    // open — never delete a thread the stream is still writing to.
    const pre = chatRef.current.state;
    if (pre.threadId === threadId && pre.status !== "idle") return;
    if (!window.confirm("Delete this conversation? This can't be undone.")) {
      return;
    }
    const res = await threads.remove(threadId);
    // Reset the live conversation only if the just-deleted thread is STILL the
    // active, idle one. Re-checked through the ref because the user may have
    // switched threads or started a turn while the delete was in flight —
    // resetting then would wipe a different or now-busy conversation.
    const live = chatRef.current.state;
    if (res.ok && live.threadId === threadId && live.status === "idle") {
      chatRef.current.reset();
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-border border-b px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-foreground text-sm">Assistant</span>
          <span
            aria-label="Your credit balance"
            className="text-muted-foreground text-xs"
          >
            {formatMoney(effectiveBalance)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center" role="group" aria-label="Text size">
            <button
              type="button"
              onClick={font.decrease}
              disabled={!font.canDecrease}
              aria-label="Decrease text size"
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={font.increase}
              disabled={!font.canIncrease}
              aria-label="Increase text size"
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={openHistory}
            aria-label="Chat history"
            aria-pressed={historyOpen}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={chat.reset}
            aria-label="New chat"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Model picker */}
      {models.models.length > 0 && (
        <div className="flex items-center gap-2 border-border border-b px-4 py-2">
          <label
            htmlFor="assistant-model"
            className="text-muted-foreground text-xs"
          >
            Model
          </label>
          <select
            id="assistant-model"
            value={chat.selectedModel ?? ""}
            onChange={(e) => chat.setModel(e.target.value || null)}
            className="rounded border border-border bg-card px-2 py-1 text-foreground text-xs"
          >
            <option value="">{models.default ?? "Default"}</option>
            {models.models.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* History switcher */}
      {historyOpen && (
        <div className="max-h-48 overflow-y-auto border-border border-b">
          {threads.threads.length === 0 ? (
            <p className="px-4 py-3 text-muted-foreground text-xs">
              {threads.loaded ? "No past conversations." : "Loading…"}
            </p>
          ) : (
            <ul>
              {threads.threads.map((t) => {
                const busyActive =
                  state.threadId === t.id && state.status !== "idle";
                return (
                  <li key={t.id} className="group flex items-center hover:bg-muted/50">
                    <button
                      type="button"
                      onClick={() => {
                        chat.switchThread(t.id);
                        setHistoryOpen(false);
                      }}
                      className="min-w-0 flex-1 truncate px-4 py-2 text-left text-foreground text-xs"
                    >
                      {t.title ?? "Untitled conversation"}
                    </button>
                    {threads.canRemove && (
                      <button
                        type="button"
                        onClick={() => void deleteThread(t.id)}
                        disabled={busyActive}
                        aria-label="Delete conversation"
                        title={
                          busyActive
                            ? "Can't delete while this conversation is active"
                            : "Delete conversation"
                        }
                        className="shrink-0 p-2 text-muted-foreground opacity-0 transition hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Conversation — host-swappable renderer, else the built-in timeline. */}
      <div
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
        style={{ fontSize: `${font.scale}rem` }}
      >
        {renderTranscript ? (
          renderTranscript({
            messages: state.messages,
            reasoning: state.reasoning,
            streamingId: state.streamingId,
            model: state.model,
            isStreaming: streaming,
            isThinking,
            pendingProposals: state.pendingProposals,
            usage: state.usage,
            renderProposal,
          })
        ) : (
          <AgentTimeline
            items={buildAssistantTimeline(state, renderProposal)}
            isThinking={isThinking}
            emptyState={
              <p className="px-4 py-8 text-center text-muted-foreground text-sm">
                {EMPTY_STATE}
              </p>
            }
          />
        )}
      </div>

      {/* Error / low-balance banners */}
      {errorView && (
        <div
          role="alert"
          className="mx-4 mb-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
        >
          <p className="text-foreground">{errorView.message}</p>
          {errorView.cta && (
            <button
              type="button"
              onClick={() => navigate?.(errorView.cta?.to ?? "")}
              className="mt-1 text-primary text-xs"
            >
              {errorView.cta.label} →
            </button>
          )}
        </div>
      )}
      {low && (
        <div
          role="status"
          className="mx-4 mb-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
        >
          <p className="text-foreground">Your credit balance is running low.</p>
          <button
            type="button"
            onClick={() => navigate?.("/app/billing")}
            className="mt-1 text-primary text-xs"
          >
            Add credits →
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-border border-t p-2">
        <ChatInput
          onSend={(message) => chat.send(message)}
          onCancel={chat.stop}
          isStreaming={streaming}
          disabled={chat.restoring || state.status === "awaiting_confirm"}
          placeholder="Message the assistant…"
          inputLabel={null}
          idleStatus={null}
          streamingStatus={null}
        />
      </div>
    </div>
  );
}
