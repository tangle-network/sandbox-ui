"use client";

import {
  harnessHonorsEffort,
  harnessHonorsModel,
  type ModelReasoningCapability,
  type ReasoningEffort,
  reasoningEffortsFor,
} from "@tangle-network/agent-interface";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Lock, Plus, SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import { useClickOutside } from "../lib/use-click-outside";
import {
  canonicalModelId,
  ModelBrandStack,
  ModelPicker,
  resolveModelBrandIdentity,
  stripBrandPrefix,
  type ModelInfo,
} from "../dashboard/model-picker";
import {
  HARNESS_OPTIONS,
  chatCapableHarnesses,
  type HarnessType,
} from "../dashboard/harness-picker";
import { HarnessLogo } from "../dashboard/harness-logo";
import {
  isModelCompatibleWithHarness,
  snapHarnessToModel,
  snapModelToHarness,
} from "./harness-model-compat";
import {
  clampReasoningLevel,
  DEFAULT_REASONING_LEVEL_OPTIONS,
  HARNESS_REASONING_OPTIONS,
  ReasoningGlyph,
  ReasoningLevelPicker,
  type ReasoningLevel,
  type ReasoningLevelOption,
} from "./reasoning-level-picker";
import {
  AgentProfilePicker,
  type AgentProfileCapability,
  type AgentProfileDraft,
  type AgentProfileOption,
} from "./agent-profile-picker";

export interface AgentSessionHarnessControl {
  value: HarnessType;
  onChange: (next: HarnessType) => void;
  /** Filter the selectable harnesses (e.g. by plan tier). Defaults to all. */
  available?: ReadonlyArray<HarnessType>;
  disabled?: boolean;
  /**
   * A harness is bound to its chat session once the conversation has
   * started. While locked the dropdown is inert and the model catalog
   * is filtered to what this harness can run — fork the session to
   * switch harness.
   */
  locked?: boolean;
  /** Tooltip shown on the locked trigger when no `onNewChat` is provided. */
  lockReason?: string;
  /**
   * Fork action for a locked harness. When provided, the locked trigger turns
   * into an informative chip: hover or tap opens a small popover explaining the
   * lock and offering a button that calls this to start a fresh session. When
   * omitted, the locked trigger stays a plain inert button with `lockReason`.
   */
  onNewChat?: () => void;
  /** Popover heading. Defaults to `Agent fixed to {harness} for this conversation.` */
  lockTitle?: React.ReactNode;
  /** Popover sub-line. Defaults to "Conversations stay on one agent." */
  lockBody?: React.ReactNode;
  /** Fork button label. Defaults to "New chat to switch agent". */
  newChatLabel?: string;
}

export interface AgentSessionModelControl {
  /** Canonical model id (provider-prefixed, e.g. "anthropic/claude-opus-4-8"). */
  value: string;
  onChange: (modelId: string) => void;
  /** Models to choose from. Pass `[]` while loading. */
  models: ModelInfo[];
  loading?: boolean;
  popular?: ReadonlyArray<string>;
  recents?: ReadonlyArray<string>;
  disabled?: boolean;
}

export interface AgentSessionReasoningControl {
  value: ReasoningLevel;
  onChange: (value: ReasoningLevel) => void;
  options?: ReadonlyArray<ReasoningLevelOption>;
  disabled?: boolean;
  /**
   * Reasoning efforts to offer when no harness is selected (e.g. a model-derived capability set).
   * When a harness IS present the strip derives this from `reasoningEffortsFor(harness)` instead.
   */
  available?: ReadonlyArray<ReasoningEffort>;
}

/**
 * Agent-profile (mode / toolset / persona) selection. Backend-agnostic — it
 * sits beside the model in both router-backed and sandbox-backed modes, so the
 * same session can switch the agent's identity without touching the harness.
 */
export interface AgentSessionProfileControl {
  value: string;
  onChange: (id: string) => void;
  profiles: ReadonlyArray<AgentProfileOption>;
  /** Tool catalog for inline authoring; pair with a write callback to enable it. */
  capabilities?: ReadonlyArray<AgentProfileCapability>;
  onCreate?: (draft: AgentProfileDraft) => void | Promise<void>;
  onUpdate?: (id: string, draft: AgentProfileDraft) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  disabled?: boolean;
}

