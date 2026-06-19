"use client";

import { type ReasoningEffort, reasoningLadder } from "@tangle-network/agent-interface";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Brain, ChevronDown, Sparkles } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

/**
 * A reasoning selection: `auto` is a UI-only sentinel ("let the harness/model default decide",
 * sends no explicit override); every other value is the canonical `ReasoningEffort` from
 * `@tangle-network/agent-interface` (the single source of truth — `none` … `ultracode`). The picker
 * shows only the levels the chosen harness/model supports — see `reasoningEffortsFor` + the
 * `available` prop — so unsupported levels (codex's `xhigh`/`ultracode`, kimi's mid-range) never
 * appear rather than being silently degraded.
 */
export type ReasoningLevel = "auto" | ReasoningEffort;

/** Ordered ascending intensity (excludes "auto"), straight from the canonical ladder. */
export const REASONING_LADDER: ReadonlyArray<ReasoningEffort> = reasoningLadder;

/**
 * Proportional intensity meter. Auto shows a Sparkles glyph (no fixed depth);
 * every other level fills a fixed-width bar meter to its rank in the ladder, so
 * the rows read as an ascending scale regardless of how many levels exist.
 */
function ReasoningGlyph({ level }: { level: ReasoningLevel }) {
  if (level === "auto") {
    return <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  const BARS = 4;
  const rank = REASONING_LADDER.indexOf(level) + 1; // 1..ladder.length
  const filled = Math.max(1, Math.ceil((rank / REASONING_LADDER.length) * BARS));
  return (
    <span
      aria-hidden
      className="inline-flex h-3.5 items-end gap-px"
      style={{ width: 16 }}
    >
      {Array.from({ length: BARS }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-[1px]",
            i < filled ? "bg-foreground" : "bg-border",
          )}
          style={{ height: `${35 + i * 22}%` }}
        />
      ))}
    </span>
  );
}

export interface ReasoningLevelOption {
  value: ReasoningLevel;
  label: string;
  description: string;
}

export interface ReasoningLevelPickerProps {
  value: ReasoningLevel;
  onChange: (value: ReasoningLevel) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  options?: ReadonlyArray<ReasoningLevelOption>;
  /**
   * Capability filter — the reasoning efforts the currently-selected harness/model supports, from
   * `reasoningEffortsFor(harness, model)`. When provided, the picker shows ONLY these (plus the
   * `auto` sentinel), so a harness that can't do `ultracode`/`xhigh` (e.g. codex) never offers it.
   * Omit to show every option.
   */
  available?: ReadonlyArray<ReasoningEffort>;
}

export const DEFAULT_REASONING_LEVEL_OPTIONS: ReadonlyArray<ReasoningLevelOption> = [
  { value: "auto", label: "Auto", description: "Let the agent pick the right depth." },
  { value: "none", label: "None", description: "No extended thinking — fastest, cheapest." },
  { value: "minimal", label: "Minimal", description: "Thinking on, lowest budget." },
  { value: "low", label: "Low", description: "Fast, direct answers." },
  { value: "medium", label: "Medium", description: "Inspect context before acting." },
  { value: "high", label: "High", description: "Deeper planning and edge-case checks." },
  { value: "xhigh", label: "Extra High", description: "Extended reasoning for hard problems (Codex/OpenAI)." },
  { value: "ultracode", label: "Ultracode", description: "Maximum extended thinking (Claude Code's ultracode)." },
];

export function ReasoningLevelPicker({
  value,
  onChange,
  disabled,
  className,
  triggerClassName,
  options = DEFAULT_REASONING_LEVEL_OPTIONS,
  available,
}: ReasoningLevelPickerProps) {
  // Capability filter: keep `auto` always; otherwise only the efforts the harness/model supports.
  const shown = available
    ? options.filter((o) => o.value === "auto" || available.includes(o.value as ReasoningEffort))
    : options;
  const selected = shown.find((option) => option.value === value);
  const label = selected?.label ?? "Auto";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5",
            "text-xs font-medium text-foreground shadow-sm transition-colors",
            "hover:border-border hover:bg-muted/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "data-[state=open]:border-border data-[state=open]:bg-muted/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
            triggerClassName,
          )}
          aria-label="Reasoning level"
        >
          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 w-64 overflow-hidden rounded-[var(--radius-md)] border border-border bg-card p-1",
            "shadow-[var(--shadow-dropdown)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {shown.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onSelect={() => onChange(option.value)}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 outline-none",
                "transition-colors hover:bg-accent/40 focus:bg-accent/40",
                option.value === value && "bg-[var(--accent-surface-soft)] text-[var(--accent-text)]",
              )}
            >
              <span className="mt-0.5 flex w-3.5 shrink-0 justify-center">
                <ReasoningGlyph level={option.value} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
