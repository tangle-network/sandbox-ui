"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Lock } from "lucide-react";
import { cn } from "../lib/utils";
import {
  canonicalModelId,
  ModelPicker,
  type ModelInfo,
} from "../dashboard/model-picker";
import { HARNESS_OPTIONS, type HarnessType } from "../dashboard/harness-picker";
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
}

function HarnessDropdown({
  value,
  onChange,
  available,
  disabled,
  locked,
  lockReason,
}: AgentSessionHarnessControl) {
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
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5",
            "text-xs font-medium text-foreground shadow-sm transition-colors",
            "hover:border-primary/30 hover:bg-accent/30 focus:outline-none focus:border-primary/40",
            "data-[state=open]:border-primary/40 data-[state=open]:bg-accent/30",
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
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 w-72 overflow-hidden rounded-[var(--radius-md)] border border-border bg-card p-1",
            "shadow-[var(--shadow-dropdown)]",
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
                "transition-colors hover:bg-accent/40 focus:bg-accent/40",
                option.type === value &&
                  "bg-[var(--accent-surface-soft)] text-[var(--accent-text)]",
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

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-testid="agent-session-controls"
    >
      {harness && (
        <HarnessDropdown {...harness} onChange={handleHarnessChange} />
      )}
      {model && (
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
        />
      )}
      {reasoning && (
        <ReasoningLevelPicker
          value={reasoning.value}
          onChange={reasoning.onChange}
          options={reasoning.options}
          disabled={reasoning.disabled}
        />
      )}
      {trailing && (
        <div className="ml-auto flex items-center gap-2">{trailing}</div>
      )}
    </div>
  );
}
