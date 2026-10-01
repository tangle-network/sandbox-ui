"use client";

import * as React from "react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@tangle-network/ui/primitives";
import { IntegrationsCatalog } from "./integrations-catalog";
import { normalizeProviderId } from "./provider-logo";
import type {
  IntegrationConnection, IntegrationConnectionAction, IntegrationProvider,
  IntegrationSort, IntegrationsPanelProps, IntegrationsProviderRow,
} from "./types";

export type { IntegrationsPanelProps, IntegrationConnectionAction, IntegrationSort } from "./types";

const DEFAULT_FEATURED_IDS = [
  "gmail", "google-sheets", "google-drive", "google-docs", "google-calendar",
  "outlook", "outlook-mail", "microsoft-calendar", "microsoft-excel", "microsoft-teams",
  "slack", "discord", "hubspot", "salesforce", "notion", "airtable", "github", "gitlab",
  "linear", "jira", "asana", "stripe", "stripe-pack", "twilio", "twilio-sms", "linkedin",
  "zoom", "shopify", "mailchimp", "zendesk", "intercom", "dropbox", "webhook",
];
function defaultConnectorOf(provider: IntegrationProvider): string {
  return provider.connectors?.[0]?.connectorId ?? provider.providerId;
}
function displayNameOf(provider: IntegrationProvider): string {
  return provider.displayName ?? provider.title ?? provider.providerId.replace(/[-_]/g, " ");
}
function makeFeaturedRank(ids: string[]) {
  const rank = new Map<string, number>();
  ids.forEach((id, i) => {
    if (!rank.has(id)) rank.set(id, i);
    const normalized = normalizeProviderId(id);
    if (!rank.has(normalized)) rank.set(normalized, i);
  });
  return rank;
}
function rankOf(provider: IntegrationProvider, rank: Map<string, number>) {
  const raw = provider.providerId.toLowerCase();
  return rank.get(raw) ?? rank.get(normalizeProviderId(raw)) ?? Number.MAX_SAFE_INTEGER;
}

