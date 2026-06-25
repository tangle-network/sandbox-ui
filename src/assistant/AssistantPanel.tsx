/**
 * The converged assistant chat panel, built on sandbox-ui's chat primitives.
 * The reducer state is mapped to an AgentTimeline (transcript, tool chips,
 * reasoning preview, cost, proposal cards) and the composer is a ChatInput. App-
 * shell concerns — the signed-in user, navigation, the credit balance, money
 * formatting, and the workflow-graph renderer — are injected so the panel is
 * portable across hosts. Chat state is owned by the dock and passed in, so the
 * conversation survives the drawer closing.
 */

import { AgentTimeline, ChatInput, ThinkingIndicator } from "@tangle-network/ui/chat";
import { History, MessageSquarePlus, Minus, Plus, Trash2, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type ModelInfo, ModelPicker } from "../dashboard/model-picker";
import { assistantIsThinking, buildAssistantTimeline } from "./build-timeline";
import type { AssistantModels } from "./client";
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

/**
 * Map the assistant catalog onto the shared ModelPicker's wire shape. The slug
 * is already a canonical, provider-prefixed id, so it doubles as the picker's
 * value.
 *
 * Both the server `default` and the currently-`selected` slug are guaranteed a
 * row even when the catalog omits them (each appended only when not already
 * listed, so no duplicate is produced). Keeping the active selection visible is
 * what lets the picker show exactly what the next turn will send without the
 * panel ever rewriting the user's choice to avoid an orphaned value — a stale
 * slug (e.g. a model retired between refetches, or one missing from a filtered
 * catalog) stays selectable until the user changes it or the server rejects it,
 * which is when `useAssistantChat` clears it.
 *
 * An absent context window is omitted rather than passed as `undefined`; pricing
 * is omitted entirely because the catalog carries only a prompt price, which the
 * picker's "prompt / completion" line would misreport as a free completion.
 */
export function toPickerModels(
  models: AssistantModels,
  selected: string | null,
): ModelInfo[] {
  const mapped: ModelInfo[] = models.models.map((m) => ({
    id: m.slug,
    name: m.label,
    ...(m.contextTokens != null ? { context_length: m.contextTokens } : {}),
  }));
  for (const slug of [models.default, selected]) {
    if (slug && !mapped.some((m) => m.id === slug)) {
      mapped.push({ id: slug, name: slug });
    }
  }
  return mapped;
}

/**
 * The chat-state value to store for a model id chosen in the picker. Picking the
 * server default clears the preference to `null` — preserving the native-select
 * contract where "default" means "omit the model and follow whatever the server
 * default is", rather than pinning the default's slug (which would freeze the
 * user to it even after the server default changes). Any other id is stored as-is.
 */