export interface AgentSessionControlsProps {
  /**
   * Harness (agent backend) selection. Switching harness usually means
   * re-creating the agent session — the consumer owns that lifecycle.
   */
  harness?: AgentSessionHarnessControl;
  /**
   * Agent profile (mode / toolset / persona). Universal — present in both
   * router-backed and sandbox-backed composers, independent of the harness.
   */
  profile?: AgentSessionProfileControl;
  /** Per-turn model override, fed by the router's model catalog. */
  model?: AgentSessionModelControl;
  /** Thinking-effort level applied to subsequent turns. */
  reasoning?: AgentSessionReasoningControl;
  /**
   * Restrict the model catalog to what the selected harness can actually run,
   * the same way `harness.locked` does — but WITHOUT locking the harness
   * dropdown. Off by default: the strip shows every model and picking an
   * incompatible one snaps the harness to the model's native backend. Turn it
   * ON for a harness-first surface (e.g. a workspace-wide, sandbox-bound
   * harness) where that silent backend swap is undesirable — an incompatible
   * model is then simply not offered.
   */
  filterModelsToHarness?: boolean;
  /** Right-aligned extra content (token meter, cost, status). */
  trailing?: React.ReactNode;
  className?: string;
  /**
   * Which surface these controls live on. `"chat"` (default) restricts the
   * harness list to chat-capable backends — shell-only `cli-base` is hidden
   * because it has no conversational agent. `"all"` keeps every harness for
   * scheduled / non-chat surfaces. An explicit `harness.available` list still
   * wins; this only trims the default-everything set.
   */
  context?: "chat" | "all";
  /**
   * Trigger layout. `"inline"` (default) lays the pickers out in a row — the
   * existing behavior. `"gear"` collapses them behind a single compact gear
   * button whose menu opens up-and-left, for right-anchored copilots where
   * the composer is tight. Nested model/harness/effort menus render adjacent
   * on the left of the gear menu. `"combined"` is the gear layout with a
   * labeled trigger instead of the anonymous icon: the button summarizes the
   * current selection as text (`harness · model · effort`) so the choice stays
   * visible without opening the menu — for a composer that wants one compact
   * agent control it can read at a glance.
   */
  layout?: "inline" | "gear" | "combined";
  /**
   * Where the pickers open. `"auto"` (default) keeps Radix's collision-aware
   * behavior: the menus open downward but flip up when the composer is docked
   * at the bottom of the viewport. `"down"` pins them open downward — for a
   * composer floating in open space (e.g. a centered new-chat surface) where
   * flipping up would cover the heading. Honored by the `"inline"` strip (its
   * nested pickers) and by the `"combined"` panel (which opens downward instead
   * of upward); the `"gear"` menu keeps its own placement.
   */
  menuPlacement?: "auto" | "down";
}

interface HarnessDropdownProps extends AgentSessionHarnessControl {
  /** Side the menu opens toward. Defaults to bottom (inline strip). */
  side?: DropdownMenu.DropdownMenuContentProps["side"];
  /** Cross-axis alignment of the menu. Defaults to start. */
  align?: DropdownMenu.DropdownMenuContentProps["align"];
  /** Let Radix flip the menu when it would overflow. Defaults to true. */
  avoidCollisions?: boolean;
  /** Extra classes for the trigger pill — e.g. `w-full` in the collapsed panel. */
  triggerClassName?: string;
}

/**
 * A short note for a harness that drops one or both per-turn selectors, so the picker can warn
 * before it's chosen (rather than silently ignoring the user's model/effort pick). `null` when the
 * harness honors both. Driven by agent-interface's `harnessHonorsModel`/`harnessHonorsEffort`.
 */
function selectorIgnoreNote(harness: HarnessType): string | null {
  const ignoresModel = !harnessHonorsModel(harness);
  const ignoresEffort = !harnessHonorsEffort(harness);
  if (ignoresModel && ignoresEffort) return "Ignores model & effort";
  if (ignoresModel) return "Ignores model selection";
  if (ignoresEffort) return "Ignores reasoning effort";
  return null;
}

/**
 * Locked-harness trigger that explains the lock and offers a fork. The harness
 * is bound to its chat session once a conversation has started, so rather than a
 * silent dead control the chip stays visibly locked but reveals — on hover or
 * tap — why it's fixed and a button to start a fresh session on another harness.
 */