/** Compatibility facade: legacy effects/sorting, one controlled catalog renderer. */
export function IntegrationsPanel({
  catalog, connections, healthByConnectionId, isLoading, error, onConnect, onDisconnect,
  getManageHref, onManage, getConnectionContext, getConnectionActions,
  emptyCatalogLabel = "No integrations available yet.", featuredIds = DEFAULT_FEATURED_IDS,
  defaultSort = "featured", skeletonCount = 12, className,
}: IntegrationsPanelProps) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<IntegrationSort>(defaultSort);
  const [selected, setSelected] = React.useState<Record<string, string | null>>({});
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState(false);
  const [connectingId, setConnectingId] = React.useState<string | null>(null);
  const [connectError, setConnectError] = React.useState<string | null>(null);
  const activeConnect = React.useRef(0);
  const [disconnectTarget, setDisconnectTarget] = React.useState<{
    connection: IntegrationConnection; name: string;
  } | null>(null);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [disconnectError, setDisconnectError] = React.useState<string | null>(null);
  const activeDisconnect = React.useRef(0);

  React.useEffect(() => () => { activeConnect.current += 1; activeDisconnect.current += 1; }, []);

  const runConnectionAction = async (action: IntegrationConnectionAction) => {
    setActionError(null);
    setPendingAction(true);
    try { await action.onSelect(); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : "Could not update the connection."); }
    finally { setPendingAction(false); }
  };
  const startConnect = async (provider: IntegrationProvider) => {
    const request = ++activeConnect.current;
    setConnectError(null);
    let pending: void | Promise<void>;
    try { pending = onConnect({ providerId: provider.providerId, connectorId: defaultConnectorOf(provider) }); }
    catch (failure) {
      setConnectError(failure instanceof Error ? failure.message : "Failed to start the connection.");
      return;
    }
    if (typeof (pending as Promise<void> | undefined)?.then !== "function") return;
    setConnectingId(provider.providerId);
    try { await pending; }
    catch (failure) {
      if (activeConnect.current === request) setConnectError(failure instanceof Error ? failure.message : "Failed to start the connection.");
    } finally { if (activeConnect.current === request) setConnectingId(null); }
  };
  const closeDisconnect = React.useCallback(() => {
    activeDisconnect.current += 1;
    setIsDisconnecting(false);
    setDisconnectTarget(null);
    setDisconnectError(null);
  }, []);
  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    const request = ++activeDisconnect.current;
    setIsDisconnecting(true);
    setDisconnectError(null);
    try {
      await onDisconnect(disconnectTarget.connection.id);
      if (activeDisconnect.current === request) setDisconnectTarget(null);
    } catch (failure) {
      if (activeDisconnect.current === request) setDisconnectError(failure instanceof Error ? failure.message : "Failed to disconnect.");
    } finally { if (activeDisconnect.current === request) setIsDisconnecting(false); }
  };

  const rank = makeFeaturedRank(featuredIds);
  const ordered = [...catalog].sort((a, b) => {
    if (sort === "featured") {
      const delta = rankOf(a, rank) - rankOf(b, rank);
      if (delta) return delta;
    }
    return displayNameOf(a).localeCompare(displayNameOf(b));
  });
  const rows: IntegrationsProviderRow[] = ordered.map((provider) => {
    // Retain every non-revoked account, including non-default connectors.
    const live = connections.filter((connection) => connection.providerId === provider.providerId && connection.status !== "revoked");
    // Only an unambiguous single account may preserve the legacy direct action.
    // Once selection is explicit (even null/stale), removal never redirects it.
    const selectedId = Object.hasOwn(selected, provider.providerId)
      ? selected[provider.providerId] ?? null
      : live.length === 1 ? live[0]!.id : null;
    return {
      kind: "provider", providerId: provider.providerId, title: displayNameOf(provider),
      description: provider.description, iconUrl: provider.iconUrl, canConnect: true,
      selectedConnectionId: live.some((connection) => connection.id === selectedId) ? selectedId : null,
      connections: live.map((connection) => {
        const health = healthByConnectionId?.[connection.id];
        const manageHref = getManageHref?.(connection);
        return {
          id: connection.id, accountDisplay: connection.accountDisplay,
          statusLabel: health?.message ?? connection.status.replace(/_/g, " "),
          detail: getConnectionContext?.(connection), manageHref, manageInNewWindow: true,
          capabilities: { manage: Boolean(manageHref || onManage), disconnect: true },
          actions: (getConnectionActions?.(connection) ?? []).map((action) => ({
            id: action.id, label: action.label, disabled: action.disabled || pendingAction,
            onSelect: () => { void runConnectionAction(action); },
          })),
        };
      }),
    };
  });

  return <>
    <IntegrationsCatalog rows={rows} query={query} onQueryChange={setQuery}
      sort={sort} onSortChange={setSort} layout="tiles" loading={isLoading}
      error={error ? `Failed to load integrations: ${error.message}` : null}
      actionError={actionError} connectError={connectError} busyProviderId={connectingId}
      skeletonCount={skeletonCount} emptyCatalogLabel={emptyCatalogLabel} className={className}
      onSelectConnection={(providerId, id) => setSelected((current) => ({ ...current, [providerId]: id }))}
      onConnect={(row) => {
        const provider = catalog.find((item) => item.providerId === row.providerId);
        if (provider) void startConnect(provider);
      }}
      onManage={onManage ? (connection, row) => {
        void runConnectionAction({ id: "manage", label: "Manage", onSelect: () => onManage({ connectionId: connection.id, providerId: row.providerId }) });
      } : undefined}
      onDisconnect={(display, row) => {
        const connection = connections.find((item) => item.id === display.id && item.providerId === row.providerId && item.status !== "revoked");
        if (connection) setDisconnectTarget({ connection, name: row.title });
      }} />
    <Dialog open={!!disconnectTarget} onOpenChange={(open) => { if (!open) closeDisconnect(); }}>
      <DialogContent className="max-w-sm" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Disconnect {disconnectTarget?.name ?? "integration"}?</DialogTitle>
          <DialogDescription>
            This removes Sandbox&apos;s access to your {disconnectTarget?.name ?? "this"} account
            {disconnectTarget?.connection.accountDisplay ? ` (${disconnectTarget.connection.accountDisplay})` : ""}. You can reconnect anytime.
          </DialogDescription>
        </DialogHeader>
        {disconnectError ? <p className="text-sm text-destructive" role="alert">{disconnectError}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={closeDisconnect} data-testid="cancel-disconnect">Cancel</Button>
          <Button variant="destructive" loading={isDisconnecting} onClick={confirmDisconnect} data-testid="confirm-disconnect">Disconnect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
