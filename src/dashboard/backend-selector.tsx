"use client";

import { ChevronDown } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { cn } from "../lib/utils";

export interface Backend {
  type: string;
  label: string;
  description?: string;
}

export interface BackendSelectorProps {
  backends: Backend[];
  selected: string;
  onChange: (selected: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function BackendSelector({
  backends,
  selected,
  onChange,
  label = "Model",
  placeholder = "Select a model",
  className,
}: BackendSelectorProps) {
  const current = backends.find((b) => b.type === selected);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-[0.06em]">
          {label}
        </label>
      )}
      <Select.Root value={selected} onValueChange={onChange}>
        <Select.Trigger
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)]",
            "border border-[var(--border-default)] bg-[var(--bg-card)]",
            "px-3 py-2.5 text-sm text-left",
            "transition-colors duration-[var(--transition-fast)]",
            "hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]/30",
            "focus:outline-none focus:border-[var(--border-accent)]",
            "data-[state=open]:border-[var(--border-accent)] data-[state=open]:bg-[var(--bg-hover)]/30",
          )}
        >
          <div className="min-w-0 flex-1">
            {current ? (
              <div>
                <span className="font-medium text-[var(--text-primary)]">
                  {current.label}
                </span>
                {current.description && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    {current.description}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[var(--text-muted)]">{placeholder}</span>
            )}
          </div>
          <Select.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-[var(--transition-fast)] data-[state=open]:rotate-180" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className={cn(
              "z-50 w-[var(--radix-select-trigger-width)] overflow-hidden",
              "rounded-[var(--radius-md)] border border-[var(--border-default)]",
              "bg-[var(--bg-card)] shadow-[var(--shadow-dropdown)]",
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
                    "relative flex cursor-pointer select-none flex-col rounded-[var(--radius-sm)]",
                    "px-3 py-2.5 text-sm outline-none",
                    "transition-colors duration-[var(--transition-fast)]",
                    "hover:bg-[var(--bg-hover)]/50 focus:bg-[var(--bg-hover)]/50",
                    "data-[state=checked]:bg-[var(--accent-surface-soft)] data-[state=checked]:text-[var(--brand-primary)]",
                  )}
                >
                  <Select.ItemText>
                    <span className="font-medium">{backend.label}</span>
                  </Select.ItemText>
                  {backend.description && (
                    <span className="mt-0.5 text-xs text-[var(--text-muted)] data-[state=checked]:text-[var(--accent-text)]">
                      {backend.description}
                    </span>
                  )}
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
