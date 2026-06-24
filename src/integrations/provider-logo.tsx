/**
 * Provider branding: resolve a connector/provider slug to a logo and render it
 * with graceful fallbacks. Shared by the integrations catalog tiles and the
 * assistant's proposal card (its integration-requirement rows), so both surfaces
 * show the same brand mark for a given provider from one source of truth.
 *
 * Dependency-light on purpose — only React — so it can be pulled into the
 * always-loaded assistant entry without dragging the integrations panel's tree
 * along with it.
 */

import * as React from "react";

/** Strip separators and common suffixes so "Outlook-Mail" / "stripe_pack" map to
 *  a stable key for the curated slug table and the derived simpleicons slug. */
export function normalizeProviderId(id: string): string {
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
export const PROVIDER_LOGO_SLUGS: Record<string, string> = {
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
 * Full-color vector brand marks for providers Simple Icons has delisted over
 * trademark policy (Slack, Salesforce, the Microsoft 365 family, Twilio,
 * LinkedIn) — these 404 on the simpleicons CDN, so without a real source they
 * drop straight to the monogram. Keyed by the curated simpleicons slug AND by
 * common normalized ids; the value is an svgl.app library name (crisp,
 * multi-color SVGs that stay sharp in the catalog grid).
 */
export const PROVIDER_VECTOR_LOGOS: Record<string, string> = {
  slack: "slack",
  salesforce: "salesforce",
  microsoftoutlook: "microsoft-outlook",
  outlook: "microsoft-outlook",
  microsoftteams: "microsoft-teams",
  teams: "microsoft-teams",
  microsoftexcel: "microsoft-excel",
  excel: "microsoft-excel",
  microsoftonedrive: "microsoft-onedrive",
  onedrive: "microsoft-onedrive",
  microsoftsharepoint: "microsoft-sharepoint",
  sharepoint: "microsoft-sharepoint",
  twilio: "twilio",
  linkedin: "linkedin",
};

/**
 * Ordered candidate logo URLs for a provider slug, most specific first. The
 * renderer walks the chain on each `onError` until one loads, then falls back to
 * the monogram tile. An explicit `iconUrl` (when the caller has one) is tried
 * first, then full-color vector marks for brands Simple Icons dropped, then the
 * derived simpleicons slugs. Providers with no resolvable logo land on the
 * deterministic monogram tile in the renderer.
 */
export function providerLogoCandidates(opts: {
  id: string;
  iconUrl?: string | null;
}): string[] {
  const out: string[] = [];
  if (opts.iconUrl) out.push(opts.iconUrl);
  const raw = opts.id.toLowerCase();
  const norm = normalizeProviderId(raw);
  const curated = PROVIDER_LOGO_SLUGS[raw] ?? PROVIDER_LOGO_SLUGS[norm];
  // Vector mark for delisted brands first: simpleicons 404s for these, so trying
  // it first avoids a wasted failed request before the real logo loads.
  const vectorName =
    PROVIDER_VECTOR_LOGOS[raw] ??
    PROVIDER_VECTOR_LOGOS[norm] ??
    (curated ? PROVIDER_VECTOR_LOGOS[curated] : undefined);
  if (vectorName) out.push(`https://svgl.app/library/${vectorName}.svg`);
  const slugs = new Set<string>();
  if (curated) slugs.add(curated);
  // Derived slug: simpleicons slugs are the brand name with separators stripped,
  // lowercased. This covers the long tail (notion, airtable, linear, asana,
  // trello, dropbox, …) without an explicit map entry.
  slugs.add(norm.replace(/-/g, ""));
  slugs.add(raw.replace(/[-_\s]/g, ""));
  for (const slug of slugs) {
    if (slug) out.push(`https://cdn.simpleicons.org/${slug}`);
  }
  return out;
}

/** Deterministic accent color for the monogram fallback, keyed off the id. */
export function monogramColor(seed: string): string {
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

export interface ProviderIconProps {
  /** Provider/connector slug, e.g. "github". */
  id: string;
  /** Explicit icon URL, tried before the derived simpleicons slugs. */
  iconUrl?: string | null;
  /** Name for the monogram fallback initial; defaults to the id. */
  displayName?: string;
  /** Square edge length in px. Default 24. */
  size?: number;
  className?: string;
}

/**
 * A provider's brand mark: the resolved logo, walking a candidate chain on load
 * error, and a deterministic monogram tile when no logo resolves. Rounding is
 * left to the caller's `className` so the same component fits a large catalog
 * tile and a small inline requirement row.
 */
export function ProviderIcon({
  id,
  iconUrl,
  displayName,
  size = 24,
  className,
}: ProviderIconProps) {
  const candidates = React.useMemo(
    () => providerLogoCandidates({ id, iconUrl }),
    [id, iconUrl],
  );
  const [index, setIndex] = React.useState(0);
  // Reset the candidate cursor when the inputs that build the chain change, so an
  // instance reused for a different provider — or the same id with a new iconUrl —
  // doesn't strand on the prior chain's exhausted cursor (or the monogram).
  // Keyed on both `id` and `iconUrl` since both feed `providerLogoCandidates`.
  // React's "adjust state on prop change during render" pattern. The space
  // separator can't appear in a normalized slug or a URL, so the key is unambiguous.
  const candidateKey = `${id} ${iconUrl ?? ""}`;
  const [seenKey, setSeenKey] = React.useState(candidateKey);
  if (candidateKey !== seenKey) {
    setSeenKey(candidateKey);
    setIndex(0);
  }
  const label = (displayName ?? id).trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  const src = candidates[index];

  if (!src) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center font-semibold text-white ${className ?? ""}`}
        style={{
          width: size,
          height: size,
          backgroundColor: monogramColor(id),
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
      className={`shrink-0 object-contain ${className ?? ""}`}
      style={{ width: size, height: size }}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
