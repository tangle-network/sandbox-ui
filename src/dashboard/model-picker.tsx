"use client";

import * as React from "react";
import { ChevronDown, Search, Sparkles, Zap, Brain, Star, Loader2 } from "lucide-react";
import * as Popover from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Wire-format model entry as returned by `/v1/models` on the Tangle Router
 * (and most OpenAI-compatible gateways). Field names match the upstream
 * response so consumers can pass `data.data` straight through.
 */
export interface ModelInfo {
  /** Provider-local id, e.g. "gpt-5.4" or "anthropic/claude-sonnet-4-6". */
  id: string;
  /** Human label (defaults to id if absent). */
  name?: string;
  /** Provider key, e.g. "openai", "anthropic". Underscored for compat with router. */
  _provider?: string;
  /** Alternative provider field on some gateways. */
  provider?: string;
  /**
   * Per-token prices in USD as decimal strings. Multiply by 1_000_000 for
   * the conventional $/M tokens display.
   */
  pricing?: { prompt?: string | null; completion?: string | null };
  context_length?: number;
  description?: string | null;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

/**
 * Curated preset bucket. Three are surfaced by default — they map to typical
 * cost/quality tradeoffs without forcing the consumer to pick a specific
 * model. `match` resolves the preset against the loaded model list.
 */
export interface ModelPreset {
  id: "fast" | "balanced" | "best" | string;
  label: string;
  hint: string;
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Pick the canonical model id for this preset given the loaded list.
   * Should return undefined if no acceptable model is loaded yet.
   */
  match: (models: ModelInfo[]) => string | undefined;
}

export type ModelPickerVariant = "field" | "pill";

export interface ModelPickerProps {
  /** Canonical model id (provider-prefixed, e.g. "openai/gpt-5.4"). */
  value: string;
  onChange: (modelId: string) => void;
  /** Models to choose from. Pass `[]` while loading. */
  models: ModelInfo[];
  /** Show the loading state (overrides empty-list copy). */
  loading?: boolean;

  /** Recently-used canonical ids to surface at the top. */
  recents?: ReadonlyArray<string>;
  /**
   * Curated presets shown above the full list. Defaults to Fast/Balanced/Best
   * resolved against common gpt-5/Claude families.
   */
  presets?: ReadonlyArray<ModelPreset>;
  /** Drop providers from the picker entirely (e.g. "audio", "embedding"). */
  excludeProviders?: ReadonlyArray<string>;
  /** Restrict to these architectures (e.g. ["text"]). Default: all. */
  modalities?: ReadonlyArray<string>;

