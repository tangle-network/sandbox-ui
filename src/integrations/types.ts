import type { ReactNode } from "react";

/** Legacy endpoint shapes, retained for useIntegrations and IntegrationsPanel. */
export interface IntegrationConnection {
  id: string;
  providerId: string;
  /** Absent on provider-keyed hubs. */
  connectorId?: string;
  status: "connected" | "pending" | "revoked" | "expired" | (string & {});
  grantedScopes?: string[];
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
  title?: string;
  description?: string;
  iconUrl?: string;
  connectors?: IntegrationConnector[];
  eventIngressConfigured?: boolean;
}
export interface IntegrationHealth {
  connectionId: string;
  status: "ok" | "degraded" | "failing" | "unknown" | (string & {});
  checkedAt?: string;
  message?: string;
}
export type IntegrationSort = "featured" | "alpha";
export interface IntegrationConnectionAction {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}
export interface IntegrationsPanelProps {
  catalog: IntegrationProvider[];
  connections: IntegrationConnection[];
  healthByConnectionId?: Record<string, IntegrationHealth>;
  isLoading?: boolean;
  error?: Error | null;
  onConnect: (input: { providerId: string; connectorId: string }) => void | Promise<void>;
  /** Confirmation remains open on rejection; cancellation remains available in flight. */
  onDisconnect: (connectionId: string) => void | Promise<void>;
  /** Preferred over onManage. Legacy links retain their new-window behavior. */
  getManageHref?: (connection: IntegrationConnection) => string | undefined;
  onManage?: (input: { connectionId: string; providerId: string }) => void | Promise<void>;
  getConnectionContext?: (connection: IntegrationConnection) => string | undefined;
  getConnectionActions?: (connection: IntegrationConnection) => IntegrationConnectionAction[];
  emptyCatalogLabel?: string;
  /** Normalized provider IDs, in order, before the alphabetic tail. */
  featuredIds?: string[];
  defaultSort?: IntegrationSort;
  skeletonCount?: number;
  className?: string;
}

/** Display-only contracts. No Hub SDK, credentials, grants, or policy inference. */
export type IntegrationTone = "neutral" | "success" | "warning" | "error";
export interface IntegrationCapabilities {
  manage?: boolean;
  disconnect?: boolean;
  test?: boolean;
  editPermissions?: boolean;
  resetPermissions?: boolean;
}
export interface IntegrationDisplayAction {
  id: string;
  label: string;
  disabled?: boolean;
  /** The owner handles asynchronous outcomes and supplies updated display state. */
  onSelect: () => void;
}
export interface IntegrationDisplayConnection {
  id: string;
  accountDisplay?: string | null;
  statusLabel: string;
  statusTone?: IntegrationTone;
  /** Already formatted by the owner (last used, access context, etc.). */
  detail?: string;
  capabilities: IntegrationCapabilities;
  /** Consumer-owned destination; the library never builds a Platform URL. */
  manageHref?: string;
  /** Only needed by the legacy panel's existing link contract. */
  manageInNewWindow?: boolean;
  actions?: readonly IntegrationDisplayAction[];
}
export interface IntegrationDisplayProvider {
  providerId: string;
  title: string;
  description?: string;
  iconUrl?: string;
  category?: string | null;
  /** Optional local provider-information destination. */
  to?: string;
}
export interface IntegrationsProviderRow extends IntegrationDisplayProvider {
  kind: "provider";
  connections: readonly IntegrationDisplayConnection[];
  /** Explicit selection. null never selects an arbitrary account. */
  selectedConnectionId: string | null;
  canConnect: boolean;
  /** A display hint for the owner's connect callback, not an auth implementation. */
  authKind?: string | null;
}
export interface IntegrationsAppRow extends IntegrationDisplayProvider {
  kind: "app";
  logoProviderId: string;
  installedCount: number;
  to: string;
}
export type IntegrationsCatalogRow = IntegrationsProviderRow | IntegrationsAppRow;
export interface IntegrationsCatalogProps {
  /** Order belongs to the owner; filtering does not reorder active accounts. */
  rows: readonly IntegrationsCatalogRow[];
  query: string;
  onQueryChange: (query: string) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (category: string) => void;
  sort?: IntegrationSort;
  onSortChange?: (sort: IntegrationSort) => void;
  onSelectConnection: (providerId: string, connectionId: string | null) => void;
  onConnect?: (row: IntegrationsProviderRow) => void;
  onManage?: (connection: IntegrationDisplayConnection, row: IntegrationsProviderRow) => void;
  onDisconnect?: (connection: IntegrationDisplayConnection, row: IntegrationsProviderRow) => void;
  onRequestIntegration?: (prefill: string) => void;
  onRetry?: () => void;
  loading?: boolean;
  error?: string | null;
  actionError?: string | null;
  connectError?: string | null;
  busyProviderId?: string | null;
  skeletonCount?: number;
  emptyCatalogLabel?: string;
  title?: string;
  description?: string;
  /** One renderer; tiles preserves the public panel's compact geometry. */
  layout?: "cards" | "tiles";
  className?: string;
}
export interface IntegrationPermissionOption {
  value: string;
  label: string;
}
export interface IntegrationPermissionDisplay {
  actionPath: string;
  title: string;
  riskLabel: string;
  riskTone?: IntegrationTone;
  /** Supplied effective decision; null remains unknown, never Allow/Ask. */
  decision: string | null;
  decisionOptions: readonly IntegrationPermissionOption[];
  sourceLabel: string;
  canReset?: boolean;
  disabled?: boolean;
}
export interface IntegrationPermissionGroup {
  id: string;
  title: string;
  description?: string;
  collapsed?: boolean;
  rows: readonly IntegrationPermissionDisplay[];
}
export interface IntegrationConnectionDetails {
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  testResult?: { message: string; tone: IntegrationTone };
  permissionGroups?: readonly IntegrationPermissionGroup[];
}
export interface IntegrationConnectionDetailProps {
  provider: IntegrationDisplayProvider;
  connections: readonly IntegrationDisplayConnection[];
  selectedConnectionId: string | null;
  onSelectConnection: (connectionId: string | null) => void;
  /** Keying all outcomes by ID prevents another account's policy flashing on selection. */
  detailsByConnectionId: Readonly<Record<string, IntegrationConnectionDetails | undefined>>;
  loading?: boolean;
  error?: string | null;
  backHref?: string;
  description?: string;
  onRetry?: (connectionId: string | null) => void;
  onTestConnection?: (connectionId: string) => void;
  onDisconnect?: (connectionId: string) => void;
  onDecisionChange?: (connectionId: string, actionPath: string, decision: string) => void;
  onResetDecision?: (connectionId: string, actionPath: string) => void;
  className?: string;
}
export interface IntegrationParameterField {
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
}
export interface IntegrationConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  title: string;
  description?: string | null;
  busy?: boolean;
  error?: string | null;
  /** Caller owns validation, requests, failures and closing on success. */
  onSubmit: () => void;
  canSubmit?: boolean;
  /** Provider-specific fields/validation remain in the application. */
  children?: ReactNode;
}
export interface ApiKeyConnectDialogProps extends IntegrationConnectDialogProps {
  /** Transient controlled input only; never retained by this package. */
  value: string;
  onValueChange: (value: string) => void;
}
export interface OAuthConnectionParameterDialogProps extends IntegrationConnectDialogProps {
  parameters: readonly IntegrationParameterField[];
  values: Readonly<Record<string, string>>;
  onValueChange: (key: string, value: string) => void;
}