function InformativeLock({
  type,
  label,
  lockTitle,
  lockBody,
  newChatLabel,
  onNewChat,
}: {
  type: HarnessType;
  label: string;
  lockTitle?: React.ReactNode;
  lockBody?: React.ReactNode;
  newChatLabel?: string;
  onNewChat: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, [cancelClose]);
  React.useEffect(() => cancelClose, [cancelClose]);

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-state={open ? "open" : "closed"}
        aria-label="Agent harness (locked)"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          // Dimmed to read as locked (the harness is bound to this session),
          // matching the disabled model picker — the logo stays so the chip is
          // still recognizably this harness; the popover explains the lock.
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container px-2.5 opacity-60",
          "text-xs font-medium text-foreground shadow-sm transition-colors",
          "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "data-[state=open]:border-[var(--md3-outline-variant)] data-[state=open]:bg-surface-container-high",
        )}
      >
        <HarnessLogo type={type} size={16} />
        <span>{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          className={cn(
            "absolute bottom-full left-0 z-50 mb-2 w-72 rounded-[var(--radius-md)] border border-[var(--md3-outline-variant)] bg-surface-container-highest p-3",
            "shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
          )}
        >
          <p className="flex items-start gap-2 text-sm font-medium text-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {lockTitle ?? `Agent fixed to ${label} for this conversation.`}
            </span>
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {lockBody ?? "Conversations stay on one agent."}
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNewChat();
            }}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground",
              "bg-primary/10 ring-1 ring-inset ring-primary/25 transition-colors",
              "hover:bg-primary/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <Plus className="h-4 w-4" />
            {newChatLabel ?? "New chat to switch agent"}
          </button>
        </div>
      )}
    </div>
  );
}

