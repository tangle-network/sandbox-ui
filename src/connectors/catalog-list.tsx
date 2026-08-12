"use client";

import { Button, EmptyState, Input } from "@tangle-network/ui/primitives";
import { Blocks, ChevronRight, Search } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils";
import type { ConnectorCatalogEntry } from "./types";

interface FilterOption {
  value: string;
  label: string;
}

function optionsFor(
  entries: ConnectorCatalogEntry[],
  pick: (
    entry: ConnectorCatalogEntry,
  ) => { value: string | null | undefined; label: string | null | undefined },
): FilterOption[] {
  const map = new Map<string, string>();
  for (const entry of entries) {
    const { value, label } = pick(entry);
    if (value) map.set(value, label ?? value);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function rowDetail(entry: ConnectorCatalogEntry): string {
  const parts: string[] = [];
  if (entry.category) parts.push(entry.categoryLabel ?? entry.category);
  if (entry.authKind) parts.push(entry.authKindLabel ?? entry.authKind);
  if (entry.actionCount != null) {
    parts.push(
      `${entry.actionCount} ${entry.actionCount === 1 ? "action" : "actions"}`,
    );
  }
  if (entry.triggerCount != null && entry.triggerCount > 0) {
    parts.push(
      `${entry.triggerCount} trigger ${
        entry.triggerCount === 1 ? "event" : "events"
      }`,
    );
  }
  return parts.join(" · ");
}

/** Neutral leading chip used when the host supplies no brand icon. */
function FallbackIcon() {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
      <Blocks className="size-5 text-muted-foreground" />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  ariaLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="rounded-lg border border-border bg-card px-3 py-2 text-foreground text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export interface ConnectorCatalogListProps {
  entries: ConnectorCatalogEntry[];
  /** Resolve the href for a connector's detail surface (rendered on each row's <a>). */
  getConnectorHref: (providerId: string) => string;
  /** SPA navigation: when provided, row clicks preventDefault and call this instead of following the href. */
  onOpenConnector?: (providerId: string) => void;
  /** Host-owned brand icon per provider (e.g. platform's HubProviderIcon); fallback is a neutral chip. */
  renderIcon?: (providerId: string) => ReactNode;
  /** "Request an integration" affordance, receives the current search text; button hidden when absent. */
  onRequestIntegration?: (prefill: string) => void;
  className?: string;
}

/**
 * Searchable/filterable browse list over every connector the host exposes.
 * Each row links into the connector's detail surface; connect/disconnect and
 * data fetching stay with the host — this list is for discovery.
 */
export function ConnectorCatalogList({
  entries,
  getConnectorHref,
  onOpenConnector,
  renderIcon,
  onRequestIntegration,
  className,
}: ConnectorCatalogListProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [authFilter, setAuthFilter] = useState("");

  const categoryOptions = useMemo(
    () =>
      optionsFor(entries, (e) => ({
        value: e.category,
        label: e.categoryLabel,
      })),
    [entries],
  );
  const authOptions = useMemo(
    () =>
      optionsFor(entries, (e) => ({
        value: e.authKind,
        label: e.authKindLabel,
      })),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (categoryFilter && entry.category !== categoryFilter) return false;
        if (authFilter && entry.authKind !== authFilter) return false;
        if (!q) return true;
        return (
          entry.title.toLowerCase().includes(q) ||
          entry.providerId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [entries, search, categoryFilter, authFilter]);

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setAuthFilter("");
  };

  // Drop a filter value that leaves the catalog on refetch — the dropdowns
  // only render with >1 option, so a stale selection could otherwise hide
  // every row with no on-screen control to reset it.
  useEffect(() => {
    if (categoryFilter && !categoryOptions.some((o) => o.value === categoryFilter)) {
      setCategoryFilter("");
    }
  }, [categoryOptions, categoryFilter]);
  useEffect(() => {
    if (authFilter && !authOptions.some((o) => o.value === authFilter)) {
      setAuthFilter("");
    }
  }, [authOptions, authFilter]);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      {entries.length > 0 && (
        <div className="border-border border-b p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[15rem] flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search connectors"
                aria-label="Search connectors"
                className="pl-8"
              />
            </div>
            {categoryOptions.length > 1 && (
              <FilterSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categoryOptions}
                allLabel="All categories"
                ariaLabel="Filter by category"
              />
            )}
            {authOptions.length > 1 && (
              <FilterSelect
                value={authFilter}
                onChange={setAuthFilter}
                options={authOptions}
                allLabel="All auth"
                ariaLabel="Filter by auth type"
              />
            )}
            <span
              role="status"
              aria-live="polite"
              className="text-muted-foreground text-sm"
            >
              {filtered.length} of {entries.length} connectors
            </span>
            {onRequestIntegration && (
              <button
                type="button"
                onClick={() => onRequestIntegration(search.trim())}
                // `--accent-text`, not `--primary`: the brand indigo is a FILL
                // colour (it carries white on a button). As text it measures
                // 1.79:1 on the dark card — far under the 4.5:1 body floor.
                className="text-[var(--accent-text)] text-sm transition-colors hover:underline"
              >
                Request an integration
              </button>
            )}
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title="No connectors"
          description="No connectors are available yet."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          description="No connectors match your filters."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
              {onRequestIntegration && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onRequestIntegration(search.trim())}
                >
                  Request {search.trim() ? `"${search.trim()}"` : "an integration"}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((entry) => (
            <li key={entry.providerId}>
              <a
                href={getConnectorHref(entry.providerId)}
                onClick={(e) => {
                  // Let the browser handle new-tab/new-window intents (modifier
                  // or non-primary click) via the real href; only intercept a
                  // plain left-click for SPA navigation.
                  if (
                    onOpenConnector &&
                    e.button === 0 &&
                    !e.metaKey &&
                    !e.ctrlKey &&
                    !e.shiftKey &&
                    !e.altKey
                  ) {
                    e.preventDefault();
                    onOpenConnector(entry.providerId);
                  }
                }}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-container-high"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {renderIcon ? renderIcon(entry.providerId) : <FallbackIcon />}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{entry.title}</p>
                    <p className="truncate text-muted-foreground text-sm">
                      {rowDetail(entry)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {entry.connected && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
                      <span className="size-2 rounded-full bg-[var(--surface-success-text)]" />
                      Connected
                    </span>
                  )}
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 text-muted-foreground"
                  />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
