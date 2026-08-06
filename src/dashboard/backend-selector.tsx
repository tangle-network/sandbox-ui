"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { cn } from "../lib/utils";

export interface Backend {
  type: string;
  label: string;
  description?: string;
  /** Optional leading brand glyph (e.g. a HarnessLogo) shown in the trigger and rows. */
  icon?: ReactNode;
}

export type BackendSelectorVariant = "field" | "pill";

export interface BackendSelectorProps {
  backends: Backend[];
  selected: string;
  onChange: (selected: string) => void;
  /**
   * Trigger appearance. "pill" (default) = compact inline pill — logo + short
   * label only. "field" = full-width form field with a label above. Either
   * way the long descriptor lives only as subtext inside the open dropdown,
   * never on the closed trigger.
   */
  variant?: BackendSelectorVariant;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Extra classes merged onto the trigger itself (after the built-in defaults). */
  triggerClassName?: string;
}

export function BackendSelector({
  backends,
  selected,
  onChange,
  variant = "pill",
  label = "Model",
  placeholder = "Select a model",
  className,
  triggerClassName,
}: BackendSelectorProps) {
  const current = backends.find((b) => b.type === selected);
  const triggerText = current?.label ?? placeholder;
  const ariaLabel = label ? `${label}: ${triggerText}` : triggerText;

  const trigger =
    variant === "pill" ? (
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container",
          "px-2.5 text-xs font-medium text-foreground shadow-sm",
          "transition-colors duration-[var(--transition-fast)]",
          "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "data-[state=open]:border-[var(--md3-outline)] data-[state=open]:bg-surface-container-high",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          triggerClassName,
        )}
      >
        {current?.icon}
        <span className={cn("truncate max-w-[140px]", current ? undefined : "text-muted-foreground")}>
          {triggerText}
        </span>
        {/* Descriptor stays in the DOM for a11y/typeahead but is not shown on the closed pill. */}
        {current?.description && <span className="sr-only">{current.description}</span>}
        <Select.Icon asChild>
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-[var(--transition-fast)] data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>
    ) : (
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)]",
          "border border-[var(--md3-outline-variant)] bg-surface-container px-3 py-2.5 text-sm text-left",
          "transition-colors duration-[var(--transition-fast)]",
          "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "data-[state=open]:border-[var(--md3-outline)] data-[state=open]:bg-surface-container-high",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {current?.icon}
          <span className={cn("min-w-0 truncate", current ? "font-medium text-foreground" : "text-muted-foreground")}>
            {triggerText}
          </span>
          {current?.description && <span className="sr-only">{current.description}</span>}
        </span>
        <Select.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-[var(--transition-fast)] data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>
    );

  return (
    <div className={cn(variant === "field" ? "space-y-1.5" : "inline-flex", className)}>
      {variant === "field" && label && (
        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-[0.06em]">
          {label}
        </label>
      )}
      <Select.Root value={selected} onValueChange={onChange}>
        {trigger}

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className={cn(
              "z-50 overflow-hidden",
              variant === "pill"
                ? "min-w-[240px] max-w-[320px]"
                : "w-[var(--radix-select-trigger-width)]",
              "rounded-[var(--radius-md)] border border-[var(--md3-outline-variant)]",
              "bg-surface-container-highest shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-1",
            )}
          >
            <Select.Viewport className="p-1">
              {backends.map((backend) => (
                <Select.Item
                  key={backend.type}
                  value={backend.type}
                  className={cn(
                    "relative flex cursor-pointer select-none items-start gap-2.5 rounded-[var(--radius-sm)]",
                    "px-3 py-2 text-sm outline-none",
                    "transition-colors duration-[var(--transition-fast)]",
                    "hover:bg-accent/50 focus:bg-accent/50",
                    "data-[state=checked]:bg-[var(--accent-surface-soft)] data-[state=checked]:text-[var(--brand-primary)]",
                  )}
                >
                  {backend.icon && (
                    <span className="mt-0.5 shrink-0">{backend.icon}</span>
                  )}
                  <span className="flex min-w-0 flex-col">
                    <Select.ItemText>
                      <span className="font-medium">{backend.label}</span>
                    </Select.ItemText>
                    {backend.description && (
                      <span className="mt-0.5 text-xs text-muted-foreground data-[state=checked]:text-[var(--accent-text)]">
                        {backend.description}
                      </span>
                    )}
                  </span>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
