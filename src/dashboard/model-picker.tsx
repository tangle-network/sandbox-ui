"use client";

import * as React from "react";
import { TangleKnot } from "@tangle-network/brand";
import { ProviderLogo } from "./provider-logo";
import { ChevronDown, Search, Sparkles, Loader2 } from "lucide-react";
import * as Popover from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import ai21Logo from "@lobehub/icons-static-svg/icons/ai21.svg";
import alibabaLogo from "@lobehub/icons-static-svg/icons/alibaba.svg";
import anthropicLogo from "@lobehub/icons-static-svg/icons/anthropic.svg";
import azureLogo from "@lobehub/icons-static-svg/icons/azure.svg";
import bedrockLogo from "@lobehub/icons-static-svg/icons/bedrock.svg";
import cerebrasLogo from "@lobehub/icons-static-svg/icons/cerebras.svg";
import cohereLogo from "@lobehub/icons-static-svg/icons/cohere.svg";
import deepseekLogo from "@lobehub/icons-static-svg/icons/deepseek.svg";
import elevenlabsLogo from "@lobehub/icons-static-svg/icons/elevenlabs.svg";
import falLogo from "@lobehub/icons-static-svg/icons/fal.svg";
import fireworksLogo from "@lobehub/icons-static-svg/icons/fireworks.svg";
import googleLogo from "@lobehub/icons-static-svg/icons/google.svg";
import groqLogo from "@lobehub/icons-static-svg/icons/groq.svg";
import klingLogo from "@lobehub/icons-static-svg/icons/kling.svg";
import lumaLogo from "@lobehub/icons-static-svg/icons/luma.svg";
import metaLogo from "@lobehub/icons-static-svg/icons/meta.svg";
import mistralLogo from "@lobehub/icons-static-svg/icons/mistral.svg";
import moonshotLogo from "@lobehub/icons-static-svg/icons/moonshot.svg";
import openaiLogo from "@lobehub/icons-static-svg/icons/openai.svg";
import openrouterLogo from "@lobehub/icons-static-svg/icons/openrouter.svg";
import perplexityLogo from "@lobehub/icons-static-svg/icons/perplexity.svg";
import pikaLogo from "@lobehub/icons-static-svg/icons/pika.svg";
import replicateLogo from "@lobehub/icons-static-svg/icons/replicate.svg";
import runwayLogo from "@lobehub/icons-static-svg/icons/runway.svg";
import stabilityLogo from "@lobehub/icons-static-svg/icons/stability.svg";
import togetherLogo from "@lobehub/icons-static-svg/icons/together.svg";
import vertexLogo from "@lobehub/icons-static-svg/icons/vertexai.svg";
import xaiLogo from "@lobehub/icons-static-svg/icons/xai.svg";
import zaiLogo from "@lobehub/icons-static-svg/icons/zai.svg";

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
  /** Hosting company or router that serves the request. Defaults to `_provider` / `provider`. */
  hostProvider?: string;
  /** Lab/company that authored the model. Inferred from model id/name when omitted. */
  modelLab?: string;
  /** Optional explicit logo keys when provider/lab ids are not stable. */
  logos?: {
    host?: ModelBrandKey;
    lab?: ModelBrandKey;
    hostUrl?: string;
    labUrl?: string;
  };
  /**
   * Marks a model as recommended. When any catalog row carries this flag the
   * picker surfaces those rows in a "Recommended" section at the top. When no
   * row is flagged the picker falls back to {@link DEFAULT_FEATURED_MODEL_IDS}
   * (matched by dedup key) so the section is never empty for a router catalog.
   */
  featured?: boolean;
}

export type ModelBrandKey =
  | "ai21"
  | "alibaba"
  | "anthropic"
  | "azure"
  | "bedrock"
  | "cartesia"
  | "cerebras"
  | "cohere"
  | "deepseek"
  | "elevenlabs"
  | "fal"
  | "fireworks"
  | "google"
  | "groq"
  | "kuaishou"
  | "luma"
  | "meta"
  | "mistral"
  | "moonshot"
  | "openai"
  | "openrouter"
  | "perplexity"
  | "pika"
  | "replicate"
  | "runway"
  | "stability"
  | "tangle"
  | "tcloud"
  | "together"
  | "vertex"
  | "xai"
  | "zai"
  | "unknown";