  /** Trigger appearance. "field" = full-width form field; "pill" = inline chat input pill. */
  variant?: ModelPickerVariant;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the canonical id for a model. Some upstreams already prefix the
 * provider in the id (e.g. "anthropic/claude-haiku-4.5"); others put it in
 * `_provider` and leave the id bare. Always returns "<provider>/<model>"
 * unless the id is already prefixed.
 */
export function canonicalModelId(model: ModelInfo): string {
  const id = model.id;
  if (id.includes("/")) return id;
  const provider = model._provider ?? model.provider;
  return provider ? `${provider}/${id}` : id;
}

/** Format $/M tokens. Returns null if pricing is missing or zero. */
export function formatPricing(pricing: ModelInfo["pricing"]): string | null {
  const prompt = Number(pricing?.prompt ?? 0);
  const completion = Number(pricing?.completion ?? 0);
  if (!prompt && !completion) return null;
  const fmt = (n: number) => {
    const perM = n * 1_000_000;
    if (perM === 0) return "0";
    if (perM >= 1) return `$${perM.toFixed(2)}`;
    return `$${perM.toFixed(2)}`;
  };
  return `${fmt(prompt)} / ${fmt(completion)} per 1M`;
}

/** Format context length compactly (e.g. 200_000 → "200k"). */
export function formatContext(ctx: number | undefined): string | null {
  if (!ctx) return null;
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M ctx`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}k ctx`;
  return `${ctx} ctx`;
}

const DEFAULT_PRESETS: ReadonlyArray<ModelPreset> = [
  {
    id: "fast",
    label: "Fast",
    hint: "Cheapest, lowest latency",
    icon: Zap,
    match: (models) => {
      const ids = models.map(canonicalModelId);
      return (
        ids.find((m) => /gpt-5\.\d+-mini$/.test(m)) ??
        ids.find((m) => /gpt-5-mini$/.test(m)) ??
        ids.find((m) => m.endsWith("/claude-haiku-4.5")) ??
        ids.find((m) => /haiku/.test(m))
      );
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "Best value for most chat",
    icon: Sparkles,
    match: (models) => {
      const ids = models.map(canonicalModelId);
      return (
        ids.find((m) => /^openai\/gpt-5\.\d+$/.test(m)) ??
        ids.find((m) => /^openai\/gpt-5$/.test(m)) ??
        ids.find((m) => m.endsWith("/claude-sonnet-4-6")) ??
        ids.find((m) => /sonnet/.test(m))
      );
    },
  },
  {
    id: "best",
    label: "Best",
    hint: "Hardest reasoning, highest quality",
    icon: Brain,
    match: (models) => {
      const ids = models.map(canonicalModelId);
      return (
        ids.find((m) => /^openai\/gpt-5\.\d+-pro$/.test(m)) ??
        ids.find((m) => /^openai\/o3$/.test(m)) ??
        ids.find((m) => m.endsWith("/claude-opus-4-7")) ??
        ids.find((m) => /opus/.test(m))
      );
    },
  },
] as const;

// ── Component ──────────────────────────────────────────────────────────────

export function ModelPicker({
  value,
  onChange,
  models,
  loading = false,
  recents,
  presets = DEFAULT_PRESETS,
  excludeProviders,
  modalities,
  variant = "field",
  label = "Model",
  placeholder = "Choose a model",
  className,
  disabled,
}: ModelPickerProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  // Filter once per (models, query, modalities, excludeProviders) change.
  const filtered = React.useMemo(() => {
    const excluded = new Set((excludeProviders ?? []).map((p) => p.toLowerCase()));
    const allowedModalities = modalities ? new Set(modalities) : null;
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      const provider = (m._provider ?? m.provider ?? "").toLowerCase();
      if (excluded.has(provider)) return false;
      if (allowedModalities && m.architecture?.modality && !allowedModalities.has(m.architecture.modality)) return false;
      if (!q) return true;
      const id = canonicalModelId(m).toLowerCase();
      const name = (m.name ?? "").toLowerCase();
      return id.includes(q) || name.includes(q) || provider.includes(q);
    });
  }, [models, query, modalities, excludeProviders]);

