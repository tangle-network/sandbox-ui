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
import { History, Minus, Plus, RotateCcw, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { assistantIsThinking, buildAssistantTimeline } from "./build-timeline";
import { isLowBalance, presentError } from "./presentation";
import { ProposalCard } from "./ProposalCard";
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
}: AssistantPanelProps) {
  const models = useAssistantModels();
  const threads = useAssistantThreads(userId);
  const font = useFontScale();
  const [historyOpen, setHistoryOpen] = useState(false);

  const { state } = chat;
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

  const items = buildAssistantTimeline(state, renderProposal);

  const openHistory = () => {
    setHistoryOpen((v) => {
      const next = !v;
      if (next) threads.refresh();
      return next;
    });
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
              {threads.threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      chat.switchThread(t.id);
                      setHistoryOpen(false);
                    }}
                    className="block w-full truncate px-4 py-2 text-left text-foreground text-xs hover:bg-muted/50"
                  >
                    {t.title ?? "Untitled conversation"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Conversation */}
      <div
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
        style={{ fontSize: `${font.scale}rem` }}
      >
        <AgentTimeline
          items={items}
          isThinking={assistantIsThinking(state)}
          emptyState={
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">
              {EMPTY_STATE}
            </p>
          }
        />
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
