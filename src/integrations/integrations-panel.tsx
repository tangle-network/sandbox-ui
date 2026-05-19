"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
} from "@tangle-network/ui/primitives";
import { cn } from "@tangle-network/ui/utils";
import type {
  IntegrationConnection,
  IntegrationHealth,
  IntegrationProvider,
} from "./types";

export interface IntegrationsPanelProps {
  catalog: IntegrationProvider[];
  connections: IntegrationConnection[];
  healthByConnectionId?: Record<string, IntegrationHealth>;
  isLoading?: boolean;
  error?: Error | null;
  /**
   * Invoked when the user clicks "Connect" on a catalog tile. The
   * consumer should call its data hook's `connect(...)` action.
   */
  onConnect: (input: {
    providerId: string;
    connectorId: string;
  }) => void | Promise<void>;
  /** Invoked when the user clicks "Disconnect" on a live connection. */
  onDisconnect: (connectionId: string) => void | Promise<void>;
  /** Empty-state message when the catalog hasn't loaded any providers. */
  emptyCatalogLabel?: string;
  className?: string;
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "connected" || status === "ok") return "default";
  if (status === "pending") return "secondary";
  if (status === "revoked" || status === "expired" || status === "failing")
    return "destructive";
  return "outline";
}

function defaultConnectorOf(provider: IntegrationProvider): string {
  return provider.connectors?.[0]?.connectorId ?? provider.providerId;
}

function buildConnectionIndex(
  connections: IntegrationConnection[],
): Map<string, IntegrationConnection> {
  const index = new Map<string, IntegrationConnection>();
  for (const conn of connections) {
    if (conn.status === "revoked") continue;
    index.set(`${conn.providerId}:${conn.connectorId}`, conn);
  }
  return index;
}

export function IntegrationsPanel({
  catalog,
  connections,
  healthByConnectionId,
  isLoading,
  error,
  onConnect,
  onDisconnect,
  emptyCatalogLabel = "No integrations available yet.",
  className,
}: IntegrationsPanelProps) {
  const connectionIndex = React.useMemo(
    () => buildConnectionIndex(connections),
    [connections],
  );

  if (error) {
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">
            Failed to load integrations: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && catalog.length === 0) {
    return (
      <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-32 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-4 w-full rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (catalog.length === 0) {
    return (
      <EmptyState
        title="No integrations"
        description={emptyCatalogLabel}
        className={className}
      />
    );
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {catalog.map((provider) => {
        const connectorId = defaultConnectorOf(provider);
        const live = connectionIndex.get(`${provider.providerId}:${connectorId}`);
        const health = live ? healthByConnectionId?.[live.id] : undefined;
        const headline =
          provider.displayName ?? provider.providerId.replace(/[-_]/g, " ");
        return (
          <Card
            key={`${provider.providerId}:${connectorId}`}
            data-testid={`integration-${provider.providerId}`}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold capitalize text-foreground">
                    {headline}
                  </h3>
                  {live ? (
                    <Badge variant={statusVariant(live.status)} className="text-xs">
                      {live.status}
                    </Badge>
                  ) : null}
                </div>
                {provider.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {provider.description}
                  </p>
                ) : null}
              </div>
              {health ? (
                <Badge
                  variant={statusVariant(health.status)}
                  className="text-xs uppercase"
                >
                  {health.status}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              {live ? (
                <>
                  <span className="truncate text-xs text-muted-foreground">
                    {live.account?.displayName ??
                      live.account?.identity ??
                      "Connected"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDisconnect(live.id)}
                    data-testid={`disconnect-${provider.providerId}`}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    onConnect({ providerId: provider.providerId, connectorId })
                  }
                  data-testid={`connect-${provider.providerId}`}
                >
                  Connect
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
