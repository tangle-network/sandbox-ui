import {
  harnessSupportsModel,
  snapModelToHarness as snapModelIdToHarness,
  type HarnessType,
} from "@tangle-network/agent-interface";
import { canonicalModelId, type ModelInfo } from "../dashboard/model-picker";

/**
 * Harness ↔ model compatibility for the chat pickers.
 *
 * The policy itself — which models a harness can run, which native harness a
 * model belongs to, and how to snap an incompatible pair — lives in
 * `@tangle-network/agent-interface`, the single source of truth shared with the
 * cli-bridge backends and the router. This module is a thin UI adapter: it
 * re-exports the canonical helpers and maps the picker's catalog shape
 * (`ModelInfo[]`) down to the canonical ids the snap functions rank over, so
 * the pickers never hand-roll a divergent copy of the policy.
 */

export { modelProvider, snapHarnessToModel } from "@tangle-network/agent-interface";

/**
 * Whether `harness` can run `modelId`. Router-backed harnesses, and provider-less
 * sentinel ids (like "default" or an empty selection — "the session's own
 * configuration"), are compatible with everything.
 */
export function isModelCompatibleWithHarness(
  harness: HarnessType,
  modelId: string,
): boolean {
  return harnessSupportsModel(harness, modelId);
}

/**
 * Keeps `modelId` when the harness can run it; otherwise returns the harness's
 * best compatible model from the loaded catalog (preferred patterns in order,
 * highest version within a pattern). Adapts the picker's `ModelInfo[]` to the
 * canonical id list `agent-interface` ranks over; when the catalog holds nothing
 * compatible the original id is returned unchanged.
 */
export function snapModelToHarness(
  harness: HarnessType,
  modelId: string,
  models: ReadonlyArray<ModelInfo>,
): string {
  return snapModelIdToHarness(harness, modelId, models.map(canonicalModelId));
}
