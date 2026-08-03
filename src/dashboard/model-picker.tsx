"use client";

import * as React from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import * as Popover from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import {
  PickerMenuFooter,
  PickerMenuMeta,
  PickerMenuSearch,
  PickerMenuSection,
  PickerMenuTag,
  pickerMenuBodyClass,
  pickerMenuContentClass,
  pickerMenuItemClass,
} from "../lib/picker-menu";
import {
  BrandLogo,
  brandInfo,
  canonicalModelId,
  ModelBrandStack,
  normalizeBrandKey,
  resolveModelBrandIdentity,
  type ModelBrandIdentity,
  type ModelBrandKey,
  type ModelInfo,
} from "../lib/model-brand";

// A model's brand identity — the types, the brand table and the marks — lives in
// `lib/model-brand`, a leaf that carries no picker UI, so a surface that draws only
// the glyph (a workflow node, a run header) does not pull the picker in with it.
// Re-exported here so the names keep coming from `./dashboard`.
export {
  canonicalModelId,
  modelBrandFor,
  ModelBrandStack,
  resolveModelBrandIdentity,
  type ModelBrandIdentity,
  type ModelBrandInfo,
  type ModelBrandKey,
  type ModelInfo,
} from "../lib/model-brand";

// ── Types ──────────────────────────────────────────────────────────────────

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
   * Canonical model ids to surface in a "Popular" section above the full
   * list. Each id is resolved against `models`; ids not present in the
   * loaded catalog are silently skipped, so callers can pass a stable
   * curation list without worrying about provider availability.
   */
  popular?: ReadonlyArray<string>;
  /** Drop providers from the picker entirely (e.g. "audio", "embedding"). */
  excludeProviders?: ReadonlyArray<string>;
  /** Restrict to these architectures (e.g. ["text"]). Default: all. */
  modalities?: ReadonlyArray<string>;

  /** Trigger appearance. "field" = full-width form field; "pill" = inline chat input pill. */
  variant?: ModelPickerVariant;
  label?: string;
  placeholder?: string;
  className?: string;
  /**
   * Extra classes merged onto the trigger button itself (after the
   * built-in defaults, so callers can override sizing/radius/font to
   * match a surrounding form). Distinct from `className`, which on the
   * "field" variant styles the outer wrapper.
   */
  triggerClassName?: string;
  disabled?: boolean;
  /** Side the menu opens toward. Defaults to Radix's "bottom". */
  side?: Popover.DropdownMenuContentProps["side"];
  /**
   * Let Radix flip the menu to the opposite side when it would overflow the
   * viewport. Defaults to `true` (Radix default). Pass `false` to pin the menu
   * to `side` — e.g. a composer floating in open space that should always open
   * downward rather than flipping up over the heading.
   */
  avoidCollisions?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Stable key used to collapse catalog duplicates. The Tangle Router lists the
 * same underlying model under several host prefixes (e.g. `openai/gpt-5.4`,
 * `tcloud/gpt-5.4`, `openrouter/openai/gpt-5.4`); they all name one model and
 * should occupy a single row. The key is `<lab>/<model-id>`: the authoring lab
 * (inferred via {@link resolveModelBrandIdentity}, which already maps
 * `gpt-5.4` → openai, `kimi-k2` → moonshot, etc.) plus the final id segment,
 * so a model collapses to one identity regardless of which host serves it.
 */
export function modelDedupKey(model: ModelInfo): string {
  const canonical = canonicalModelId(model).toLowerCase();
  const segments = canonical.split("/").filter(Boolean);
  const modelId = segments[segments.length - 1] ?? canonical;
  const lab = resolveModelBrandIdentity(model).lab.key;
  // `unknown` lab → fall back to the full canonical id so unrelated unknown
  // models never accidentally collapse onto one another.
  return lab === "unknown" ? canonical : `${lab}/${modelId}`;
}

/**
 * Collapse catalog duplicates to one row per {@link modelDedupKey}. When a
 * model is served under multiple hosts the preferred row wins: a `featured`
 * row beats a non-featured one, otherwise the first occurrence is kept (so
 * caller-controlled catalog order still decides ties). Input order is
 * preserved for the surviving rows.
 */
export function dedupeModels(models: ReadonlyArray<ModelInfo>): ModelInfo[] {
  const byKey = new Map<string, number>();
  const result: ModelInfo[] = [];
  for (const model of models) {
    const key = modelDedupKey(model);
    const existingIndex = byKey.get(key);
    if (existingIndex === undefined) {
      byKey.set(key, result.length);
      result.push(model);
      continue;
    }
    const existing = result[existingIndex];
    if (!existing.featured && model.featured) {
      result[existingIndex] = model;
    }
  }
  return result;
}

