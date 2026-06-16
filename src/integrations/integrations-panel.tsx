"use client";

import * as React from "react";
import { Card, CardContent, EmptyState } from "@tangle-network/ui/primitives";
import { cn } from "@tangle-network/ui/utils";
import { Check, Search, Settings2 } from "lucide-react";
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
   * Invoked when the user manages (disconnects) a live connection via the
   * hover-revealed affordance on a connected tile.
   */
  onDisconnect: (connectionId: string) => void | Promise<void>;
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

function normalizeProviderId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-(business|oauth|api|app|mail|sms|pack|connector|v\d+)$/g, "");
}

/**
 * Curated map of provider ids → simpleicons slug. Covers cases where the
 * normalized id does not match the simpleicons slug (compound brands,
 * Google/Microsoft suite members, renamed brands).
 */
const PROVIDER_LOGO_SLUGS: Record<string, string> = {
  gmail: "gmail",
  googlemail: "gmail",
  google: "google",
  "google-drive": "googledrive",
  "google-calendar": "googlecalendar",
  "google-sheets": "googlesheets",
  "google-docs": "googledocs",
  "google-meet": "googlemeet",
  "google-forms": "googleforms",
  "google-ads": "googleads",
  "google-analytics": "googleanalytics",
  outlook: "microsoftoutlook",
  "outlook-mail": "microsoftoutlook",
  "microsoft-outlook": "microsoftoutlook",
  "microsoft-calendar": "microsoftoutlook",
  "microsoft-teams": "microsoftteams",
  teams: "microsoftteams",
  "microsoft-excel": "microsoftexcel",
  excel: "microsoftexcel",
  onedrive: "microsoftonedrive",
  sharepoint: "microsoftsharepoint",
  twitter: "x",
  x: "x",
  meta: "meta",
  "stripe-pack": "stripe",
  "twilio-sms": "twilio",
  webhook: "webhooks",
  webhooks: "webhooks",
  hubspot: "hubspot",
  salesforce: "salesforce",
  pipedrive: "pipedrive",
  zoho: "zoho",
  quickbooks: "quickbooks",
  intercom: "intercom",
  zendesk: "zendesk",
  freshdesk: "freshdesk",
  monday: "mondaydotcom",
  "monday-com": "mondaydotcom",
  clickup: "clickup",
  basecamp: "basecamp",
  todoist: "todoist",
  calendly: "calendly",
  typeform: "typeform",
  surveymonkey: "surveymonkey",
  klaviyo: "klaviyo",
  sendinblue: "brevo",
  brevo: "brevo",
  "constant-contact": "constantcontact",
  "active-campaign": "activecampaign",
  activecampaign: "activecampaign",
  "google-chat": "googlechat",
  whatsapp: "whatsapp",
  telegram: "telegram",
  bigquery: "googlebigquery",
  snowflake: "snowflake",
  postgres: "postgresql",
  postgresql: "postgresql",
  mysql: "mysql",
  mongodb: "mongodb",
  redis: "redis",
  supabase: "supabase",
  firebase: "firebase",
  "aws-s3": "amazons3",
  s3: "amazons3",
  woocommerce: "woocommerce",
  bigcommerce: "bigcommerce",
  squarespace: "squarespace",
  wix: "wix",
  webflow: "webflow",
  wordpress: "wordpress",
  contentful: "contentful",
  sanity: "sanity",
  figma: "figma",
  miro: "miro",
  confluence: "confluence",
  bitbucket: "bitbucket",
  pagerduty: "pagerduty",
  datadog: "datadog",
  sentry: "sentry",
  segment: "segment",
  amplitude: "amplitude",
  mixpanel: "mixpanel",
  posthog: "posthog",
  facebook: "facebook",
  instagram: "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
  reddit: "reddit",
  pinterest: "pinterest",
  buffer: "buffer",
  hootsuite: "hootsuite",
};

/**
 * Build the ordered list of candidate logo URLs for a provider, most
 * specific first. Renderer walks the chain on each onError until one loads,
 * then falls back to the monogram tile.
 */
function logoCandidates(provider: IntegrationProvider): string[] {
  const out: string[] = [];
  if (provider.iconUrl) out.push(provider.iconUrl);
  const raw = provider.providerId.toLowerCase();
  const norm = normalizeProviderId(raw);
  const slugs = new Set<string>();
  const curated = PROVIDER_LOGO_SLUGS[raw] ?? PROVIDER_LOGO_SLUGS[norm];
  if (curated) slugs.add(curated);
  // Derived slug: simpleicons slugs are the brand name with separators
  // stripped, lowercased. This covers the long tail (notion, airtable,
  // linear, asana, trello, dropbox, …) without an explicit map entry.
  slugs.add(norm.replace(/-/g, ""));
  slugs.add(raw.replace(/[-_\s]/g, ""));
  for (const slug of slugs) {
    if (slug) out.push(`https://cdn.simpleicons.org/${slug}`);
  }
  return out;
}

/** Deterministic accent color for the monogram fallback, keyed off the id. */
function monogramColor(seed: string): string {
  const palette = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#0ea5e9",
    "#3b82f6",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

function ProviderLogo({
  provider,
  size = 56,
}: {
  provider: IntegrationProvider;
  size?: number;
}) {
  const candidates = React.useMemo(() => logoCandidates(provider), [provider]);
  const [index, setIndex] = React.useState(0);
  const label = (provider.displayName ?? provider.providerId).trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  const src = candidates[index];

  if (!src) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-2xl font-semibold text-white"
        style={{
          width: size,
          height: size,
          backgroundColor: monogramColor(provider.providerId),
          fontSize: Math.round(size * 0.42),
        }}
        aria-hidden
      >
        {initial}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      onError={() => setIndex((i) => i + 1)}
    />
  );
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
  emptyCatalogLabel = "No integrations available yet.",
  featuredIds = DEFAULT_FEATURED_IDS,
  defaultSort = "featured",
  className,
}: IntegrationsPanelProps) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<IntegrationSort>(defaultSort);

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
              return (
                <div
                  key={`${provider.providerId}:${connectorId}`}
                  data-testid={`integration-${provider.providerId}`}
                  data-connected="true"
                  className={cn(
                    "group relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center",
                    "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)]",
                  )}
                >
                  <span className="absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-success-text)] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <button
                    type="button"
                    onClick={() => onDisconnect(live.id)}
                    data-testid={`manage-${provider.providerId}`}
                    aria-label={`Manage ${name}`}
                    title="Manage connection"
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                  <ProviderLogo provider={provider} size={48} />
                  <span className="line-clamp-2 w-full text-xs font-medium text-foreground">
                    {name}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={`${provider.providerId}:${connectorId}`}
                type="button"
                data-testid={`integration-${provider.providerId}`}
                data-connected="false"
                onClick={() =>
                  onConnect({ providerId: provider.providerId, connectorId })
                }
                title={
                  provider.description
                    ? provider.description
                    : `Connect ${name}`
                }
                className={cn(
                  "group flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-all",
                  "hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm focus:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
                )}
              >
                <ProviderLogo provider={provider} size={56} />
                <span className="line-clamp-2 w-full text-xs font-medium text-foreground">
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
