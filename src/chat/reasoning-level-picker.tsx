"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Brain, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

export type ReasoningLevel = "auto" | "low" | "medium" | "high";

/** Filled-bar count per level, so the rows read as an intensity scale. */
const INTENSITY_BARS: Record<Exclude<ReasoningLevel, "auto">, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Three-bar meter that fills left-to-right with the level's intensity. Auto
 * has no fixed depth, so it shows a Sparkles glyph instead of a bar count.
 */
function ReasoningGlyph({ level }: { level: ReasoningLevel }) {
  if (level === "auto") {
    return <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  const filled = INTENSITY_BARS[level];
  return (
    <span
      aria-hidden
      className="inline-flex h-3.5 items-end gap-px"
      style={{ width: 14 }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-[1px]",
            i < filled ? "bg-foreground" : "bg-border",
          )}
          style={{ height: `${40 + i * 30}%` }}
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
  { value: "low", label: "Low", description: "Fast, direct answers." },
  { value: "medium", label: "Medium", description: "Inspect context before acting." },
  { value: "high", label: "High", description: "Deeper planning and edge-case checks." },
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
            "hover:border-primary/30 hover:bg-accent/30 focus:outline-none focus:border-primary/40",
            "data-[state=open]:border-primary/40 data-[state=open]:bg-accent/30",
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