  // Group filtered models by provider (preserves insertion order).
  const grouped = React.useMemo(() => {
    const groups = new Map<string, ModelInfo[]>();
    for (const m of filtered) {
      const provider = m._provider ?? m.provider ?? "other";
      const list = groups.get(provider);
      if (list) list.push(m);
      else groups.set(provider, [m]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Resolve the currently-selected model's display info.
  const current = React.useMemo(
    () => models.find((m) => canonicalModelId(m) === value),
    [models, value],
  );
  const currentLabel = current?.name ?? current?.id ?? value;

  const recentIds = React.useMemo(() => {
    if (!recents?.length) return [];
    const lookup = new Map(models.map((m) => [canonicalModelId(m), m]));
    return recents
      .map((id) => lookup.get(id))
      .filter((m): m is ModelInfo => Boolean(m))
      .slice(0, 4);
  }, [recents, models]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const trigger = variant === "pill" ? (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card",
        "px-2.5 py-1 text-xs font-medium text-foreground",
        "transition-colors duration-[var(--transition-fast)]",
        "hover:border-primary/30 hover:bg-accent/30",
        "focus:outline-none focus:border-primary/40",
        "data-[state=open]:border-primary/40 data-[state=open]:bg-accent/30",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      <Sparkles className="h-3 w-3 text-muted-foreground" />
      <span className="truncate max-w-[160px]">{currentLabel || placeholder}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
    </button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)]",
        "border border-border bg-card px-3 py-2.5 text-sm text-left",
        "transition-colors duration-[var(--transition-fast)]",
        "hover:border-primary/20 hover:bg-accent/30",
        "focus:outline-none focus:border-primary/30",
        "data-[state=open]:border-primary/30 data-[state=open]:bg-accent/30",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      <span className={cn("truncate", current ? "text-foreground font-medium" : "text-muted-foreground")}>
        {currentLabel || placeholder}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
    </button>
  );

  return (
    <div className={cn(variant === "field" ? "space-y-1.5" : "inline-flex", variant === "field" ? className : undefined)}>
      {variant === "field" && label && (
        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-[0.06em]">
          {label}
        </label>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={4}
            align={variant === "pill" ? "start" : "start"}
            className={cn(
              "z-50 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[320px] max-w-[460px]",
              "max-h-[440px] overflow-hidden flex flex-col",
              "rounded-[var(--radius-md)] border border-border bg-card shadow-[var(--shadow-dropdown)]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            {/* Search bar */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models..."
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Presets */}
              {!query && presets.length > 0 && (
                <Section label="Presets">
                  {presets.map((preset) => {
                    const Icon = preset.icon ?? Star;
                    const matchedId = preset.match(models);
                    if (!matchedId) return null;
                    const matched = models.find((m) => canonicalModelId(m) === matchedId);
                    const isCurrent = matchedId === value;
                    return (
                      <PickerItem
                        key={preset.id}
                        onSelect={() => handleSelect(matchedId)}
                        active={isCurrent}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{preset.label}</span>
                            <span className="text-[10px] text-muted-foreground truncate">→ {matched?.name ?? matchedId}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{preset.hint}</span>
                        </div>
                      </PickerItem>
                    );
                  })}
                </Section>
              )}

              {/* Recents */}
              {!query && recentIds.length > 0 && (
                <Section label="Recent">
                  {recentIds.map((m) => (
                    <ModelRow
                      key={`recent-${canonicalModelId(m)}`}
                      model={m}
                      active={canonicalModelId(m) === value}
                      onSelect={handleSelect}
                    />
                  ))}
                </Section>
              )}

              {/* Grouped list */}
              {grouped.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  {loading ? "Loading models..." : query ? "No models match." : "No models available."}
                </div>
              ) : (
                grouped.map(([provider, list]) => (
                  <Section key={provider} label={provider}>
                    {list.map((m) => (
                      <ModelRow
                        key={canonicalModelId(m)}
                        model={m}
                        active={canonicalModelId(m) === value}
                        onSelect={handleSelect}
                      />
                    ))}
                  </Section>
                ))
              )}
            </div>

            {/* Footer count */}
            <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              {filtered.length} of {models.length} model{models.length === 1 ? "" : "s"}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function PickerItem({
  onSelect,
  active,
  children,
}: {
  onSelect: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Popover.Item
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className={cn(
        "flex cursor-pointer items-start gap-2 px-3 py-2 outline-none",
        "transition-colors duration-[var(--transition-fast)]",
        "hover:bg-accent/40 focus:bg-accent/40",
        active && "bg-[var(--accent-surface-soft)] text-[var(--accent-text)]",
      )}
    >
      {children}
    </Popover.Item>
  );
}

function ModelRow({
  model,
  active,
  onSelect,
}: {
  model: ModelInfo;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const id = canonicalModelId(model);
  const pricing = formatPricing(model.pricing);
  const ctx = formatContext(model.context_length);

  return (
    <PickerItem onSelect={() => onSelect(id)} active={active}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium truncate">{model.name ?? model.id}</span>
          {ctx && <span className="shrink-0 text-[10px] text-muted-foreground">{ctx}</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{id}</span>
          {pricing && (
            <>
              <span className="shrink-0">·</span>
              <span className="shrink-0 font-mono">{pricing}</span>
            </>
          )}
        </div>
      </div>
    </PickerItem>
  );
}