export interface ModelBrandIdentity {
  host: ModelBrandInfo;
  lab: ModelBrandInfo;
  combined: boolean;
}

export interface ModelBrandInfo {
  key: ModelBrandKey;
  label: string;
  logoUrl?: string;
  logo?: "tangle";
  /**
   * True for the bundled single-color brand glyphs, which are rendered as a
   * CSS mask filled with the foreground token so they stay visible in both
   * themes. Caller-supplied logo URLs (`ModelInfo.logos.*Url`) may be
   * full-color artwork and are rendered as-is.
   */
  monochrome?: boolean;
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
  "anthropic/claude-opus-4-8",
  "anthropic/claude-sonnet-4-6",
  "openai/gpt-5.4",
  "google/gemini-2.5-pro",
  "deepseek/deepseek-v3",
];

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

export function resolveModelBrandIdentity(model: ModelInfo): ModelBrandIdentity {
  const canonical = canonicalModelId(model);
  const hostKey = normalizeBrandKey(model.logos?.host ?? model.hostProvider ?? model._provider ?? model.provider ?? firstIdSegment(canonical));
  const labKey = normalizeBrandKey(model.logos?.lab ?? model.modelLab ?? inferModelLab(model, canonical, hostKey));
  const hostBase = brandInfo(hostKey);
  const labBase = brandInfo(labKey);
  const host = model.logos?.hostUrl
    ? { ...hostBase, logoUrl: model.logos.hostUrl, monochrome: false }
    : hostBase;
  const lab = model.logos?.labUrl
    ? { ...labBase, logoUrl: model.logos.labUrl, monochrome: false }
    : labBase;
  return {
    host,
    lab,
    combined: host.key === lab.key,
  };
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
  variant = "field",
  label = "Model",
  placeholder = "Choose a model",
  className,
  triggerClassName,
  disabled,
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

  // Filter once per (deduped, query, modalities, excludeProviders) change.
  const filtered = React.useMemo(() => {
    const excluded = new Set((excludeProviders ?? []).map((p) => p.toLowerCase()));
    const allowedModalities = modalities ? new Set(modalities) : null;
    const q = query.trim().toLowerCase();
    return deduped.filter((m) => {
      const provider = (m._provider ?? m.provider ?? "").toLowerCase();
      if (excluded.has(provider)) return false;
      if (allowedModalities && m.architecture?.modality && !allowedModalities.has(m.architecture.modality)) return false;
      if (!q) return true;
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
  }, [deduped, query, modalities, excludeProviders]);

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
  const currentLabel = current?.name ?? current?.id ?? value;
  const currentIdentity = current ? resolveModelBrandIdentity(current) : null;

  const recentIds = React.useMemo(() => {
    if (!recents?.length) return [];
    const lookup = new Map(models.map((m) => [canonicalModelId(m), m]));
    return recents
      .map((id) => lookup.get(id))
      .filter((m): m is ModelInfo => Boolean(m))
      .slice(0, 4);
  }, [recents, models]);

  // Resolve the curated popular list against the loaded catalog. Order
  // is preserved from the caller so they control the row sequence;
  // ids that aren't currently served are silently dropped.
  const popularModels = React.useMemo(() => {
    if (!popular?.length) return [];
    const lookup = new Map(models.map((m) => [canonicalModelId(m), m]));
    return popular
      .map((id) => lookup.get(id))
      .filter((m): m is ModelInfo => Boolean(m));
  }, [popular, models]);

  // Recommended section. Prefer rows the catalog explicitly flags
  // `featured`; if none are flagged, fall back to the curated seed list
  // matched by dedup key against the loaded (deduped) catalog. Either way
  // the rows come from `deduped`, so a selection here is a real catalog row.
  const featuredModels = React.useMemo(() => {
    const flagged = deduped.filter((m) => m.featured);
    if (flagged.length > 0) return flagged;
    const seedKeys = new Set(
      DEFAULT_FEATURED_MODEL_IDS.map((id) => modelDedupKey({ id })),
    );
    const seeded = deduped.filter((m) => seedKeys.has(modelDedupKey(m)));
    // Preserve the seed-list order so the recommended row sequence is stable.
    const order = DEFAULT_FEATURED_MODEL_IDS.map((id) => modelDedupKey({ id }));
    return seeded.sort(
      (a, b) => order.indexOf(modelDedupKey(a)) - order.indexOf(modelDedupKey(b)),
    );
  }, [deduped]);

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
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card",
        "px-2.5 text-xs font-medium text-foreground shadow-sm",
        "transition-colors duration-[var(--transition-fast)]",
        "hover:border-primary/30 hover:bg-accent/30",
        "focus:outline-none focus:border-primary/40",
        "data-[state=open]:border-primary/40 data-[state=open]:bg-accent/30",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
        triggerClassName,
      )}
    >
      {currentIdentity ? (
        <ModelBrandStack identity={currentIdentity} size="sm" />
      ) : (
        <Sparkles className="h-3 w-3 text-muted-foreground" />
      )}
      <span className="truncate max-w-[160px]">{currentLabel || placeholder}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
    </button>
  ) : (
    <button
      type="button"
      aria-label={triggerLabel}
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
            <div className="flex items-center gap-2 border-b border-border bg-background/80 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Radix dropdown-menu Content has built-in typeahead: each
                  // character keydown that bubbles to the Content moves focus
                  // to a matching menu item (via setTimeout(item.focus())),
                  // which would steal focus from this search input as soon as
                  // the typed text matches any model. Stop printable keys at
                  // the input so the typeahead never sees them. Non-character
                  // keys (Escape, Arrow*, Tab, Enter) still propagate.
                  if (e.key.length === 1) e.stopPropagation();
                }}
                placeholder="Search models..."
                autoFocus
                className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
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

            {/* Footer count */}
            <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              {filtered.length} of {deduped.length} model{deduped.length === 1 ? "" : "s"}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function Section({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "featured" }) {
  const identity = brandInfo(normalizeBrandKey(label));
  return (
    <div className="py-1">
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 pt-1.5 pb-0.5 text-[10px] font-mono uppercase tracking-widest",
          tone === "featured" ? "text-primary" : "text-muted-foreground",
        )}
      >
        {identity.key !== "unknown" && <BrandLogo brand={identity} size="xs" />}
        <span>{label}</span>
      </div>
      <div>{children}</div>
    </div>
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
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 outline-none",
        "transition-colors duration-[var(--transition-fast)]",
        "hover:bg-accent/50 focus:bg-accent/50",
        featured && "mx-1 border border-primary/10 bg-primary/[0.04] px-2.5",
        active &&
          "bg-primary/10 font-medium text-foreground ring-1 ring-inset ring-primary/25 hover:bg-primary/15 focus:bg-primary/15",
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

  return (
    <PickerItem onSelect={() => onSelect(id)} active={active} featured={featured}>
      <ModelBrandStack identity={identity} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium truncate">{model.name ?? model.id}</span>
          {ctx && <span className="shrink-0 text-[10px] text-muted-foreground">{ctx}</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{id}</span>
          {!identity.combined && (
            <>
              <span className="shrink-0">·</span>
              <span className="shrink-0">{identity.host.label} → {identity.lab.label}</span>
            </>
          )}
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

function ModelBrandStack({ identity, size }: { identity: ModelBrandIdentity; size: "sm" | "md" }) {
  if (identity.combined) return <BrandLogo brand={identity.lab} size={size} />;
  const hasHostLogo = hasRealLogo(identity.host);
  const hasLabLogo = hasRealLogo(identity.lab);
  if (!hasHostLogo && !hasLabLogo) return null;
  if (!hasHostLogo) return <BrandLogo brand={identity.lab} size={size} />;
  if (!hasLabLogo) return <BrandLogo brand={identity.host} size={size} />;
  return (
    <div className={cn("relative shrink-0", size === "sm" ? "h-4 w-6" : "h-7 w-9")} aria-label={`${identity.host.label} hosting ${identity.lab.label}`}>
      <BrandLogo brand={identity.host} size={size === "sm" ? "xs" : "sm"} className="absolute left-0 top-0" />
      <BrandLogo brand={identity.lab} size={size === "sm" ? "xs" : "sm"} className="absolute bottom-0 right-0 ring-2 ring-card" />
    </div>
  );
}

/**
 * Provider keys for which the vendored {@link ProviderLogo} ships a real
 * full-color brand mark (vs. a tinted monogram). These render in color; every
 * other brand falls through to the bundled lobehub monochrome mask. Kept in
 * sync with provider-logo.tsx's LOGOS table.
 */
const COLOR_MARK_PROVIDERS: ReadonlySet<string> = new Set([
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "mistral",
  "xai",
  "nvidia",
  "meta",
  "moonshot",
]);

function BrandLogo({ brand, size, className }: { brand: ModelBrandInfo; size: "xs" | "sm" | "md"; className?: string }) {
  if (!hasRealLogo(brand)) return null;
  const pixelSize = size === "xs" ? 14 : size === "sm" ? 16 : 28;
  // Near-black marks (xai #000, moonshot #16191E) stay inside the light
  // `bg-background` ring chip so they remain visible against dark themes.
  const useColorMark =
    brand.logo !== "tangle" && COLOR_MARK_PROVIDERS.has(brand.key);
  return (
    <span
      title={brand.label}
      aria-label={brand.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-background shadow-sm ring-1 ring-border",
        size === "xs" && "h-3.5 w-3.5",
        size === "sm" && "h-4 w-4",
        size === "md" && "h-7 w-7",
        className,
      )}
    >
      {brand.logo === "tangle" ? (
        <TangleKnot size={pixelSize} className="h-full w-full" />
      ) : useColorMark ? (
        <ProviderLogo provider={brand.key} size={Math.round(pixelSize * 0.72)} />
      ) : brand.logoUrl && brand.monochrome ? (
        <span
          aria-hidden
          className="h-[72%] w-[72%]"
          style={{
            backgroundColor: "hsl(var(--foreground))",
            maskImage: cssUrl(brand.logoUrl),
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: cssUrl(brand.logoUrl),
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
      ) : brand.logoUrl ? (
        <img src={brand.logoUrl} alt="" className="h-[72%] w-[72%] object-contain" />
      ) : null}
    </span>
  );
}

function hasRealLogo(brand: ModelBrandInfo): boolean {
  return Boolean(brand.logoUrl || brand.logo);
}

/**
 * Wrap a URL for use inside a CSS `url("…")` value. The bundled SVG data
 * URLs contain raw quotes and hashes — valid in an <img src> attribute but
 * terminal inside a CSS string — so percent-encode the characters CSS
 * cannot carry.
 */
function cssUrl(url: string): string {
  return `url("${url.replace(/[\\"'#\n]/g, (char) => encodeURIComponent(char))}")`;
}

function modelLogo(path: string): string {
  return path;
}

function brandLogo(key: ModelBrandKey): string | undefined {
  switch (key) {
    case "ai21":
      return modelLogo(ai21Logo);
    case "alibaba":
      return modelLogo(alibabaLogo);
    case "anthropic":
      return modelLogo(anthropicLogo);
    case "azure":
      return modelLogo(azureLogo);
    case "bedrock":
      return modelLogo(bedrockLogo);
    case "cerebras":
      return modelLogo(cerebrasLogo);
    case "cohere":
      return modelLogo(cohereLogo);
    case "deepseek":
      return modelLogo(deepseekLogo);
    case "elevenlabs":
      return modelLogo(elevenlabsLogo);
    case "fal":
      return modelLogo(falLogo);
    case "fireworks":
      return modelLogo(fireworksLogo);
    case "google":
      return modelLogo(googleLogo);
    case "groq":
      return modelLogo(groqLogo);
    case "kuaishou":
      return modelLogo(klingLogo);
    case "luma":
      return modelLogo(lumaLogo);
    case "meta":
      return modelLogo(metaLogo);
    case "mistral":
      return modelLogo(mistralLogo);
    case "moonshot":
      return modelLogo(moonshotLogo);
    case "openai":
      return modelLogo(openaiLogo);
    case "openrouter":
      return modelLogo(openrouterLogo);
    case "perplexity":
      return modelLogo(perplexityLogo);
    case "pika":
      return modelLogo(pikaLogo);
    case "replicate":
      return modelLogo(replicateLogo);
    case "runway":
      return modelLogo(runwayLogo);
    case "stability":
      return modelLogo(stabilityLogo);
    case "together":
      return modelLogo(togetherLogo);
    case "vertex":
      return modelLogo(vertexLogo);
    case "xai":
      return modelLogo(xaiLogo);
    case "zai":
      return modelLogo(zaiLogo);
    case "tangle":
    case "tcloud":
    case "cartesia":
    case "unknown":
      return undefined;
  }
}

function brandMark(key: ModelBrandKey): Pick<ModelBrandInfo, "logo" | "logoUrl" | "monochrome"> {
  if (key === "tangle" || key === "tcloud") return { logo: "tangle" };
  const logoUrl = brandLogo(key);
  return logoUrl ? { logoUrl, monochrome: true } : {};
}

function inferModelLab(model: ModelInfo, canonical: string, hostKey: ModelBrandKey): string {
  const name = model.name ?? "";
  const idSegments = canonical.split("/");
  const possibleLab = normalizeBrandKey(idSegments.length > 1 ? idSegments[1] : idSegments[0]);
  const textKey = normalizeBrandKey(`${canonical} ${name}`);
  if (hostKey !== possibleLab && possibleLab !== "unknown") return possibleLab;
  if (textKey !== "unknown") return textKey;
  return hostKey;
}

function firstIdSegment(value: string): string {
  return value.split("/")[0] ?? value;
}

function normalizeBrandKey(value: string | undefined): ModelBrandKey {
  const normalized = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) return "unknown";
  if (/(^|-)anthropic($|-)|claude/.test(normalized)) return "anthropic";
  if (/(^|-)openai($|-)|(^|-)gpt-|o[1345]($|-)|chatgpt/.test(normalized)) return "openai";
  if (/(^|-)google($|-)|gemini|palm|imagen|veo/.test(normalized)) return "google";
  if (/(^|-)xai($|-)|grok/.test(normalized)) return "xai";
  if (/(^|-)meta($|-)|llama/.test(normalized)) return "meta";
  if (/(^|-)mistral($|-)|mixtral|codestral/.test(normalized)) return "mistral";
  if (/(^|-)cohere($|-)|command-r/.test(normalized)) return "cohere";
  if (/(^|-)deepseek($|-)/.test(normalized)) return "deepseek";
  if (/(^|-)moonshot($|-)|kimi/.test(normalized)) return "moonshot";
  if (/(^|-)zai($|-)|z-ai|glm/.test(normalized)) return "zai";
  if (/(^|-)qwen($|-)|alibaba|wan($|-)/.test(normalized)) return "alibaba";
  if (/(^|-)perplexity($|-)|sonar/.test(normalized)) return "perplexity";
  if (/(^|-)ai21($|-)|jamba/.test(normalized)) return "ai21";
  if (/(^|-)runway($|-)|gen-?[34]/.test(normalized)) return "runway";
  if (/(^|-)kling($|-)|kuaishou/.test(normalized)) return "kuaishou";
  if (/(^|-)luma($|-)|ray-?[12]/.test(normalized)) return "luma";
  if (/(^|-)pika($|-)/.test(normalized)) return "pika";
  if (/(^|-)stability($|-)|stable-diffusion|sdxl/.test(normalized)) return "stability";
  if (/(^|-)elevenlabs($|-)|eleven/.test(normalized)) return "elevenlabs";
  if (/(^|-)cartesia($|-)|sonic/.test(normalized)) return "cartesia";
  if (/(^|-)openrouter($|-)/.test(normalized)) return "openrouter";
  if (/(^|-)tcloud($|-)/.test(normalized)) return "tcloud";
  if (/(^|-)tangle($|-)/.test(normalized)) return "tangle";
  if (/(^|-)fal($|-)/.test(normalized)) return "fal";
  if (/(^|-)replicate($|-)/.test(normalized)) return "replicate";
  if (/(^|-)together($|-)/.test(normalized)) return "together";
  if (/(^|-)fireworks($|-)/.test(normalized)) return "fireworks";
  if (/(^|-)groq($|-)/.test(normalized)) return "groq";
  if (/(^|-)cerebras($|-)/.test(normalized)) return "cerebras";
  if (/(^|-)bedrock($|-)|amazon/.test(normalized)) return "bedrock";
  if (/(^|-)vertex($|-)/.test(normalized)) return "vertex";
  if (/(^|-)azure($|-)/.test(normalized)) return "azure";
  return "unknown";
}

function brandInfo(key: ModelBrandKey): ModelBrandInfo {
  return BRAND_INFO[key] ?? BRAND_INFO.unknown;
}

const BRAND_INFO: Record<ModelBrandKey, ModelBrandInfo> = {
  ai21: { key: "ai21", label: "AI21", ...brandMark("ai21") },
  alibaba: { key: "alibaba", label: "Alibaba", ...brandMark("alibaba") },
  anthropic: { key: "anthropic", label: "Anthropic", ...brandMark("anthropic") },
  azure: { key: "azure", label: "Azure", ...brandMark("azure") },
  bedrock: { key: "bedrock", label: "AWS Bedrock", ...brandMark("bedrock") },
  cartesia: { key: "cartesia", label: "Cartesia" },
  cerebras: { key: "cerebras", label: "Cerebras", ...brandMark("cerebras") },
  cohere: { key: "cohere", label: "Cohere", ...brandMark("cohere") },
  deepseek: { key: "deepseek", label: "DeepSeek", ...brandMark("deepseek") },
  elevenlabs: { key: "elevenlabs", label: "ElevenLabs", ...brandMark("elevenlabs") },
  fal: { key: "fal", label: "Fal", ...brandMark("fal") },
  fireworks: { key: "fireworks", label: "Fireworks", ...brandMark("fireworks") },
  google: { key: "google", label: "Google", ...brandMark("google") },
  groq: { key: "groq", label: "Groq", ...brandMark("groq") },
  kuaishou: { key: "kuaishou", label: "Kling", ...brandMark("kuaishou") },
  luma: { key: "luma", label: "Luma", ...brandMark("luma") },
  meta: { key: "meta", label: "Meta", ...brandMark("meta") },
  mistral: { key: "mistral", label: "Mistral", ...brandMark("mistral") },
  moonshot: { key: "moonshot", label: "Moonshot", ...brandMark("moonshot") },
  openai: { key: "openai", label: "OpenAI", ...brandMark("openai") },
  openrouter: { key: "openrouter", label: "OpenRouter", ...brandMark("openrouter") },
  perplexity: { key: "perplexity", label: "Perplexity", ...brandMark("perplexity") },
  pika: { key: "pika", label: "Pika", ...brandMark("pika") },
  replicate: { key: "replicate", label: "Replicate", ...brandMark("replicate") },
  runway: { key: "runway", label: "Runway", ...brandMark("runway") },
  stability: { key: "stability", label: "Stability AI", ...brandMark("stability") },
  tangle: { key: "tangle", label: "Tangle", ...brandMark("tangle") },
  tcloud: { key: "tcloud", label: "tcloud", ...brandMark("tcloud") },
  together: { key: "together", label: "Together", ...brandMark("together") },
  vertex: { key: "vertex", label: "Vertex AI", ...brandMark("vertex") },
  xai: { key: "xai", label: "xAI", ...brandMark("xai") },
  zai: { key: "zai", label: "Z.ai", ...brandMark("zai") },
  unknown: { key: "unknown", label: "Unknown" },
};