/**
 * Fallback "Recommended" seed — latest frontier models per major lab, matched
 * by {@link modelDedupKey} against the loaded catalog. Used only when no
 * catalog row carries an explicit `featured` flag, so a standard router
 * catalog still gets a curated top section without per-deployment config.
 */
export const DEFAULT_FEATURED_MODEL_IDS: ReadonlyArray<string> = [
  "anthropic/claude-fable-5",
  "anthropic/claude-opus-5",
  "openai/gpt-5.6-sol",
  "google/gemini-3.1-pro-preview",
  "deepseek/deepseek-v4-flash",
];

/**
 * True when a catalog row can hold a text conversation — text goes in and
 * text comes out. Keys on the router's `architecture` fields:
 * `input_modalities` / `output_modalities` when present, otherwise the
 * compact `modality` string ("text->text", "text+image->text", or a bare tag
 * like "text" / "audio" / "multimodal"). A row with no modality metadata at
 * all is INCLUDED — absence of metadata is not evidence a model can't chat,
 * and silently hiding a servable model is worse than showing an exotic one.
 */
export function isTextChatModel(model: ModelInfo): boolean {
  const arch = model.architecture;
  if (!arch) return true;
  const inputs = arch.input_modalities;
  const outputs = arch.output_modalities;
  if (inputs?.length || outputs?.length) {
    // A missing side stays permissive; only an explicit non-text side excludes.
    const inOk = !inputs?.length || inputs.includes("text");
    const outOk = !outputs?.length || outputs.includes("text");
    return inOk && outOk;
  }
  const modality = arch.modality;
  if (!modality) return true;
  const arrow = modality.split("->");
  if (arrow.length === 2) {
    return (
      arrow[0].split("+").includes("text") && arrow[1].split("+").includes("text")
    );
  }
  // Bare tag: "text" and the router's catch-all "multimodal" chat; single-purpose
  // tags ("audio", "image", "embedding") do not.
  return modality === "text" || modality === "multimodal";
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

const PRIORITY_MODEL_GROUPS: ModelBrandKey[] = ["anthropic", "openai", "google", "deepseek", "zai", "moonshot"];

function modelGroupKey(model: ModelInfo): string {
  const identity = resolveModelBrandIdentity(model);
  if (identity.lab.key !== "unknown") return identity.lab.key;
  if (identity.host.key !== "unknown") return identity.host.key;
  return (model._provider ?? model.provider ?? "other").toLowerCase();
}

function modelGroupLabel(key: string): string {
  if (key === "moonshot") return "Kimi";
  const brand = brandInfo(normalizeBrandKey(key));
  return brand.key === "unknown" ? key : brand.label;
}

function modelGroupRank(key: string): number {
  const priorityIndex = PRIORITY_MODEL_GROUPS.indexOf(normalizeBrandKey(key));
  return priorityIndex === -1 ? Number.POSITIVE_INFINITY : priorityIndex;
}

function compareModelGroups(a: string, b: string): number {
  const aRank = modelGroupRank(a);
  const bRank = modelGroupRank(b);
  if (aRank !== bRank) return aRank - bRank;
  return modelGroupLabel(a).localeCompare(modelGroupLabel(b));
}

function compareModelsByDisplayName(a: ModelInfo, b: ModelInfo): number {
  return (a.name ?? a.id).localeCompare(b.name ?? b.id);
}

/**
 * Drop a leading lab/host label from a model name so it isn't repeated next to
 * the brand icon — but only when the name actually begins with that exact label
 * (e.g. "Anthropic: Claude 3 Haiku" → "Claude 3 Haiku"). Names without such a
 * prefix ("Gemini 2.5 Pro", "Claude Opus 4.8") are returned unchanged, so the
 * router's inconsistent naming can't produce a wrong result.
 */
export function stripBrandPrefix(
  name: string,
  identity: ModelBrandIdentity | null,
): string {
  if (!identity) return name;
  for (const label of [identity.lab.label, identity.host.label]) {
    if (!label) continue;
    if (name.toLowerCase().startsWith(label.toLowerCase())) {
      const after = name.slice(label.length);
      // Require a separator so e.g. lab "Meta" doesn't eat "Metamodel".
      if (/^[\s:]/.test(after)) {
        const rest = after.replace(/^[\s:]+/, "").trim();
        if (rest) return rest;
      }
    }
  }
  return name;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ModelPicker({
  value,
  onChange,
  models,
  loading = false,
  recents,
  popular,
  excludeProviders,
  modalities,
  variant = "pill",
  label = "Model",
  placeholder = "Choose a model",
  className,
  triggerClassName,
  disabled,
  side,
  avoidCollisions,
}: ModelPickerProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Collapse router duplicates (same model served under many host prefixes)
  // to a single row before any sectioning. Featured rows win the collapse.
  const deduped = React.useMemo(() => dedupeModels(models), [models]);

  // Catalog restrictions (provider / modality) apply to EVERY section —
  // Recommended, Popular, Recent and the grouped list alike — so an excluded
  // row can't sneak back in through a curated section. Rows with no modality
  // metadata pass the modality check (fail-open).
  const passesCatalogFilters = React.useMemo(() => {
    const excluded = new Set((excludeProviders ?? []).map((p) => p.toLowerCase()));
    const allowedModalities = modalities ? new Set(modalities) : null;
    return (m: ModelInfo) => {
      const provider = (m._provider ?? m.provider ?? "").toLowerCase();
      if (excluded.has(provider)) return false;
      if (allowedModalities && m.architecture?.modality && !allowedModalities.has(m.architecture.modality)) return false;
      return true;
    };
  }, [modalities, excludeProviders]);

  /** The selectable universe: deduped rows that pass the catalog filters. */
  const eligible = React.useMemo(
    () => deduped.filter(passesCatalogFilters),
    [deduped, passesCatalogFilters],
  );

  // Narrow further by the search query.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((m) => {
      const provider = (m._provider ?? m.provider ?? "").toLowerCase();
      const id = canonicalModelId(m).toLowerCase();
      const name = (m.name ?? "").toLowerCase();
      const identity = resolveModelBrandIdentity(m);
      return (
        id.includes(q) ||
        name.includes(q) ||
        provider.includes(q) ||
        identity.host.label.toLowerCase().includes(q) ||
        identity.lab.label.toLowerCase().includes(q)
      );
    });
  }, [eligible, query]);

  // Group filtered models by model family first, then by provider for
  // unknown labs. This keeps routed Claude/Gemini/Kimi rows where users
  // expect them while row metadata still shows the hosting provider.
  const grouped = React.useMemo(() => {
    const groups = new Map<string, ModelInfo[]>();
    for (const m of filtered) {
      const key = modelGroupKey(m);
      const list = groups.get(key);
      if (list) list.push(m);
      else groups.set(key, [m]);
    }
    return Array.from(groups.entries())
      .map(([key, list]) => [key, [...list].sort(compareModelsByDisplayName)] as const)
      .sort(([a], [b]) => compareModelGroups(a, b));
  }, [filtered]);

  // Resolve the currently-selected model's display info.
  const current = React.useMemo(
    () => models.find((m) => canonicalModelId(m) === value),
    [models, value],
  );
  const currentIdentity = current ? resolveModelBrandIdentity(current) : null;
  const currentLabel = stripBrandPrefix(
    current?.name ?? current?.id ?? value,
    currentIdentity,
  );

  const recentIds = React.useMemo(() => {
    if (!recents?.length) return [];
    const lookup = new Map(models.map((m) => [canonicalModelId(m), m]));
    return recents
      .map((id) => lookup.get(id))
      .filter((m): m is ModelInfo => Boolean(m))
      .filter(passesCatalogFilters)
      .slice(0, 4);
  }, [recents, models, passesCatalogFilters]);

  // Resolve the curated popular list against the loaded catalog. Order
  // is preserved from the caller so they control the row sequence;
  // ids that aren't currently served are silently dropped.
  const popularModels = React.useMemo(() => {
    if (!popular?.length) return [];
    const lookup = new Map(models.map((m) => [canonicalModelId(m), m]));
    return popular
      .map((id) => lookup.get(id))
      .filter((m): m is ModelInfo => Boolean(m))
      .filter(passesCatalogFilters);
  }, [popular, models, passesCatalogFilters]);

  // Recommended section. Prefer rows the catalog explicitly flags
  // `featured`; if none are flagged, fall back to the curated seed list
  // matched by dedup key against the loaded catalog. Either way the rows
  // come from `eligible`, so a selection here is a real catalog row that
  // also passes the caller's provider/modality restrictions.
  const featuredModels = React.useMemo(() => {
    const flagged = eligible.filter((m) => m.featured);
    if (flagged.length > 0) return flagged;
    const seedKeys = new Set(
      DEFAULT_FEATURED_MODEL_IDS.map((id) => modelDedupKey({ id })),
    );
    const seeded = eligible.filter((m) => seedKeys.has(modelDedupKey(m)));
    // Preserve the seed-list order so the recommended row sequence is stable.
    const order = DEFAULT_FEATURED_MODEL_IDS.map((id) => modelDedupKey({ id }));
    return seeded.sort(
      (a, b) => order.indexOf(modelDedupKey(a)) - order.indexOf(modelDedupKey(b)),
    );
  }, [eligible]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };
  const triggerLabel = label ? `${label}: ${currentLabel || placeholder}` : currentLabel || placeholder;

  const trigger = variant === "pill" ? (
    <button
      type="button"
      aria-label={triggerLabel}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--md3-outline-variant)] bg-surface-container",
        "px-3 text-sm font-medium text-foreground shadow-sm",
        "transition-colors duration-[var(--transition-fast)]",
        "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "data-[state=open]:border-[var(--md3-outline)] data-[state=open]:bg-surface-container-high",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
        triggerClassName,
      )}
    >
      {currentIdentity ? (
        <ModelBrandStack identity={currentIdentity} size="sm" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className="truncate max-w-[180px]">{currentLabel || placeholder}</span>
      <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
    </button>
  ) : (
    <button
      type="button"
      aria-label={triggerLabel}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)]",
        "border border-[var(--md3-outline-variant)] bg-surface-container px-3 py-2.5 text-sm text-left",
        "transition-colors duration-[var(--transition-fast)]",
        "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "data-[state=open]:border-[var(--md3-outline)] data-[state=open]:bg-surface-container-high",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
        triggerClassName,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {currentIdentity && <ModelBrandStack identity={currentIdentity} size="sm" />}
        <span className={cn("truncate", current ? "text-foreground font-medium" : "text-muted-foreground")}>
          {currentLabel || placeholder}
        </span>
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
      <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side={side}
            sideOffset={4}
            align={variant === "pill" ? "start" : "start"}
            avoidCollisions={avoidCollisions}
            collisionPadding={24}
            className={pickerMenuContentClass}
          >
            <PickerMenuSearch
              value={query}
              onChange={setQuery}
              placeholder="Search models..."
              loading={loading}
              inputRef={searchInputRef}
            />

            <div className={pickerMenuBodyClass}>
              {/* Recommended (catalog `featured` flag, or curated fallback) */}
              {!query && featuredModels.length > 0 && (
                <Section label="Recommended" tone="featured">
                  {featuredModels.map((m) => (
                    <ModelRow
                      key={`featured-${canonicalModelId(m)}`}
                      model={m}
                      active={canonicalModelId(m) === value}
                      onSelect={handleSelect}
                      featured
                    />
                  ))}
                </Section>
              )}

              {/* Popular */}
              {!query && popularModels.length > 0 && (
                <Section label="Top models" tone="featured">
                  {popularModels.map((m) => (
                    <ModelRow
                      key={`popular-${canonicalModelId(m)}`}
                      model={m}
                      active={canonicalModelId(m) === value}
                      onSelect={handleSelect}
                      featured
                    />
                  ))}
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
                grouped.map(([groupKey, list]) => (
                  <Section key={groupKey} label={modelGroupLabel(groupKey)}>
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

            <PickerMenuFooter>
              {filtered.length} of {eligible.length} model{eligible.length === 1 ? "" : "s"}
            </PickerMenuFooter>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

/**
 * Provider section header. The chrome comes from the shared picker-menu leaf so
 * this menu and the harness menu stay one family; only the brand glyph — which
 * is model-specific — is supplied here.
 */
function Section({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "featured" }) {
  const identity = brandInfo(normalizeBrandKey(label));
  return (
    <PickerMenuSection
      label={label}
      tone={tone}
      glyph={identity.key !== "unknown" ? <BrandLogo brand={identity} size="xs" /> : undefined}
    >
      {children}
    </PickerMenuSection>
  );
}

function PickerItem({
  onSelect,
  active,
  featured,
  children,
}: {
  onSelect: () => void;
  active?: boolean;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Popover.Item
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className={pickerMenuItemClass({ active, featured })}
    >
      {children}
    </Popover.Item>
  );
}

function ModelRow({
  model,
  active,
  onSelect,
  featured,
}: {
  model: ModelInfo;
  active: boolean;
  onSelect: (id: string) => void;
  featured?: boolean;
}) {
  const id = canonicalModelId(model);
  const pricing = formatPricing(model.pricing);
  const ctx = formatContext(model.context_length);
  const identity = resolveModelBrandIdentity(model);
  // The brand stack already renders host + lab logos. When a model is served
  // through a router (host ≠ lab), surface that once as a compact "via" tag
  // instead of repeating "Host → Lab" inside the subtitle.
  const via = !identity.combined ? identity.host.label : null;

  return (
    <PickerItem onSelect={() => onSelect(id)} active={active} featured={featured}>
      <ModelBrandStack identity={identity} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium">{model.name ?? model.id}</span>
          {via && <PickerMenuTag>via {via}</PickerMenuTag>}
        </div>
        <PickerMenuMeta
          parts={[ctx, pricing ? <span className="font-mono">{pricing}</span> : null]}
        />
      </div>
    </PickerItem>
  );
}
