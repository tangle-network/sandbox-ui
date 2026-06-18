import type { HarnessType } from "../dashboard/harness-picker";
import { canonicalModelId, type ModelInfo } from "../dashboard/model-picker";

/**
 * Harness ↔ model compatibility policy.
 *
 * Native CLI harnesses are vendor-locked: claude-code only drives
 * Anthropic models, codex only OpenAI models. Router-backed harnesses
 * (opencode) accept any catalog model. The pickers use this policy to
 * keep the pair coherent: changing one side snaps the other to its
 * nearest compatible choice instead of letting the user assemble a
 * combination that fails at inference time.
 */
interface HarnessModelPolicy {
  /** Canonical-id provider prefixes the harness can run; null = any. */
  providers: ReadonlyArray<string> | null;
  /**
   * Patterns ranking snap targets, best first. Within one pattern's
   * matches the highest version (numeric-aware descending sort) wins,
   * so "latest standard frontier" stays correct as catalogs rotate.
   */
  preferred: ReadonlyArray<RegExp>;
}

// Partial over the canonical HarnessType: a harness with no policy is treated as router-backed
// (runs any model) — see `isModelCompatibleWithHarness`. Only vendor-locked harnesses need an entry.
export const HARNESS_MODEL_POLICIES: Partial<Record<HarnessType, HarnessModelPolicy>> =
  {
    opencode: { providers: null, preferred: [] },
    "claude-code": {
      providers: ["anthropic"],
      preferred: [
        /^anthropic\/claude-opus-[\d.-]+$/,
        /^anthropic\/claude-sonnet-[\d.-]+$/,
        /^anthropic\//,
      ],
    },
    codex: {
      providers: ["openai"],
      // Standard frontier tier first (gpt-N / gpt-N.N), then any gpt
      // variant (mini/nano), then anything OpenAI.
      preferred: [/^openai\/gpt-\d+(\.\d+)?$/, /^openai\/gpt/, /^openai\//],
    },
    amp: { providers: null, preferred: [] },
    "factory-droids": { providers: null, preferred: [] },
    "cli-base": { providers: null, preferred: [] },
    "kimi-code": {
      providers: ["moonshot"],
      preferred: [/^moonshot\//],
    },
    openclaw: { providers: null, preferred: [] },
    nanoclaw: { providers: null, preferred: [] },
    hermes: { providers: null, preferred: [] },
  };

/** Harness to adopt when the current one can't run the chosen model. */
const PROVIDER_PREFERRED_HARNESS: Record<string, HarnessType> = {
  anthropic: "claude-code",
  openai: "codex",
  moonshot: "kimi-code",
};

/** Provider prefix of a canonical id ("anthropic/claude-…" → "anthropic"). */
export function modelProvider(modelId: string): string | null {
  const slash = modelId.indexOf("/");
  return slash > 0 ? modelId.slice(0, slash) : null;
}

/**
 * Ids without a provider prefix (consumer sentinels like "default",
 * or an empty selection) are treated as compatible everywhere — they
 * mean "the session's own configuration", which every harness honors.
 */
export function isModelCompatibleWithHarness(
  harness: HarnessType,
  modelId: string,
): boolean {
  const policy = HARNESS_MODEL_POLICIES[harness];
  if (!policy || policy.providers === null) return true;
  const provider = modelProvider(modelId);
  if (!provider) return true;
  return policy.providers.includes(provider);
}

const numericDesc = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Keeps `modelId` when the harness can run it; otherwise returns the
 * harness's best compatible catalog model (preferred patterns in order,
 * highest version within a pattern). When the catalog holds nothing
 * compatible the original id is returned unchanged — the caller sees
 * the incompatibility instead of a silent wrong substitution.
 */
export function snapModelToHarness(
  harness: HarnessType,
  modelId: string,
  models: ReadonlyArray<ModelInfo>,
): string {
  if (isModelCompatibleWithHarness(harness, modelId)) return modelId;
  const ids = models.map(canonicalModelId);
  const policy = HARNESS_MODEL_POLICIES[harness];
  if (!policy) return modelId; // router-backed (no vendor lock) — handled by the early return above
  for (const pattern of policy.preferred) {
    const matches = ids
      .filter((id) => pattern.test(id))
      .sort((a, b) => numericDesc.compare(b, a));
    if (matches.length > 0) return matches[0];
  }
  const fallback = ids.find((id) =>
    isModelCompatibleWithHarness(harness, id),
  );
  return fallback ?? modelId;
}

/**
 * Keeps the harness when it can run `modelId`; otherwise returns the
 * model's native harness (anthropic → claude-code, openai → codex),
 * falling back to the router-backed opencode for everything else.
 */
export function snapHarnessToModel(
  harness: HarnessType,
  modelId: string,
): HarnessType {
  if (isModelCompatibleWithHarness(harness, modelId)) return harness;
  const provider = modelProvider(modelId);
  return (provider && PROVIDER_PREFERRED_HARNESS[provider]) || "opencode";
}