export function nextModelSelection(
  id: string,
  defaultSlug: string | null,
): string | null {
  if (defaultSlug != null && id === defaultSlug) return null;
  return id || null;
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
  const historyRef = useRef<HTMLDivElement | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);

  const pickerModels = useMemo<ModelInfo[]>(
    () => toPickerModels(models, chat.selectedModel),
    [models, chat.selectedModel],
  );
  // `toPickerModels` guarantees both the selected slug and the default a row, so
  // this value always resolves to a real option — the displayed model is exactly
  // the slug the next turn will send, with no panel-side rewrite of the user's
  // choice. Falls through to the default, then empty, only when nothing is set.
  const pickerValue = chat.selectedModel ?? models.default ?? "";

  const { state } = chat;
  // Always-current chat handle, so an async delete can re-check the LIVE thread
  // + status after awaiting (the closure's `chat`/`state` are render-time stale).
  const chatRef = useRef(chat);
  chatRef.current = chat;

  // Dismiss the history overlay on an outside pointer press or Escape — the
  // press-anywhere / Escape-to-close behavior expected of a floating dropdown
  // (the overlay sits above the conversation, so otherwise only the toggle could
  // dismiss it). The toggle button and the overlay are excluded from the pointer
  // check, which keeps the toggle's own `onClick` authoritative: pressing the
  // open toggle fires `pointerdown` here first (ignored, it's the button) and
  // then `click` (which closes), so the two never fight. `pointerdown` is
  // deliberate over `mousedown` so dismissal also fires for touch/pen. Escape is
  // handled in the capture phase and stops immediate propagation so it closes
  // only the overlay — not the whole assistant, whose dock also listens for it.
  useEffect(() => {
    if (!historyOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (historyRef.current?.contains(target)) return;
      if (historyButtonRef.current?.contains(target)) return;
      setHistoryOpen(false);
    };
    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Only intercept Escape that originates inside the overlay (focus is moved
      // there on open). This keeps the dismissal scoped — a stray Escape while
      // focus is elsewhere is left for whatever else listens for it, rather than
      // swallowing every Escape document-wide while the overlay is open.
      if (!historyRef.current?.contains(e.target as Node)) return;
      e.stopImmediatePropagation();
      setHistoryOpen(false);
      historyButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDownCapture, true);
    };
  }, [historyOpen]);

  // Move focus into the overlay when it opens so keyboard and screen-reader users
  // land on it (and Escape / arrow navigation target it), rather than having it
  // appear silently with focus left on the toggle.
  useEffect(() => {
    if (historyOpen) historyRef.current?.focus();
  }, [historyOpen]);

  // Prefer the just-settled turn's balance (from the usage event, immediate)
  // over the injected fetched balance, which may lag a turn behind.
  const effectiveBalance = state.usage?.balanceUsd ?? balanceUsd;
  const errorView = state.error
    ? presentError(state.error.code, state.error.message)
    : null;
  const low = isLowBalance(effectiveBalance) && !errorView;
  const streaming = state.status === "streaming";
  // The active conversation's title — the first user message, truncated, mirroring
  // the server's own thread titling (a thread title IS its truncated first user
  // message). Derived client-side so it shows immediately on the first send and
  // on a restored thread, with no extra fetch. Null for a fresh, empty chat.
  const firstUserText = state.messages
    .find((m) => m.role === "user")
    ?.text.trim();
  // Truncate by code point (Array.from), not UTF-16 code unit, so a 60-char cut
  // can't split a surrogate pair (emoji / astral script) into a replacement char.
  const titleChars = firstUserText ? Array.from(firstUserText) : [];
  const conversationTitle = firstUserText
    ? titleChars.length > 60
      ? `${titleChars.slice(0, 60).join("")}…`
      : firstUserText
    : null;

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
    <div className="relative flex h-full flex-col bg-background">
      {/* Header + toolbar. Positioned (relative + z-10) so the history overlay
          drops directly under it via `top-full` and floats above the
          conversation rather than pushing it down. */}
      <div className="relative z-10 border-border border-b">
        {/* Title bar: identity + active-conversation title, and the
            conversation-level actions (history, new, close). */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-foreground text-sm">
                Assistant
              </span>
              <span
                aria-label="Your credit balance"
                className="text-muted-foreground text-xs"
              >
                {formatMoney(effectiveBalance)}
              </span>
            </div>
            {conversationTitle && (
              <span
                className="truncate text-muted-foreground text-xs"
                title={conversationTitle}
              >
                {conversationTitle}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              ref={historyButtonRef}
              type="button"
              onClick={openHistory}
              aria-label="Chat history"
              aria-pressed={historyOpen}
              className={`rounded-md p-1.5 transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                historyOpen
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <History className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={chat.reset}
              aria-label="New chat"
              title="New chat"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toolbar: the model picker (searchable, brand-aware) and the
            text-size control that zooms the transcript. */}
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          {pickerModels.length > 0 ? (
            <ModelPicker
              variant="pill"
              label="Model"
              value={pickerValue}
              onChange={(id) =>
                chat.setModel(nextModelSelection(id, models.default))
              }
              models={pickerModels}
            />
          ) : (
            <span className="px-1 text-muted-foreground text-xs">
              Default model
            </span>
          )}
          <div
            className="flex items-center overflow-hidden rounded-md border border-border"
            role="group"
            aria-label="Text size"
          >
            <button
              type="button"
              onClick={font.decrease}
              disabled={!font.canDecrease}
              aria-label="Decrease text size"
              className="px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={font.increase}
              disabled={!font.canIncrease}
              aria-label="Increase text size"
              className="border-border border-l px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* History overlay: an elevated dropdown anchored under the header,
            dismissed by an outside press (see the effect above). */}
        {historyOpen && (
          <div
            ref={historyRef}
            role="dialog"
            aria-label="Recent conversations"
            tabIndex={-1}
            className="absolute inset-x-2 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-surface-container-highest shadow-xl ring-1 ring-black/5 focus:outline-none"
          >
            <div className="border-border border-b bg-surface-container-high px-3 py-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
              Recent conversations
            </div>
            {/* Bounded to half the viewport so a long list can't run past the
                panel's bottom edge (over the composer) on short viewports. */}
            <div className="max-h-[min(18rem,50vh)] overflow-y-auto">
              {threads.threads.length === 0 ? (
                <p className="px-3 py-3 text-muted-foreground text-xs">
                  {threads.loaded ? "No past conversations." : "Loading…"}
                </p>
              ) : (
                <ul className="py-1">
                  {threads.threads.map((t) => {
                    const busyActive =
                      state.threadId === t.id && state.status !== "idle";
                    const active = state.threadId === t.id;
                    return (
                      <li
                        key={t.id}
                        className={`group flex items-center transition-colors hover:bg-muted/60 ${
                          active ? "bg-primary/10" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            chat.switchThread(t.id);
                            setHistoryOpen(false);
                          }}
                          className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-xs ${
                            active
                              ? "font-medium text-foreground"
                              : "text-foreground"
                          }`}
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
          </div>
        )}
      </div>

      {/* Conversation — host-swappable renderer, else the built-in timeline. */}
      <div
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
        // The text-size control zooms the whole transcript. `zoom` scales every
        // descendant uniformly regardless of which renderer draws the
        // conversation and what font-size utilities it uses; an inline
        // `font-size` would not, since the transcript's text utilities set
        // absolute rem sizes and ignore the inherited value. `transform: scale`
        // is unsuitable — it keeps the original layout box and would break this
        // scroll container. Baseline-supported in evergreen browsers (Firefox
        // 126+); nothing inside the transcript virtualizes or reads
        // getBoundingClientRect, so zoom's coordinate scaling is safe here.
        style={{ zoom: font.scale }}
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
        {/* Running indicator: while a turn streams, the composer's Send becomes a
            Stop button — on its own an easy-to-miss signal. This animated row makes
            "the assistant is working" unmistakable regardless of the transcript
            renderer in use. */}
        {streaming && (
          <div className="px-2 pb-1.5" aria-label="Assistant is working">
            <ThinkingIndicator />
          </div>
        )}
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
