"use client";

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
} from "@tangle-network/ui/primitives";
import { cn } from "@tangle-network/ui/utils";
import { Check, ExternalLink, MoreVertical, Search, Unplug } from "lucide-react";
import {
  ProviderIcon,
  normalizeProviderId,
} from "./provider-logo";
import type {
  IntegrationConnection,
  IntegrationHealth,
  IntegrationProvider,
} from "./types";

export type IntegrationSort = "featured" | "alpha";

export interface IntegrationsPanelProps {
  catalog: IntegrationProvider[];
  connections: IntegrationConnection[];
  healthByConnectionId?: Record<string, IntegrationHealth>;
  isLoading?: boolean;
  error?: Error | null;
  /**
   * Invoked when the user clicks an unconnected provider tile. The consumer
   * should call its data hook's `connect(...)` action.
   */
  onConnect: (input: {
    providerId: string;
    connectorId: string;
  }) => void | Promise<void>;
  /**
   * Invoked when the user confirms disconnecting a live connection from the
   * disconnect control on a connected tile. May return a promise; the
   * confirmation dialog shows a loading state until it settles and surfaces a
   * thrown error inline.
   */
  onDisconnect: (connectionId: string) => void | Promise<void>;
  /**
   * Resolver for a connected app's management page URL. When it returns a URL,
   * the connected tile's body and the overflow menu's "Manage" item become a
   * real link opened in a new tab (so cmd/middle-click and "open in new tab"
   * work). Return undefined to omit Manage for a given connection. Preferred
   * over `onManage` — only fall back to the callback when the URL must be minted
   * imperatively on click (e.g. a one-time token).
   */
  getManageHref?: (connection: IntegrationConnection) => string | undefined;
  /**
   * Imperative fallback for opening a connected app's management page, used only
   * when `getManageHref` is not supplied (or returns undefined). The consumer is
   * responsible for opening the page (e.g. `window.open(...)`).
   */
  onManage?: (input: {
    connectionId: string;
    providerId: string;
  }) => void | Promise<void>;
  /** Empty-state message when the catalog hasn't loaded any providers. */
  emptyCatalogLabel?: string;
  /**
   * Provider ids surfaced first (in this order) before the rest are sorted
   * alphabetically. Matching is normalized (case / separators ignored).
   * Defaults to a curated list of common GTM/work providers.
   */
  featuredIds?: string[];
  /** Initial sort mode. Defaults to "featured". */
  defaultSort?: IntegrationSort;
  className?: string;
}

const DEFAULT_FEATURED_IDS = [
  "gmail",
  "google-sheets",
  "google-drive",
  "google-docs",
  "google-calendar",
  "outlook",
  "outlook-mail",
  "microsoft-calendar",
  "microsoft-excel",
  "microsoft-teams",
  "slack",
  "discord",
  "hubspot",
  "salesforce",
  "notion",
  "airtable",
  "github",
  "gitlab",
  "linear",
  "jira",
  "asana",
  "stripe",
  "stripe-pack",
  "twilio",
  "twilio-sms",
  "linkedin",
  "zoom",
  "shopify",
  "mailchimp",
  "zendesk",
  "intercom",
  "dropbox",
  "webhook",
];

function defaultConnectorOf(provider: IntegrationProvider): string {
  return provider.connectors?.[0]?.connectorId ?? provider.providerId;
}

// Single logo edge length shared by connected and unconnected tiles so the grid
// reads as one uniform set of brand marks (clears the top-corner check badge and
// disconnect control on connected tiles).
const LOGO_SIZE = 48;

function buildConnectionIndex(
  connections: IntegrationConnection[],
): Map<string, IntegrationConnection> {
  const index = new Map<string, IntegrationConnection>();
  for (const conn of connections) {
    if (conn.status === "revoked") continue;
    // Key on providerId when the connection carries no connectorId, matching
    // defaultConnectorOf's fallback so the lookup on the provider side hits.
    index.set(`${conn.providerId}:${conn.connectorId ?? conn.providerId}`, conn);
  }
  return index;
}

