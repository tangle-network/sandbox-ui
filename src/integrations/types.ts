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
  connectorId: string;
  status: "connected" | "pending" | "revoked" | "expired" | (string & {});
  grantedScopes?: string[];
  account?: {
    identity?: string;
    displayName?: string;
  } & Record<string, unknown>;
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
