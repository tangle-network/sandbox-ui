"use client";

import * as React from "react";
import type {
  IntegrationConnection,
  IntegrationHealth,
  IntegrationProvider,
} from "./types";

/**
 * Endpoint contract expected on the consumer app's server (which
 * wraps `PlatformHubClient` from `@tangle-network/agent-runtime/platform`):
 *
 *   GET    {base}/catalog
 *     → { catalog: { providers: IntegrationProvider[] } }
 *   GET    {base}/connections
 *     → { connections: IntegrationConnection[] }
 *   GET    {base}/healthchecks         (optional)
 *     → { healthchecks: IntegrationHealth[] }
 *   POST   {base}/auth/start
 *     body { providerId, connectorId, returnUrl, requestedScopes? }
 *     → { authorizationUrl: string }
 *   DELETE {base}/connections/{connectionId}
 *     → { connection: IntegrationConnection }
 */
export interface UseIntegrationsOptions {
  /** Base URL where the consumer mounted the integrations endpoints. */
  apiBaseUrl: string;
  /** Custom fetch (tests / non-browser runtimes). */
  fetchImpl?: typeof fetch;
  /** Whether the initial load happens automatically on mount. */
  autoLoad?: boolean;
  /** Refresh on visible focus/visibility return and persisted pageshow. Default: false. */
  refreshOnReturn?: boolean;
}

export interface UseIntegrationsResult {
  catalog: IntegrationProvider[];
  connections: IntegrationConnection[];
  healthByConnectionId: Record<string, IntegrationHealth>;
  isLoading: boolean;
  error: Error | null;
  /** Coalesces requests with at most one trailing refresh; resolves after the queue drains. */
  refresh: () => Promise<void>;
  /** Kick off OAuth — navigates on success; rejects with AbortError when its lifetime ends. */
  connect: (input: ConnectInput) => Promise<void>;
  /** Revoke by id and refresh; rejects with AbortError when its lifetime ends. */
  disconnect: (connectionId: string) => Promise<void>;
}

export interface ConnectInput {
  providerId: string;
  connectorId: string;
  /**
   * URL the platform redirects the user back to after OAuth. Must be
   * allow-listed on the platform.
   */
  returnUrl: string;
  requestedScopes?: string[];
}

interface RawEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string } | string;
}

function unwrap<T>(json: RawEnvelope<T> | T): T {
  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    (json as RawEnvelope<T>).data !== undefined
  ) {
    return (json as RawEnvelope<T>).data as T;
  }
  return json as T;
}

function cancellationError(): Error {
  return Object.assign(new Error("Integration lifetime ended"), { name: "AbortError" });
}

function assertActive(signal: AbortSignal): void {
  if (signal.aborted) throw cancellationError();
}

/** Also settle when a custom fetch or response body ignores AbortSignal. */
function whileActive<T>(signal: AbortSignal, start: () => Promise<T>): Promise<T> {
  if (signal.aborted) return Promise.reject(cancellationError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(cancellationError());
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve()
      .then(() => {
        assertActive(signal);
        return start();
      })
      .then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          if (signal.aborted) reject(cancellationError());
          else resolve(value);
        },
        (err: unknown) => {
          signal.removeEventListener("abort", onAbort);
          reject(signal.aborted ? cancellationError() : err);
        },
      );
  });
}

interface ActiveLifetime {
  signal: AbortSignal;
  refresh: () => Promise<void>;
}

