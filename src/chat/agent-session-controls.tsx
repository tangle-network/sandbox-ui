"use client";

import { type ReasoningEffort, reasoningEffortsFor } from "@tangle-network/agent-interface";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Lock, SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import {
  canonicalModelId,
  ModelPicker,
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
  ReasoningLevelPicker,
  type ReasoningLevel,
  type ReasoningLevelOption,
} from "./reasoning-level-picker";

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
  /** Tooltip shown on the locked trigger. */
  lockReason?: string;
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

export interface AgentSessionControlsProps {
  /**
   * Harness (agent backend) selection. Switching harness usually means
   * re-creating the agent session — the consumer owns that lifecycle.
   */
  harness?: AgentSessionHarnessControl;
  /** Per-turn model override, fed by the router's model catalog. */
  model?: AgentSessionModelControl;
  /** Thinking-effort level applied to subsequent turns. */
  reasoning?: AgentSessionReasoningControl;
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
   * on the left of the gear menu.
   */
  layout?: "inline" | "gear";
  /**
   * Where the inline pickers open. `"auto"` (default) keeps Radix's
   * collision-aware behavior: the menus open downward but flip up when the
   * composer is docked at the bottom of the viewport. `"down"` pins them open
   * downward — for a composer floating in open space (e.g. a centered new-chat
   * surface) where flipping up would cover the heading. Only affects the
   * `"inline"` layout; the gear menu is unchanged.
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
}

function HarnessDropdown({
  value,
  onChange,
  available,
  disabled,
  locked,
  lockReason,
  side = "bottom",
  align = "start",
  avoidCollisions,
}: HarnessDropdownProps) {
  const allowed = new Set<HarnessType>(
    available ?? HARNESS_OPTIONS.map((h) => h.type),
  );
  const options = HARNESS_OPTIONS.filter((h) => allowed.has(h.type));
  const selected = options.find((option) => option.type === value);

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
          )}
          aria-label="Agent harness"
        >
          {locked ? (
            <Lock className="h-3 w-3 text-muted-foreground" />
          ) : (
            <HarnessLogo type={value} size={16} />
          )}
          <span>{selected?.label ?? value}</span>
          {!locked && (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
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
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
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
 * native harness — unless the harness is `locked`, in which case the
 * catalog itself is filtered to compatible models.
 *
 * Designed to slot into `SandboxWorkbench`'s `session.composerControls`.
 */
export function AgentSessionControls({
  harness,
  model,
  reasoning,
  trailing,
  className,
  context = "chat",
  layout = "inline",
  menuPlacement = "auto",
}: AgentSessionControlsProps) {
  if (!harness && !model && !reasoning && !trailing) return null;

  const handleHarnessChange = (next: HarnessType) => {
    harness?.onChange(next);
    if (model) {
      const snapped = snapModelToHarness(next, model.value, model.models);
      if (snapped !== model.value) model.onChange(snapped);
    }
  };

  const handleModelChange = (nextModelId: string) => {
    model?.onChange(nextModelId);
    if (harness && !harness.locked) {
      const snapped = snapHarnessToModel(harness.value, nextModelId);
      if (snapped !== harness.value) harness.onChange(snapped);
    }
  };

  const visibleModels =
    model && harness?.locked
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

  // The menu opens up-and-left in the gear layout (right-anchored copilot),
  // and bottom-start inline.
  const menuSide = layout === "gear" ? "left" : "bottom";
  const menuAlign = layout === "gear" ? "end" : "start";
  // A floating (non-docked) inline composer pins its menus open downward so a
  // tall menu can't flip up over the heading. Only the inline strip honors this;
  // the gear menu keeps its own placement.
  const inlineForceDown = menuPlacement === "down" && layout !== "gear";
  const avoidCollisions = inlineForceDown ? false : undefined;

  const harnessNode = harness && (
    <HarnessDropdown
      {...harness}
      available={harnessAvailable}
      onChange={handleHarnessChange}
      side={menuSide}
      align={menuAlign}
      avoidCollisions={avoidCollisions}
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
      disabled={model.disabled || (visibleModels ?? []).length === 0}
      side={layout === "gear" ? undefined : "bottom"}
      avoidCollisions={avoidCollisions}
    />
  );
  // The selected model's reasoning capability (from the catalog) refines the harness clamp: a model
  // that doesn't reason collapses to `none`; a lower model ceiling caps the list there.
  const selectedModel = model?.models.find(
    (entry) => canonicalModelId(entry) === model.value,
  );
  const modelReasoning = selectedModel
    ? {
        supportsReasoning: selectedModel.supportsReasoning,
        maxEffort: selectedModel.maxReasoningEffort,
      }
    : null;
  const reasoningNode = reasoning && (
    <ReasoningLevelPicker
      value={reasoning.value}
      onChange={reasoning.onChange}
      options={reasoning.options}
      disabled={reasoning.disabled}
      // Smart switch: show only the reasoning levels the selected (harness, model) pair supports —
      // the harness clamp (codex caps high, cli-base only `none`, claude full) intersected with the
      // model's own capability. Driven entirely by agent-interface's `reasoningEffortsFor`.
      available={
        harness
          ? reasoningEffortsFor(harness.value, modelReasoning)
          : reasoning.available
      }
      side={layout === "gear" ? undefined : "bottom"}
      avoidCollisions={avoidCollisions}
    />
  );

  if (layout === "gear") {
    return (
      <GearControls
        className={className}
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
  harnessNode,
  modelNode,
  reasoningNode,
  trailing,
}: {
  className?: string;
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
      {trailing && (
        <div className="flex items-center gap-2">{trailing}</div>
      )}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Session controls"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container",
              "text-foreground shadow-sm transition-colors",
              "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "data-[state=open]:border-[var(--md3-outline-variant)] data-[state=open]:bg-surface-container-high",
            )}
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="end"
            sideOffset={8}
            onInteractOutside={(event) => {
              // The nested model / harness / effort pickers portal their menus
              // to <body>, i.e. outside this Content's DOM subtree. Without
              // this guard, interacting with a nested menu reads as an outside
              // click and collapses the gear menu. Keep the gear open while
              // the pointer lands inside any Radix popper/portal.
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
              "z-50 flex w-56 flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--md3-outline-variant)] bg-surface-container-highest p-2",
              "shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            {harnessNode && (
              <GearSection label="Harness">{harnessNode}</GearSection>
            )}
            {modelNode && (
              <GearSection label="Model">{modelNode}</GearSection>
            )}
            {reasoningNode && (
              <GearSection label="Effort">{reasoningNode}</GearSection>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
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
