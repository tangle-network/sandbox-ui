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
}

export interface UseIntegrationsResult {
  catalog: IntegrationProvider[];
  connections: IntegrationConnection[];
  healthByConnectionId: Record<string, IntegrationHealth>;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  /** Kick off OAuth — navigates the window on success. */
  connect: (input: ConnectInput) => Promise<void>;
  /** Revoke a connection by id; refreshes the connections list. */
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

export function useIntegrations({
  apiBaseUrl,
  fetchImpl,
  autoLoad = true,
}: UseIntegrationsOptions): UseIntegrationsResult {
  const fetcher = fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  if (!fetcher) {
    throw new Error("useIntegrations: fetch is not available in this environment");
  }
  const base = apiBaseUrl.replace(/\/+$/, "");

  const [catalog, setCatalog] = React.useState<IntegrationProvider[]>([]);
  const [connections, setConnections] = React.useState<IntegrationConnection[]>([]);
  const [healthByConnectionId, setHealthByConnectionId] = React.useState<
    Record<string, IntegrationHealth>
  >({});
  const [isLoading, setIsLoading] = React.useState<boolean>(autoLoad);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [catalogRes, connectionsRes] = await Promise.all([
        fetcher(`${base}/catalog`, { credentials: "include" }),
        fetcher(`${base}/connections`, { credentials: "include" }),
      ]);
      if (!catalogRes.ok) {
        throw new Error(`Failed to load integration catalog (${catalogRes.status})`);
      }
      if (!connectionsRes.ok) {
        throw new Error(
          `Failed to load integration connections (${connectionsRes.status})`,
        );
      }
      const catalogJson = unwrap<{
        catalog?: { providers?: IntegrationProvider[] };
        providers?: IntegrationProvider[];
      }>(await catalogRes.json());
      const providers =
        catalogJson?.catalog?.providers ?? catalogJson?.providers ?? [];
      setCatalog(providers);

      const connectionsJson = unwrap<{ connections?: IntegrationConnection[] }>(
        await connectionsRes.json(),
      );
      setConnections(connectionsJson?.connections ?? []);

      // Healthchecks are optional — don't fail the whole panel load
      // if the consumer hasn't wired them up.
      try {
        const healthRes = await fetcher(`${base}/healthchecks`, {
          credentials: "include",
        });
        if (healthRes.ok) {
          const healthJson = unwrap<{ healthchecks?: IntegrationHealth[] }>(
            await healthRes.json(),
          );
          const map: Record<string, IntegrationHealth> = {};
          for (const h of healthJson?.healthchecks ?? []) {
            map[h.connectionId] = h;
          }
          setHealthByConnectionId(map);
        }
      } catch {
        // Skip — non-fatal.
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [base, fetcher]);

  React.useEffect(() => {
    if (autoLoad) {
      void refresh();
    }
  }, [autoLoad, refresh]);

  const connect = React.useCallback(
    async (input: ConnectInput) => {
      const res = await fetcher(`${base}/auth/start`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to start OAuth (${res.status}): ${text}`);
      }
      const json = unwrap<{ authorizationUrl?: string }>(await res.json());
      if (!json?.authorizationUrl) {
        throw new Error("Platform did not return an authorizationUrl");
      }
      window.location.href = json.authorizationUrl;
    },
    [base, fetcher],
  );

  const disconnect = React.useCallback(
    async (connectionId: string) => {
      const res = await fetcher(
        `${base}/connections/${encodeURIComponent(connectionId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to revoke connection (${res.status}): ${text}`);
      }
      await refresh();
    },
    [base, fetcher, refresh],
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