export function useIntegrations({
  apiBaseUrl,
  fetchImpl,
  autoLoad = true,
  refreshOnReturn = false,
}: UseIntegrationsOptions): UseIntegrationsResult {
  const availableFetch = fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  if (!availableFetch) {
    throw new Error("useIntegrations: fetch is not available in this environment");
  }
  // Capture the narrowed type for nested named callbacks as well as closures.
  const fetcher = availableFetch;
  const base = apiBaseUrl.replace(/\/+$/, "");

  const [catalog, setCatalog] = React.useState<IntegrationProvider[]>([]);
  const [connections, setConnections] = React.useState<IntegrationConnection[]>([]);
  const [healthByConnectionId, setHealthByConnectionId] = React.useState<
    Record<string, IntegrationHealth>
  >({});
  const [isLoading, setIsLoading] = React.useState<boolean>(autoLoad);
  const [error, setError] = React.useState<Error | null>(null);

  // A retired callback must not bind to a later backend (including A -> B -> A).
  // Only effect setup activates this scope; abandoned renders do no work.
  const scope = React.useMemo<{ current: ActiveLifetime | null }>(
    () => ({ current: null }),
    [base, fetcher],
  );

  React.useEffect(() => {
    // Fresh on every setup, including Strict Mode's setup/cleanup/setup probe.
    const controller = new AbortController();
    const { signal } = controller;
    let running: Promise<void> | null = null;
    let pending = false;

    async function load(): Promise<void> {
      try {
        const [catalogRes, connectionsRes] = await whileActive(signal, () =>
          Promise.all([
            fetcher(`${base}/catalog`, { credentials: "include", signal }),
            fetcher(`${base}/connections`, { credentials: "include", signal }),
          ]),
        );
        if (!catalogRes.ok) {
          throw new Error(`Failed to load integration catalog (${catalogRes.status})`);
        }
        if (!connectionsRes.ok) {
          throw new Error(
            `Failed to load integration connections (${connectionsRes.status})`,
          );
        }
        const [catalogBody, connectionsBody] = await whileActive(signal, () =>
          Promise.all([catalogRes.json(), connectionsRes.json()]),
        );
        const catalogJson = unwrap<{
          catalog?: { providers?: IntegrationProvider[] };
          providers?: IntegrationProvider[];
        }>(catalogBody);
        const connectionsJson = unwrap<{ connections?: IntegrationConnection[] }>(
          connectionsBody,
        );
        assertActive(signal);
        setCatalog(catalogJson?.catalog?.providers ?? catalogJson?.providers ?? []);
        setConnections(connectionsJson?.connections ?? []);

        // Optional healthchecks never lock out POST/DELETE operations.
        try {
          const healthRes = await whileActive(signal, () =>
            fetcher(`${base}/healthchecks`, { credentials: "include", signal }),
          );
          if (healthRes.ok) {
            const healthJson = unwrap<{ healthchecks?: IntegrationHealth[] }>(
              await whileActive(signal, () => healthRes.json()),
            );
            const map: Record<string, IntegrationHealth> = {};
            for (const h of healthJson?.healthchecks ?? []) {
              map[h.connectionId] = h;
            }
            assertActive(signal);
            setHealthByConnectionId(map);
          }
        } catch {
          // Skip — non-fatal, including cancellation of this lifetime.
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    function scheduleRefresh(): Promise<void> {
      if (signal.aborted) return Promise.resolve();
      pending = true;
      if (!running) {
        setIsLoading(true);
        // Defer the first pass to coalesce same-turn triggers. During a pass,
        // any number of requests reserve just one trailing pass.
        running = Promise.resolve().then(async () => {
          try {
            while (pending && !signal.aborted) {
              pending = false;
              setError(null);
              await load();
            }
          } finally {
            // Clear in this continuation, not a later .finally microtask:
            // a new request after the drain must start a new worker.
            running = null;
            if (!signal.aborted) setIsLoading(false);
          }
        });
      }
      return running;
    }

    scope.current = { signal, refresh: scheduleRefresh };
    setCatalog([]);
    setConnections([]);
    setHealthByConnectionId({});
    setError(null);
    setIsLoading(false);
    return () => {
      scope.current = null;
      pending = false;
      controller.abort();
    };
  }, [base, fetcher, scope]);

  const refresh = React.useCallback(
    () => scope.current?.refresh() ?? Promise.resolve(),
    [scope],
  );

  React.useEffect(() => {
    if (autoLoad) void refresh();
  }, [autoLoad, refresh]);

  React.useEffect(() => {
    if (!refreshOnReturn || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const onReturn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      // Normal pageshow already has initial loading; bfcache restoration does not.
      if (event.persisted) onReturn();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refreshOnReturn, refresh]);

  const connect = React.useCallback(
    async (input: ConnectInput) => {
      const active = scope.current;
      if (!active) throw cancellationError();
      const { signal } = active;
      const res = await whileActive(signal, () =>
        fetcher(`${base}/auth/start`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal,
        }),
      );
      if (!res.ok) {
        const text = await whileActive(signal, () => res.text().catch(() => ""));
        assertActive(signal);
        throw new Error(`Failed to start OAuth (${res.status}): ${text}`);
      }
      const json = unwrap<{ authorizationUrl?: string }>(
        await whileActive(signal, () => res.json()),
      );
      assertActive(signal);
      if (!json?.authorizationUrl) {
        throw new Error("Platform did not return an authorizationUrl");
      }
      window.location.href = json.authorizationUrl;
    },
    [base, fetcher, scope],
  );

  const disconnect = React.useCallback(
    async (connectionId: string) => {
      const active = scope.current;
      if (!active) throw cancellationError();
      const { signal } = active;
      const res = await whileActive(signal, () =>
        fetcher(`${base}/connections/${encodeURIComponent(connectionId)}`, {
          method: "DELETE",
          credentials: "include",
          signal,
        }),
      );
      if (!res.ok) {
        const text = await whileActive(signal, () => res.text().catch(() => ""));
        assertActive(signal);
        throw new Error(`Failed to revoke connection (${res.status}): ${text}`);
      }
      // Only the follow-up read enters the scheduler; the mutation never holds
      // a queue slot while awaiting a nested refresh of that same queue.
      await whileActive(signal, active.refresh);
      assertActive(signal);
    },
    [base, fetcher, scope],
  );

  return {
    catalog,
    connections,
    healthByConnectionId,
    isLoading,
    error,
    refresh,
    connect,
    disconnect,
  };
}
