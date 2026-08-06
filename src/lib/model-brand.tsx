"use client";

/**
 * A model's brand identity and its mark — the lab/host glyph, resolved from a
 * model id alone.
 *
 * Kept as a LEAF (no picker UI, no radix, no lucide) so a surface that only
 * draws the glyph — a workflow node, a run header — pulls in the marks and the
 * brand table, not any picker chrome. The `dashboard`, `workflows`, and
 * `pages` entries re-export the public names from here, so this module stays
 * internal.
 */

import type { ReasoningEffort } from "@tangle-network/agent-interface";
import { TangleKnot } from "@tangle-network/brand";
import { ProviderLogo } from "./provider-logo";
import { cn } from "./utils";
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
   * Marks a model as recommended. When any catalog row carries this flag a
   * picker can surface those rows in a "Recommended" section at the top.
   */
  featured?: boolean;
  /**
   * Per-model reasoning capability, fed to the reasoning-effort picker's capability filter. Source it
   * from your model catalog (e.g. the router's `supported_parameters` containing `reasoning`). When
   * `false`, only `none` is offered for this model regardless of harness.
   */
  supportsReasoning?: boolean;
  /** The model's own reasoning ceiling, if narrower than its harness's (e.g. a model capped at `high`). */
  maxReasoningEffort?: ReasoningEffort;
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

// ── Identity ───────────────────────────────────────────────────────────────

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

/**
 * The brand identity to show for a model id, or `null` when no published mark
 * exists for it — a caller then falls back to its own generic glyph rather than
 * rendering an empty chip or inventing a logo.
 *
 * Takes the bare id ("anthropic/claude-sonnet-4-5") so a surface that knows only
 * the model string — a workflow node, a run header — can render the same mark the
 * picker does.
 */
export function modelBrandFor(model: string): ModelBrandIdentity | null {
  const trimmed = model.trim();
  if (!trimmed) return null;
  const identity = resolveModelBrandIdentity({ id: trimmed });
  const real = hasRealLogo(identity.host) || hasRealLogo(identity.lab);
  return real ? identity : null;
}

// ── Marks ──────────────────────────────────────────────────────────────────

export function ModelBrandStack({ identity, size }: { identity: ModelBrandIdentity; size: "sm" | "md" }) {
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

export function BrandLogo({ brand, size, className }: { brand: ModelBrandInfo; size: "xs" | "sm" | "md"; className?: string }) {
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

export function normalizeBrandKey(value: string | undefined): ModelBrandKey {
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

export function brandInfo(key: ModelBrandKey): ModelBrandInfo {
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
