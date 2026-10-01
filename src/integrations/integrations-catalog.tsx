"use client";

import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, EmptyState,
} from "@tangle-network/ui/primitives";
import { cn, focusFieldWithin, focusRing } from "@tangle-network/ui/utils";
import { Check, ExternalLink, MoreVertical, Search, Unplug } from "lucide-react";
import { ProviderIcon } from "./provider-logo";
import type {
  IntegrationDisplayConnection, IntegrationsCatalogProps, IntegrationsCatalogRow,
  IntegrationsProviderRow, IntegrationTone,
} from "./types";

const TONES: Record<IntegrationTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-[var(--surface-success-text)]",
  warning: "text-[var(--surface-warning-text)]",
  error: "text-destructive",
};
export function catalogRowActive(row: IntegrationsCatalogRow): boolean {
  return row.kind === "app" ? row.installedCount > 0 : row.connections.length > 0;
}

/** A controlled selector shared by the catalog and detail; never picks an account. */
export function ConnectionSelector({ connections, value, onChange, label }: {
  connections: readonly IntegrationDisplayConnection[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
}) {
  const selected = connections.some((connection) => connection.id === value) ? value : "";
  return (
    <select
      aria-label={label}
      value={selected ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn("h-8 w-full min-w-0 truncate rounded-md border border-border bg-background px-2 text-sm text-foreground", focusRing)}
    >
      <option value="">Select an account</option>
      {connections.map((connection) => (
        <option key={connection.id} value={connection.id}>
          {connection.accountDisplay ? `${connection.accountDisplay} · ${connection.id}` : connection.id}
        </option>
      ))}
    </select>
  );
}

function ConnectionMenu({ row, connection, onManage, onDisconnect, compact }: {
  compact: boolean;
  row: IntegrationsProviderRow;
  connection: IntegrationDisplayConnection;
  onManage: IntegrationsCatalogProps["onManage"];
  onDisconnect: IntegrationsCatalogProps["onDisconnect"];
}) {
  const manage = connection.capabilities.manage && (connection.manageHref || onManage);
  const disconnect = connection.capabilities.disconnect && onDisconnect;
  const actions = connection.actions ?? [];
  if (!manage && !disconnect && actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-testid={`menu-${row.providerId}`}
          aria-label={`More actions for ${row.title}`} title="More actions"
          className={cn("relative z-20 flex shrink-0 items-center justify-center rounded-md transition-colors", compact ? "h-6 w-6 text-muted-foreground/70 hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground" : "h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground", focusRing)}>
          <MoreVertical className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="min-w-[160px] rounded-md">
        {manage && (connection.manageHref ? (
          <DropdownMenuItem asChild>
            <a href={connection.manageHref}
              target={connection.manageInNewWindow ? "_blank" : undefined}
              rel={connection.manageInNewWindow ? "noopener noreferrer" : undefined}
              data-testid={`manage-item-${row.providerId}`}>
              <ExternalLink className="mr-2 h-4 w-4" /> Manage
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem data-testid={`manage-item-${row.providerId}`} onSelect={() => onManage?.(connection, row)}>
            <ExternalLink className="mr-2 h-4 w-4" /> Manage
          </DropdownMenuItem>
        ))}
        {actions.map((action) => (
          <DropdownMenuItem key={action.id} disabled={action.disabled} onSelect={action.onSelect}>
            {action.label}
          </DropdownMenuItem>
        ))}
        {disconnect && (manage || actions.length > 0) ? <DropdownMenuSeparator /> : null}
        {disconnect ? (
          <DropdownMenuItem data-testid={`disconnect-${row.providerId}`} className="text-destructive focus:text-destructive"
            onSelect={() => onDisconnect?.(connection, row)}>
            <Unplug className="mr-2 h-4 w-4" /> Disconnect
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Platform's catalog presentation, with app-owned state, destinations and effects. */
export function IntegrationsCatalog({
  rows, query, onQueryChange, categoryFilter = "", onCategoryFilterChange,
  sort, onSortChange, onSelectConnection, onConnect, onManage, onDisconnect,
  onRequestIntegration, onRetry, loading = false, error, actionError, connectError,
  busyProviderId, skeletonCount, emptyCatalogLabel = "No integrations are available to connect yet.",
  title, description, layout = "cards", className,
}: IntegrationsCatalogProps) {
  const compact = layout === "tiles";
  const categories = [...new Set(rows.flatMap((row) => row.category ? [row.category] : []))].sort();
  const q = query.trim().toLowerCase();
  const filtered = rows.filter((row) =>
    (!categoryFilter || row.category === categoryFilter) &&
    (!q || `${row.title} ${row.providerId} ${row.description ?? ""}`.toLowerCase().includes(q)),
  );
  const hiddenActive = rows.filter((row) => catalogRowActive(row) && !filtered.includes(row)).length;
  const state = error ? "error" : loading && rows.length === 0 ? "loading" : rows.length === 0 ? "empty" : "loaded";
  const gridClass = compact
    ? "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
    : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";
  const boxClass = compact
    ? "flex min-w-0 aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center"
    : "flex min-w-0 min-h-[200px] flex-col gap-3 rounded-xl border p-4 text-left";
  const headerClass = cn("flex w-full min-w-0 gap-2", compact ? "flex-col items-center" : "items-start gap-3");
  const clearFilters = () => { onQueryChange(""); onCategoryFilterChange?.(""); };

  return (
    <section className={cn("w-full min-w-0 space-y-4", className)}
      aria-label={title ?? "Integrations"} aria-busy={loading}
      data-testid={state === "loading" ? "integrations-skeleton" : "integrations-panel"}
      data-catalog-state={state}>
      {title ? <header><h2 className="text-lg font-semibold">{title}</h2>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</header> : null}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 py-2", focusFieldWithin)}>
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input type="text" value={query} onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Search integrations" placeholder="Search integrations..." autoFocus={compact}
            data-testid="integration-search" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        {onCategoryFilterChange ? (
          <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value)}
            className={cn("h-10 min-w-0 rounded-lg border bg-card px-3 text-sm", focusRing)}>
            <option value="">All categories</option>
            {categoryFilter && !categories.includes(categoryFilter) ? <option value={categoryFilter}>{categoryFilter}</option> : null}
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        ) : null}
        {sort && onSortChange ? (
          <div role="group" aria-label="Sort integrations" className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-1">
            {([ ["featured", "Featured"], ["alpha", "A–Z"] ] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={sort === value} onClick={() => onSortChange(value)} data-testid={`sort-${value}`}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", focusRing, sort === value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {onRequestIntegration ? <Button variant="outline" onClick={() => onRequestIntegration(query.trim())}>Request an integration</Button> : null}
      </div>
      {actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}
      {connectError ? <p role="alert" data-testid="integration-connect-error" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{connectError}</p> : null}
      {(q || categoryFilter) && state === "loaded" ? <span role="status" className="sr-only">{filtered.length} matching integrations</span> : null}
      <div className={gridClass} data-testid="integrations-catalog-grid">
        {state === "loading" ? Array.from({ length: skeletonCount ?? (compact ? 12 : 6) }, (_, i) => (
          <div key={i} aria-hidden="true" className={cn(boxClass, "animate-pulse border-border bg-muted/40")}>
            <div className={headerClass}>
              <div className="shrink-0 rounded-2xl bg-muted" style={{ width: 48, height: 48 }} />
              <div className="flex h-8 w-full items-center justify-center"><div className="h-2.5 w-3/4 rounded bg-muted" /></div>
            </div>
            {!compact ? <><div className="h-8 w-full rounded bg-muted" /><div className="mt-auto h-9 border-t border-border" /></> : null}
          </div>
        )) : state === "error" ? (
          <div role="alert" className="col-span-full flex min-h-[200px] min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/40 bg-card p-6">
            <p className="break-words text-sm text-destructive">{error}</p>
            {onRetry ? <Button variant="outline" onClick={onRetry}>Retry</Button> : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full min-h-[200px] min-w-0 rounded-xl border border-border bg-card p-4">
            <EmptyState title={state === "empty" ? "No integrations" : "No matches"}
              description={state === "empty" ? emptyCatalogLabel : `No integrations match "${query.trim()}".`} />
            {(q || categoryFilter) ? <div className="flex flex-col items-center gap-2">
              {hiddenActive > 0 ? <p className="text-sm text-muted-foreground">{hiddenActive} active integrations are hidden by your filters.</p> : null}
              <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
            </div> : null}
          </div>
        ) : filtered.map((row) => {
          const provider = row.kind === "provider" ? row : undefined;
          const connection = provider?.connections.find((item) => item.id === provider.selectedConnectionId);
          const active = catalogRowActive(row);
          const canConnect = provider?.canConnect && onConnect;
          const connecting = busyProviderId === row.providerId;
          const wholeButton = !active && !!canConnect && !row.to;
          const Box = wholeButton ? "button" : "div";
          const manageHref = connection?.capabilities.manage ? connection.manageHref : undefined;
          const header = (
            <div className={headerClass}>
              <ProviderIcon id={row.kind === "app" ? row.logoProviderId : row.providerId}
                iconUrl={row.iconUrl} displayName={row.title} size={48} className="rounded-2xl" />
              <div className="flex h-8 w-full min-w-0 flex-col justify-center leading-4">
                {row.to ? <a href={row.to} className={cn("relative z-20 truncate text-sm font-medium hover:underline", focusRing)}>{row.title}</a> :
                  <span className={cn("w-full font-medium text-foreground", compact ? "text-xs" : "text-sm", connection?.accountDisplay ? "truncate" : "line-clamp-2")}>{row.title}</span>}
                {connection?.accountDisplay ? <span className="w-full truncate text-[11px] leading-4 text-muted-foreground" data-testid={`account-${row.providerId}`}>{connection.accountDisplay}</span> : null}
              </div>
            </div>
          );
          return (
            <Box key={`${row.kind}:${row.providerId}`} type={wholeButton ? "button" : undefined}
              data-testid={`integration-${row.providerId}`} data-connected={active ? "true" : "false"}
              data-connecting={connecting ? "true" : undefined} aria-busy={connecting || undefined}
              disabled={wholeButton ? connecting : undefined}
              onClick={wholeButton ? () => provider && onConnect?.(provider) : undefined}
              title={connection?.accountDisplay ? `${row.title} — ${connection.accountDisplay}` : row.description}
              className={cn(boxClass, "group relative", compact && active ? "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)]" : "border-border bg-card", wholeButton && cn("transition-all hover:border-[var(--border-strong)] hover:bg-accent/40 hover:shadow-sm", focusRing), connection?.detail && compact && "w-full min-h-[136px]")}>
              {compact && manageHref ? <a href={manageHref} target={connection?.manageInNewWindow ? "_blank" : undefined}
                rel={connection?.manageInNewWindow ? "noopener noreferrer" : undefined}
                aria-label={`Manage ${row.title}${connection?.manageInNewWindow ? " (opens in new window)" : ""}`}
                data-testid={`manage-${row.providerId}`} className={cn("absolute inset-0 z-10 rounded-xl", focusRing)} /> : null}
              {compact && active ? <span className="pointer-events-none absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-success-text)] text-white"><Check className="h-3 w-3" strokeWidth={3} /></span> : null}
              {header}
              {provider && (provider.connections.length > 1 || (active && !connection)) ? (
                <div className="relative z-20 w-full min-w-0">
                  <ConnectionSelector connections={provider.connections} value={provider.selectedConnectionId}
                    onChange={(id) => onSelectConnection(row.providerId, id)} label={`Account for ${row.title}`} />
                </div>
              ) : null}
              {connection?.detail ? <span className="w-full truncate text-[11px] leading-4 text-muted-foreground" title={connection.detail}>{connection.detail}</span> : null}
              {!compact ? <p className={cn("min-h-8 text-sm", TONES[connection?.statusTone ?? "neutral"])}>
                {row.kind === "app" ? (row.installedCount ? `Installed · ${row.installedCount} ${row.installedCount === 1 ? "account" : "accounts"}` : "Not installed") :
                  connection?.statusLabel ?? (active ? `${provider?.connections.length} accounts · select one to manage` : "Not connected")}
              </p> : null}
              {!compact ? <div className="mt-auto flex min-h-9 items-center gap-2 border-t border-border pt-3">
                {row.kind === "app" ? <a href={row.to} className={cn("text-sm font-medium hover:underline", focusRing)}>{row.installedCount ? "Manage" : "Set up"}</a> :
                  !active && canConnect ? (wholeButton ? <span className="text-sm font-medium">{connecting ? "Connecting…" : "Connect"}</span> : <Button variant="outline" disabled={connecting} onClick={() => onConnect?.(row)}>{connecting ? "Connecting…" : "Connect"}</Button>) :
                  manageHref ? <a href={manageHref} target={connection?.manageInNewWindow ? "_blank" : undefined} rel={connection?.manageInNewWindow ? "noopener noreferrer" : undefined} data-testid={`manage-${row.providerId}`} className={cn("text-sm font-medium hover:underline", focusRing)}>Manage</a> :
                  connection?.capabilities.manage && onManage ? <Button variant="outline" onClick={() => onManage(connection, row)}>Manage</Button> : null}
                {provider && connection ? <div className="ml-auto"><ConnectionMenu compact={compact} key={connection.id} row={provider} connection={connection} onManage={onManage} onDisconnect={onDisconnect} /></div> : null}
              </div> : provider && connection ? <div className="absolute right-1.5 top-1.5 z-20"><ConnectionMenu compact={compact} key={connection.id} row={provider} connection={connection} onManage={onManage} onDisconnect={onDisconnect} /></div> : null}
            </Box>
          );
        })}
      </div>
    </section>
  );
}