function makeFeaturedRank(featuredIds: string[]): Map<string, number> {
  const rank = new Map<string, number>();
  featuredIds.forEach((id, i) => {
    const norm = normalizeProviderId(id);
    if (!rank.has(id)) rank.set(id, i);
    if (!rank.has(norm)) rank.set(norm, i);
  });
  return rank;
}

function rankOf(
  provider: IntegrationProvider,
  rank: Map<string, number>,
): number {
  const raw = provider.providerId.toLowerCase();
  const direct = rank.get(raw);
  if (direct !== undefined) return direct;
  const norm = rank.get(normalizeProviderId(raw));
  return norm ?? Number.MAX_SAFE_INTEGER;
}

function displayNameOf(provider: IntegrationProvider): string {
  return provider.displayName ?? provider.providerId.replace(/[-_]/g, " ");
}

function matchesQuery(provider: IntegrationProvider, q: string): boolean {
  const hay = `${provider.displayName ?? ""} ${provider.providerId} ${
    provider.description ?? ""
  }`.toLowerCase();
  return hay.includes(q);
}

export function IntegrationsPanel({
  catalog,
  connections,
  healthByConnectionId,
  isLoading,
  error,
  onConnect,
  onDisconnect,
  getManageHref,
  onManage,
  emptyCatalogLabel = "No integrations available yet.",
  featuredIds = DEFAULT_FEATURED_IDS,
  defaultSort = "featured",
  className,
}: IntegrationsPanelProps) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<IntegrationSort>(defaultSort);
  // A connected tile's disconnect control sets this target, which opens the
  // confirmation dialog. A single controlled dialog serves every tile.
  const [disconnectTarget, setDisconnectTarget] = React.useState<{
    connectionId: string;
    name: string;
    accountDisplay?: string | null;
  } | null>(null);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [disconnectError, setDisconnectError] = React.useState<string | null>(
    null,
  );
  // Identity token for the in-flight disconnect, bumped whenever the dialog is
  // closed (cancel/escape) so a hung or superseded request can never mutate
  // state for a dialog the user has already left.
  const activeDisconnect = React.useRef(0);

  const connectionIndex = React.useMemo(
    () => buildConnectionIndex(connections),
    [connections],
  );
  const featuredRank = React.useMemo(
    () => makeFeaturedRank(featuredIds),
    [featuredIds],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? catalog.filter((p) => matchesQuery(p, q)) : catalog;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "featured") {
        const ra = rankOf(a, featuredRank);
        const rb = rankOf(b, featuredRank);
        if (ra !== rb) return ra - rb;
      }
      return displayNameOf(a).localeCompare(displayNameOf(b));
    });
    return sorted;
  }, [catalog, query, sort, featuredRank]);

  // Close (and reset) the disconnect dialog. Invalidating the token first means
  // an in-flight request that later settles is ignored — so the user can always
  // escape, even if onDisconnect hangs.
  const closeDisconnect = React.useCallback(() => {
    activeDisconnect.current += 1;
    setIsDisconnecting(false);
    setDisconnectTarget(null);
    setDisconnectError(null);
  }, []);

  // Connect is asynchronous and can fail — most commonly when the provider's
  // OAuth app has no credentials wired and the platform answers the start call
  // with 503. The click handler used to call `onConnect` without awaiting it,
  // so a rejection became an unhandled promise rejection: no pending state, no
  // message, a tile that visibly did nothing. Disconnect has surfaced its
  // errors inline since it was written; connect now does the same.
  const [connectingId, setConnectingId] = React.useState<string | null>(null);
  const [connectError, setConnectError] = React.useState<string | null>(null);
  const activeConnect = React.useRef(0);

  const startConnect = React.useCallback(
    async (input: { providerId: string; connectorId: string }) => {
      const reqId = (activeConnect.current += 1);
      setConnectError(null);
      let pending: void | Promise<void>;
      try {
        pending = onConnect(input);
      } catch (e) {
        // A consumer that throws synchronously is the same failure to the
        // user as one that rejects.
        setConnectError(
          e instanceof Error ? e.message : "Failed to start the connection.",
        );
        return;
      }
      // A synchronous consumer has already done its work — there is nothing to
      // wait on, so it gets no busy state and no extra render.
      if (typeof (pending as Promise<void> | undefined)?.then !== "function") {
        return;
      }
      setConnectingId(input.providerId);
      try {
        await pending;
        // On success the consumer navigates to the provider's consent screen,
        // so this component is usually unmounted before the next line runs.
      } catch (e) {
        if (activeConnect.current !== reqId) return;
        setConnectError(
          e instanceof Error ? e.message : "Failed to start the connection.",
        );
      } finally {
        if (activeConnect.current === reqId) setConnectingId(null);
      }
    },
    [onConnect],
  );

  const confirmDisconnect = React.useCallback(async () => {
    if (!disconnectTarget) return;
    const reqId = (activeDisconnect.current += 1);
    setIsDisconnecting(true);
    setDisconnectError(null);
    try {
      await Promise.resolve(onDisconnect(disconnectTarget.connectionId));
      if (activeDisconnect.current !== reqId) return; // cancelled/superseded
      // Close only on success; on failure keep the dialog open with the error.
      setDisconnectTarget(null);
    } catch (e) {
      if (activeDisconnect.current !== reqId) return;
      setDisconnectError(
        e instanceof Error ? e.message : "Failed to disconnect.",
      );
    } finally {
      if (activeDisconnect.current === reqId) setIsDisconnecting(false);
    }
  }, [disconnectTarget, onDisconnect]);

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
      <div
        className={cn(
          "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
          className,
        )}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-xl border border-border bg-muted/40"
          />
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

  const disconnectAccountLabel = disconnectTarget?.accountDisplay;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search integrations..."
            autoFocus
            data-testid="integration-search"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          role="tablist"
          aria-label="Sort integrations"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-1"
        >
          {(
            [
              ["featured", "Featured"],
              ["alpha", "A–Z"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={sort === value}
              onClick={() => setSort(value)}
              data-testid={`sort-${value}`}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                sort === value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {connectError ? (
        <div
          role="alert"
          data-testid="integration-connect-error"
          className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {connectError}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title="No matches"
          description={`No integrations match "${query.trim()}".`}
        />
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {visible.map((provider) => {
            const connectorId = defaultConnectorOf(provider);
            const live = connectionIndex.get(
              `${provider.providerId}:${connectorId}`,
            );
            const name = displayNameOf(provider);
            const connected = Boolean(live);

            if (connected && live) {
              const manageHref = getManageHref?.(live);
              const canManage = Boolean(manageHref) || Boolean(onManage);
              return (
                <div
                  key={`${provider.providerId}:${connectorId}`}
                  data-testid={`integration-${provider.providerId}`}
                  data-connected="true"
                  title={
                    live.accountDisplay
                      ? `${name} — ${live.accountDisplay}`
                      : name
                  }
                  className={cn(
                    "group relative flex min-w-0 aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center",
                    "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)]",
                  )}
                >
                  {/* Full-tile Manage link (when a manage URL is available): a
                      real anchor so cmd/middle-click and "open in new tab" work
                      and the navigation is honest to assistive tech. Layered
                      above the decorative content (z-10) but below the overflow
                      menu (z-20), so a body click manages while the kebab stays
                      clickable — siblings, never nested interactive elements. */}
                  {manageHref ? (
                    <a
                      href={manageHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Manage ${name} (opens in new window)`}
                      data-testid={`manage-${provider.providerId}`}
                      className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  ) : null}
                  <span className="pointer-events-none absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-success-text)] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {/* Decorative content — pointer-events-none so a click
                      anywhere on the body falls through to the Manage link. */}
                  <div className="pointer-events-none flex w-full min-w-0 flex-col items-center gap-2">
                    <ProviderIcon
                      id={provider.providerId}
                      iconUrl={provider.iconUrl}
                      displayName={provider.displayName}
                      size={LOGO_SIZE}
                      className="rounded-2xl"
                    />
                    {/* Fixed 2-line block on every tile keeps the grid uniform
                        (issue #2): with an account, the name takes one line and
                        the account the second; without, the name may wrap to two. */}
                    <div className="flex h-8 w-full flex-col justify-center leading-4">
                      <span
                        className={cn(
                          "w-full text-xs font-medium text-foreground",
                          live.accountDisplay ? "truncate" : "line-clamp-2",
                        )}
                      >
                        {name}
                      </span>
                      {live.accountDisplay ? (
                        <span
                          className="w-full truncate text-[11px] leading-4 text-muted-foreground"
                          data-testid={`account-${provider.providerId}`}
                        >
                          {live.accountDisplay}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {/* Overflow menu (above the Manage link) listing the explicit
                      actions. Always rendered so touch users — who have no hover —
                      can reach Manage/Disconnect, and so the destructive action
                      stays tucked behind a menu rather than a one-click target. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        data-testid={`menu-${provider.providerId}`}
                        aria-label={`More actions for ${name}`}
                        title="More actions"
                        className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    {/* Open beside the tile (top-aligned) rather than below it,
                        so the menu never covers the logo/name; flips to the left
                        on collision. rounded-md keeps it from over-rounding. */}
                    <DropdownMenuContent
                      side="right"
                      align="start"
                      className="min-w-[160px] rounded-md"
                    >
                      {manageHref ? (
                        <DropdownMenuItem asChild>
                          <a
                            href={manageHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`manage-item-${provider.providerId}`}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" /> Manage
                          </a>
                        </DropdownMenuItem>
                      ) : onManage ? (
                        <DropdownMenuItem
                          data-testid={`manage-item-${provider.providerId}`}
                          onClick={() =>
                            onManage({
                              connectionId: live.id,
                              providerId: provider.providerId,
                            })
                          }
                        >
                          <ExternalLink className="mr-2 h-4 w-4" /> Manage
                        </DropdownMenuItem>
                      ) : null}
                      {canManage ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        data-testid={`disconnect-${provider.providerId}`}
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setDisconnectTarget({
                            connectionId: live.id,
                            name,
                            accountDisplay: live.accountDisplay,
                          })
                        }
                      >
                        <Unplug className="mr-2 h-4 w-4" /> Disconnect
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            }

            return (
              <button
                key={`${provider.providerId}:${connectorId}`}
                type="button"
                data-testid={`integration-${provider.providerId}`}
                data-connected="false"
                data-connecting={
                  connectingId === provider.providerId ? "true" : undefined
                }
                disabled={connectingId === provider.providerId}
                aria-busy={connectingId === provider.providerId}
                onClick={() => {
                  void startConnect({
                    providerId: provider.providerId,
                    connectorId,
                  });
                }}
                title={
                  provider.description
                    ? provider.description
                    : `Connect ${name}`
                }
                className={cn(
                  "group flex min-w-0 aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-all",
                  "hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm focus:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
                )}
              >
                <ProviderIcon
                  id={provider.providerId}
                  iconUrl={provider.iconUrl}
                  displayName={provider.displayName}
                  size={LOGO_SIZE}
                  className="rounded-2xl"
                />
                <span className="line-clamp-2 h-8 w-full text-xs font-medium leading-4 text-foreground">
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open) closeDisconnect();
        }}
      >
        <DialogContent
          className="max-w-sm"
          // The trigger tile may re-render as unconnected after a successful
          // disconnect, so don't try to restore focus to a vanished element.
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              Disconnect {disconnectTarget?.name ?? "integration"}?
            </DialogTitle>
            <DialogDescription>
              This removes Sandbox&apos;s access to your{" "}
              {disconnectTarget?.name ?? "this"} account
              {disconnectAccountLabel ? ` (${disconnectAccountLabel})` : ""}. You
              can reconnect anytime.
            </DialogDescription>
          </DialogHeader>
          {disconnectError ? (
            <p className="text-sm text-destructive" role="alert">
              {disconnectError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDisconnect}
              data-testid="cancel-disconnect"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={isDisconnecting}
              onClick={confirmDisconnect}
              data-testid="confirm-disconnect"
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