function HarnessDropdown({
  value,
  onChange,
  available,
  disabled,
  locked,
  lockReason,
  onNewChat,
  lockTitle,
  lockBody,
  newChatLabel,
  side = "bottom",
  align = "start",
  avoidCollisions,
  triggerClassName,
}: HarnessDropdownProps) {
  const allowed = new Set<HarnessType>(
    available ?? HARNESS_OPTIONS.map((h) => h.type),
  );
  const options = HARNESS_OPTIONS.filter((h) => allowed.has(h.type));
  const selected = options.find((option) => option.type === value);

  // A locked harness with a fork action becomes the informative-lock chip;
  // without one it falls back to the bare inert trigger below.
  if (locked && onNewChat) {
    return (
      <InformativeLock
        type={value}
        label={selected?.label ?? value}
        lockTitle={lockTitle}
        lockBody={lockBody}
        newChatLabel={newChatLabel}
        onNewChat={onNewChat}
      />
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled || locked}
          title={locked ? lockReason : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container px-2.5",
            "text-xs font-medium text-foreground shadow-sm transition-colors",
            "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "data-[state=open]:border-[var(--md3-outline-variant)] data-[state=open]:bg-surface-container-high",
            "disabled:cursor-not-allowed disabled:opacity-60",
            triggerClassName,
          )}
          aria-label="Agent harness"
        >
          <HarnessLogo type={value} size={16} className="shrink-0" />
          <span className="truncate">{selected?.label ?? value}</span>
          {!locked && (
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={align}
          avoidCollisions={avoidCollisions}
          collisionPadding={24}
          sideOffset={6}
          className={cn(
            // Cap to the viewport space on the open side and scroll, so a tall
            // backend list pinned downward (floating composer) never runs off
            // the bottom edge.
            "z-50 w-72 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--md3-outline-variant)] bg-surface-container-highest p-1",
            "shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.type}
              onSelect={(event) => {
                event.preventDefault();
                onChange(option.type);
              }}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 outline-none",
                "transition-colors hover:bg-accent/50 focus:bg-accent/50",
                option.type === value &&
                  "bg-primary/10 font-medium text-foreground ring-1 ring-inset ring-primary/25 hover:bg-primary/15 focus:bg-primary/15",
              )}
            >
              <HarnessLogo type={option.type} size={20} className="mt-0.5" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
                {selectorIgnoreNote(option.type) && (
                  <span className="mt-0.5 inline-flex w-fit items-center rounded border border-[var(--md3-outline-variant)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {selectorIgnoreNote(option.type)}
                  </span>
                )}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * What the catalog knows about a model's own reasoning capability, shaped for
 * `reasoningEffortsFor`. Returns null for an unknown / unselected model (no
 * refinement — the harness clamp alone applies).
 */
function modelReasoningCapability(
  models: ReadonlyArray<ModelInfo> | undefined,
  canonicalId: string | undefined,
): ModelReasoningCapability | null {
  if (!models || !canonicalId) return null;
  const entry = models.find((m) => canonicalModelId(m) === canonicalId);
  return entry
    ? {
        supportsReasoning: entry.supportsReasoning,
        maxEffort: entry.maxReasoningEffort,
      }
    : null;
}

/**
 * Compact control strip for an agent chat composer: harness, model, and
 * thinking-effort pickers in one row. Every section is optional and only
 * renders when its control object is provided — never show a dead control.
 *
 * When BOTH harness and model controls are present the pair is kept
 * coherent automatically (see harness-model-compat): picking a harness
 * snaps an incompatible model to that harness's best catalog option;
 * picking a model the current harness can't run switches to the model's
 * native harness — unless the catalog is restricted to the harness (when
 * `locked`, or the consumer sets `filterModelsToHarness`), in which case the
 * incompatible model is never offered and no swap happens.
 *
 * When a reasoning control is also present, the effort is re-clamped into the
 * set the new (harness, model) pair supports on every harness/model change, so
 * the effort picker's label never disagrees with the value actually in effect.
 *
 * Designed to slot into `SandboxWorkbench`'s `session.composerControls`.
 */
export function AgentSessionControls({
  harness,
  profile,
  model,
  reasoning,
  filterModelsToHarness,
  trailing,
  className,
  context = "chat",
  layout = "inline",
  menuPlacement = "auto",
}: AgentSessionControlsProps) {
  if (!harness && !profile && !model && !reasoning && !trailing) return null;

  // Filter the catalog to the harness when locked (harness bound to a started
  // session) or when the consumer opts in via `filterModelsToHarness`. In that
  // mode an incompatible model is never offered, so picking one can't silently
  // swap the harness.
  const restrictModelsToHarness = Boolean(
    harness && (harness.locked || filterModelsToHarness),
  );

  // Whether the SELECTED harness honors each per-turn selector. A harness that
  // drops one (amp ignores both; openclaw/nanoclaw the model; etc.) gets its
  // now-inert picker disabled — never present a live-looking dead control.
  const selectorHonorsModel = !harness || harnessHonorsModel(harness.value);
  const selectorHonorsEffort = !harness || harnessHonorsEffort(harness.value);

  // Re-clamp the reasoning effort into the set the (harness, model) pair supports
  // whenever that pair changes, so the picker's label can never disagree with the
  // value actually in effect (e.g. a stale `ultracode` after switching to Kimi).
  // Only the sandbox (harness) path is clamped; router-mode effort is its own concern.
  const clampEffort = (
    harnessValue: HarnessType,
    modelId: string | undefined,
  ) => {
    if (!reasoning) return;
    const available = reasoningEffortsFor(
      harnessValue,
      modelReasoningCapability(model?.models, modelId),
    );
    const clamped = clampReasoningLevel(reasoning.value, available);
    if (clamped !== reasoning.value) reasoning.onChange(clamped);
  };

  const handleHarnessChange = (next: HarnessType) => {
    harness?.onChange(next);
    let nextModelId = model?.value;
    if (model) {
      const snapped = snapModelToHarness(next, model.value, model.models);
      if (snapped !== model.value) {
        model.onChange(snapped);
        nextModelId = snapped;
      }
    }
    clampEffort(next, nextModelId);
  };

  const handleModelChange = (nextModelId: string) => {
    model?.onChange(nextModelId);
    let nextHarness = harness?.value;
    if (harness && !restrictModelsToHarness) {
      const snapped = snapHarnessToModel(harness.value, nextModelId);
      if (snapped !== harness.value) {
        harness.onChange(snapped);
        nextHarness = snapped;
      }
    }
    if (nextHarness) clampEffort(nextHarness, nextModelId);
  };

  const visibleModels =
    model && restrictModelsToHarness && harness
      ? model.models.filter((entry) =>
          isModelCompatibleWithHarness(
            harness.value,
            canonicalModelId(entry),
          ),
        )
      : model?.models;

  // Restrict the harness list for chat surfaces to chat-capable backends.
  // An explicit `available` list always wins; otherwise the chat context
  // drops shell-only harnesses (cli-base) while "all" keeps everything.
  const harnessAvailable =
    harness?.available ??
    (context === "chat" ? chatCapableHarnesses : undefined);

  // The nested pickers open up-and-left in the collapsed layouts (gear /
  // combined, both right-anchored), and bottom-start in the inline strip.
  const collapsed = layout === "gear" || layout === "combined";
  const menuSide = collapsed ? "left" : "bottom";
  const menuAlign = collapsed ? "end" : "start";
  // In the collapsed panels the pickers span the full width so their rows line
  // up. The `combined` layout additionally drops the MD3 `surface-container`
  // fill for the app-standard transparent/muted treatment so the pills sit in
  // the composer's own palette instead of a mismatched grey.
  const collapsedTriggerClass =
    layout === "combined"
      ? "w-full bg-transparent shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/60"
      : collapsed
        ? "w-full"
        : undefined;
  // A floating (non-docked) inline composer pins its menus open downward so a
  // tall menu can't flip up over the heading. Only the inline strip's own nested
  // pickers honor this; the collapsed layouts keep their nested menus adjacent.
  const inlineForceDown = menuPlacement === "down" && layout === "inline";
  const avoidCollisions = inlineForceDown ? false : undefined;

  const harnessNode = harness && (
    <HarnessDropdown
      {...harness}
      available={harnessAvailable}
      onChange={handleHarnessChange}
      side={menuSide}
      align={menuAlign}
      avoidCollisions={avoidCollisions}
      triggerClassName={collapsedTriggerClass}
    />
  );
  // The profile popover is not a Radix menu (its inline author form needs its
  // own focus), so it can't collision-flip — open upward by default for a
  // bottom-docked composer, downward only when the strip is pinned down.
  const profileNode = profile && (
    <AgentProfilePicker
      value={profile.value}
      onChange={profile.onChange}
      profiles={profile.profiles}
      capabilities={profile.capabilities}
      onCreate={profile.onCreate}
      onUpdate={profile.onUpdate}
      onDelete={profile.onDelete}
      disabled={profile.disabled}
      side={inlineForceDown || collapsed ? "bottom" : "top"}
    />
  );
  const modelNode = model && (
    <ModelPicker
      variant="pill"
      label=""
      value={model.value}
      onChange={handleModelChange}
      models={visibleModels ?? []}
      loading={model.loading}
      popular={model.popular}
      recents={model.recents}
      disabled={
        model.disabled ||
        (visibleModels ?? []).length === 0 ||
        !selectorHonorsModel
      }
      side={collapsed ? undefined : "bottom"}
      avoidCollisions={avoidCollisions}
      triggerClassName={collapsedTriggerClass}
    />
  );
  // The selected model's reasoning capability (from the catalog) refines the harness clamp: a model
  // that doesn't reason collapses to `none`; a lower model ceiling caps the list there.
  const modelReasoning = modelReasoningCapability(model?.models, model?.value);
  // A harness whose real control isn't a depth scale (kimi's binary toggle) supplies its own option
  // labels; every other harness uses the caller's options (or the picker's default ladder). The
  // `available` capability filter still applies on top, so only supported values render either way.
  const reasoningOptions =
    (harness && HARNESS_REASONING_OPTIONS[harness.value]) ?? reasoning?.options;
  const reasoningNode = reasoning && (
    <ReasoningLevelPicker
      value={reasoning.value}
      onChange={reasoning.onChange}
      options={reasoningOptions}
      disabled={reasoning.disabled || !selectorHonorsEffort}
      // Smart switch: show only the reasoning levels the selected (harness, model) pair supports —
      // the harness capability set (cli-base only `none`, Kimi binary, Codex extended) intersected
      // with the model's own capability. Driven entirely by agent-interface's `reasoningEffortsFor`.
      available={
        harness
          ? reasoningEffortsFor(harness.value, modelReasoning)
          : reasoning.available
      }
      side={collapsed ? undefined : "bottom"}
      avoidCollisions={avoidCollisions}
      triggerClassName={collapsedTriggerClass}
    />
  );

  if (layout === "gear") {
    return (
      <GearControls
        className={className}
        profileNode={profileNode}
        harnessNode={harnessNode}
        modelNode={modelNode}
        reasoningNode={reasoningNode}
        trailing={trailing}
      />
    );
  }

  if (layout === "combined") {
    // Summarize the current selection as icon-prefixed `harness · model · effort`
    // segments, dropping any whose control is absent or ignored by the selected
    // harness (a harness that ignores the model / effort drops that segment
    // rather than showing a value it won't honor). Each segment carries the same
    // glyph its picker uses, so the trigger reads like the pickers it opens.
    const segments: { key: string; label: string; node: React.ReactNode }[] = [];
    if (harness) {
      const harnessLabel =
        HARNESS_OPTIONS.find((option) => option.type === harness.value)?.label ??
        harness.value;
      segments.push({
        key: "harness",
        label: harnessLabel,
        node: (
          <span className="flex items-center gap-1.5">
            <HarnessLogo type={harness.value} size={16} className="shrink-0" />
            {harnessLabel}
          </span>
        ),
      });
    }
    if (model && selectorHonorsModel) {
      const current = (model.models ?? []).find(
        (entry) => canonicalModelId(entry) === model.value,
      );
      const identity = current ? resolveModelBrandIdentity(current) : null;
      const modelLabel = stripBrandPrefix(
        current?.name ?? current?.id ?? model.value,
        identity,
      );
      segments.push({
        key: "model",
        label: modelLabel,
        node: (
          <span className="flex items-center gap-1.5">
            {identity && <ModelBrandStack identity={identity} size="sm" />}
            {modelLabel}
          </span>
        ),
      });
    }
    if (reasoning && selectorHonorsEffort) {
      const effortLabel =
        (reasoningOptions ?? DEFAULT_REASONING_LEVEL_OPTIONS).find(
          (option) => option.value === reasoning.value,
        )?.label ?? "Auto";
      segments.push({
        key: "effort",
        label: effortLabel,
        node: (
          <span className="flex items-center gap-1.5">
            <span className="flex w-3.5 shrink-0 justify-center">
              <ReasoningGlyph level={reasoning.value} />
            </span>
            {effortLabel}
          </span>
        ),
      });
    }
    const summary = (
      <span className="flex items-center gap-1.5">
        {segments.map((segment, index) => (
          <React.Fragment key={segment.key}>
            {index > 0 && (
              <span
                className="text-base leading-none text-muted-foreground/60"
                aria-hidden
              >
                ·
              </span>
            )}
            {segment.node}
          </React.Fragment>
        ))}
      </span>
    );
    return (
      <SummaryControls
        className={className}
        summary={summary}
        title={segments.map((segment) => segment.label).join(" · ")}
        // Match the inline strip's placement contract: a floating composer pins
        // the panel downward so it can't cover the heading; otherwise it opens
        // upward for a bottom-docked composer.
        contentSide={menuPlacement === "down" ? "bottom" : "top"}
        profileNode={profileNode}
        harnessNode={harnessNode}
        modelNode={modelNode}
        reasoningNode={reasoningNode}
        trailing={trailing}
      />
    );
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-testid="agent-session-controls"
    >
      {profileNode}
      {harnessNode}
      {modelNode}
      {reasoningNode}
      {trailing && (
        <div className="ml-auto flex items-center gap-2">{trailing}</div>
      )}
    </div>
  );
}

/**
 * Right-anchored compact layout: a single gear button whose menu opens
 * up-and-left and stacks the (already-wired) harness / model / effort
 * pickers vertically, so the composer stays uncluttered. Each picker keeps
 * its own dropdown; in this layout those nested menus are configured to
 * open to the left (see `menuSide`/`menuAlign`), rendering adjacent to the
 * gear menu where there is room.
 */
function GearControls({
  className,
  profileNode,
  harnessNode,
  modelNode,
  reasoningNode,
  trailing,
}: {
  className?: string;
  profileNode: React.ReactNode;
  harnessNode: React.ReactNode;
  modelNode: React.ReactNode;
  reasoningNode: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <CollapsibleControls
      className={className}
      trigger={<SlidersHorizontal className="h-4 w-4 text-muted-foreground" />}
      triggerClassName={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container",
        "text-foreground shadow-sm transition-colors",
        "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "data-[state=open]:border-[var(--md3-outline-variant)] data-[state=open]:bg-surface-container-high",
      )}
      contentSide="top"
      contentClassName={cn(
        "w-56 gap-2 border-[var(--md3-outline-variant)] bg-surface-container-highest p-2",
        "shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
      )}
      profileNode={profileNode}
      harnessNode={harnessNode}
      modelNode={modelNode}
      reasoningNode={reasoningNode}
      trailing={trailing}
    />
  );
}

function GearSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * The gear layout with a labeled trigger: one pill that summarizes the current
 * selection as text (`harness · model · effort`) and opens the same vertical
 * stack of harness / model / effort pickers. Lets a composer read its agent
 * choice at a glance while keeping the strip to a single control.
 */
function SummaryControls({
  className,
  summary,
  title,
  contentSide,
  profileNode,
  harnessNode,
  modelNode,
  reasoningNode,
  trailing,
}: {
  className?: string;
  summary: React.ReactNode;
  title: string;
  contentSide: "top" | "bottom";
  profileNode: React.ReactNode;
  harnessNode: React.ReactNode;
  modelNode: React.ReactNode;
  reasoningNode: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <CollapsibleControls
      className={className}
      trigger={
        <>
          {summary}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </>
      }
      triggerTitle={title}
      triggerClassName={cn(
        // Container-less trigger (Codex-style): bare label + chevron docked in
        // the composer footer, no border/card/shadow. Only a subtle rounded
        // hover/open tint marks it as interactive.
        "inline-flex h-8 items-center gap-1.5 rounded-md px-1.5",
        "whitespace-nowrap text-xs font-medium text-foreground transition-colors",
        "hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "data-[state=open]:bg-muted/50",
      )}
      contentSide={contentSide}
      contentClassName="w-64 gap-2.5 border-border bg-popover p-2.5 text-popover-foreground shadow-lg"
      profileNode={profileNode}
      harnessNode={harnessNode}
      modelNode={modelNode}
      reasoningNode={reasoningNode}
      trailing={trailing}
    />
  );
}

function CollapsibleControls({
  className,
  trigger,
  triggerTitle,
  triggerClassName,
  contentSide,
  contentClassName,
  profileNode,
  harnessNode,
  modelNode,
  reasoningNode,
  trailing,
}: {
  className?: string;
  trigger: React.ReactNode;
  triggerTitle?: string;
  triggerClassName: string;
  contentSide: DropdownMenu.DropdownMenuContentProps["side"];
  contentClassName: string;
  profileNode: React.ReactNode;
  harnessNode: React.ReactNode;
  modelNode: React.ReactNode;
  reasoningNode: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-testid="agent-session-controls"
    >
      {trailing && <div className="flex items-center gap-2">{trailing}</div>}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Session controls"
            title={triggerTitle}
            className={triggerClassName}
          >
            {trigger}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side={contentSide}
            align="end"
            sideOffset={8}
            onInteractOutside={(event) => {
              // The nested model / harness / effort pickers portal their menus
              // to <body>, i.e. outside this Content's DOM subtree. Without
              // this guard, interacting with a nested menu reads as an outside
              // click and collapses the panel. Keep it open while the pointer
              // lands inside any Radix popper/portal.
              const target = event.target as HTMLElement | null;
              if (
                target?.closest(
                  "[data-radix-popper-content-wrapper],[data-radix-menu-content],[role=menu],[role=listbox]",
                )
              ) {
                event.preventDefault();
              }
            }}
            className={cn(
              "z-50 flex flex-col rounded-[var(--radius-md)] border",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              contentClassName,
            )}
          >
            {profileNode && <GearSection label="Agent">{profileNode}</GearSection>}
            {harnessNode && (
              <GearSection label="Harness">{harnessNode}</GearSection>
            )}
            {modelNode && <GearSection label="Model">{modelNode}</GearSection>}
            {reasoningNode && (
              <GearSection label="Effort">{reasoningNode}</GearSection>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
