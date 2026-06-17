"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Brain, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Thinking-effort ladder — the superset of the per-harness reasoning scales so
 * one control covers every backend. Consumers map each level onto what the
 * chosen harness/model supports (and degrade unsupported ones):
 *   - OpenAI / Codex reasoning_effort: minimal · low · medium · high · xhigh
 *   - Anthropic (Claude) extended thinking: … · high · max
 *   - Claude Code: … · high · max · ultracode
 *   - generic: low · medium · high
 */
export type ReasoningLevel =
  | "auto"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"
  | "ultracode";

/** Ordered ascending intensity (excludes "auto"). Glyph + ranking derive from this. */
export const REASONING_LADDER: ReadonlyArray<Exclude<ReasoningLevel, "auto">> = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultracode",
];

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
}

export const DEFAULT_REASONING_LEVEL_OPTIONS: ReadonlyArray<ReasoningLevelOption> = [
  { value: "auto", label: "Auto", description: "Let the agent pick the right depth." },
  { value: "minimal", label: "Minimal", description: "Almost no deliberation — fastest, cheapest." },
  { value: "low", label: "Low", description: "Fast, direct answers." },
  { value: "medium", label: "Medium", description: "Inspect context before acting." },
  { value: "high", label: "High", description: "Deeper planning and edge-case checks." },
  { value: "xhigh", label: "Extra High", description: "Extended reasoning for hard problems (Codex/OpenAI)." },
  { value: "max", label: "Max", description: "Maximum extended thinking budget (Claude)." },
  { value: "ultracode", label: "Ultracode", description: "Exhaustive multi-pass reasoning (Claude Code)." },
];

export function ReasoningLevelPicker({
  value,
  onChange,
  disabled,
  className,
  triggerClassName,
  options = DEFAULT_REASONING_LEVEL_OPTIONS,
}: ReasoningLevelPickerProps) {
  const selected = options.find((option) => option.value === value);
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
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onSelect={(event) => {
                event.preventDefault();
                onChange(option.value);
              }}
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
