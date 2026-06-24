/**
 * Shapes for the integrations primitives. Mirrors the platform's
 * `/v1/integrations/*` response shape so consumers can pipe payloads
 * straight through. Defined here (rather than imported from
 * `@tangle-network/agent-runtime/platform`) so the UI package stays
 * leaf-level — no dependency on the server-side client.
 */

export interface IntegrationConnection {
  id: string;
  providerId: string;
  // Absent on provider-keyed hubs (no per-connector identity); matchers fall
  // back to providerId, mirroring defaultConnectorOf on the provider side.
  connectorId?: string;
  status: "connected" | "pending" | "revoked" | "expired" | (string & {});
  grantedScopes?: string[];
  // Human-readable identity of the connected account (e.g. "octocat" or
  // "test@gmail.com") as sent by the hub on each connection; null when the
  // provider exposes no per-account identity. Mirrors the platform hub
  // contract's `accountDisplay: string | null` field.
  accountDisplay?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IntegrationConnector {
  connectorId: string;
  displayName?: string;
  description?: string;
  scopes?: string[];
}

export interface IntegrationProvider {
  providerId: string;
  displayName?: string;
  description?: string;
  iconUrl?: string;
  connectors?: IntegrationConnector[];
}

export interface IntegrationHealth {
  connectionId: string;
  status: "ok" | "degraded" | "failing" | "unknown" | (string & {});
  checkedAt?: string;
  message?: string;
}
