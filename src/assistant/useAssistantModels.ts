/**
 * The assistant's selectable models for the composer's picker. The list is
 * deployment config (not per-user), so it is fetched once and shared across
 * panel mounts via a module-level cache.
 *
 * The cache has no TTL: it lives for the page session and is revalidated by a
 * page refresh. That is acceptable for deployment-config data that changes only
 * on a redeploy — a TTL/poll would add machinery for a value that effectively
 * never changes within a session. (An empty/failed fetch is NOT cached, so it
 * retries on the next mount — see below.)
 *
 * Client-only by design. The app is a `createRoot` SPA (no React SSR — see
 * `main.tsx`), so these module-level singletons live in one browser tab and are
 * never shared across server requests. The list is deployment config, identical
 * for every user, so sharing it across an in-tab account switch is harmless.
 * Under React Strict Mode's double-mount the two effect runs share the one
 * in-flight fetch; the first run's `active = false` makes its callback a no-op,
 * the second commits the result — dedup holds, no torn state.
 */

import { useEffect, useState } from "react";
import type {
  AssistantModels,
  AssistantModelsResult,
} from "./client";
import { useAssistantClient } from "./client-context";

const EMPTY: AssistantModels = { default: null, models: [] };

let cache: AssistantModels | null = null;
let inflight: Promise<AssistantModelsResult> | null = null;

export function useAssistantModels(): AssistantModels {
  const client = useAssistantClient();
  const [models, setModels] = useState<AssistantModels>(() => cache ?? EMPTY);

  useEffect(() => {
    if (cache) return;
    let active = true;
    inflight ??= client.fetchModels();
    void inflight
      .then((result) => {
        // Cache a successful fetch (a well-formed, non-empty list). A failed
        // fetch OR an empty list (reported as !ok — the catalog was unavailable)
        // leaves the cache unset and releases the slot so the next mount retries
        // instead of serving an empty picker for the whole session.
        if (result.ok) cache = result.data;
        else inflight = null;
        if (active) setModels(result.data);
      })
      .catch(() => {
        // fetchModels swallows its own errors, so this only fires if a future
        // change lets it reject — release the slot so the next mount retries
        // instead of being wedged on a permanently-settled rejected promise.
        inflight = null;
      });
    return () => {
      active = false;
    };
  }, [client]);

  return models;
}
