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

/** Base URL of the ActivePieces piece-logo CDN. The hub's provider ids are
 *  generated from the ActivePieces library, so most resolve a real brand logo
 *  from `/<providerId>.png`. */
const ACTIVEPIECES_CDN = "https://cdn.activepieces.com/pieces";

/**
 * Per-id brand logo URLs for providers whose logo isn't at the ActivePieces
 * default `/<id>.png` path: a connector's own catalog logo under a different
 * filename, a parent connector's logo reused by a sub-connector/variant, or a
 * public icon source for connectors absent from the catalog CDN.
 *
 * Mirrors the Tangle Platform's own integrations UI
 * (`products/platform/web/src/client/components/IntegrationsCatalog.tsx`) so
 * both surfaces resolve the same brand mark; the durable fix is for the hub API
 * to emit `iconUrl` per provider, after which this map can be retired.
 */
export const PROVIDER_LOGO_URLS: Record<string, string> = {
  // Catalog logo whose filename/extension differs from the provider id.
  "cal-com": `${ACTIVEPIECES_CDN}/cal.com.png`,
  "customer-io": `${ACTIVEPIECES_CDN}/customerio.png`,
  anthropic: `${ACTIVEPIECES_CDN}/claude.png`,
  telegram: `${ACTIVEPIECES_CDN}/telegram_bot.png`,
  "twilio-sms": `${ACTIVEPIECES_CDN}/twilio.png`,
  "amazon-sqs": `${ACTIVEPIECES_CDN}/aws-sqs.png`,
  frame: `${ACTIVEPIECES_CDN}/frameio.png`,
  "jira-cloud": `${ACTIVEPIECES_CDN}/jira.png`,
  "jira-data-center": `${ACTIVEPIECES_CDN}/jira.png`,
  stripe: `${ACTIVEPIECES_CDN}/stripe.png`,
  "stripe-pack": `${ACTIVEPIECES_CDN}/stripe.png`,
  gemini: `${ACTIVEPIECES_CDN}/google-gemini.png`,
  "google-gemini": `${ACTIVEPIECES_CDN}/google-gemini.png`,
  bluesky: `${ACTIVEPIECES_CDN}/bluesky.png`,
  emailit: `${ACTIVEPIECES_CDN}/emailit.svg`,
  cloutly: `${ACTIVEPIECES_CDN}/cloutly.svg`,
  gistly: `${ACTIVEPIECES_CDN}/gistly.svg`,
  jotform: `${ACTIVEPIECES_CDN}/jotform.svg`,
  supadata: `${ACTIVEPIECES_CDN}/supadata.svg`,
  "hugging-face": `${ACTIVEPIECES_CDN}/huggingface.svg`,
  huggingface: `${ACTIVEPIECES_CDN}/huggingface.svg`,
  heygen: `${ACTIVEPIECES_CDN}/heygen.jpg`,
  instasent: `${ACTIVEPIECES_CDN}/instasent.jpg`,
  "chainalysis-api": `${ACTIVEPIECES_CDN}/chainalysis-api.jpg`,
  scrapegraphai: `${ACTIVEPIECES_CDN}/scrapegraphai.jpg`,
  localai: `${ACTIVEPIECES_CDN}/localai.jpeg`,
  talkable:
    "https://www.talkable.com/wp-content/uploads/2021/12/talkable-favicon.svg",
  // Sub-connector or variant reusing its parent connector's catalog logo.
  "facebook-leads": `${ACTIVEPIECES_CDN}/facebook.png`,
  "facebook-pages": `${ACTIVEPIECES_CDN}/facebook.png`,
  "whatsapp-business": `${ACTIVEPIECES_CDN}/whatsapp.png`,
  onedrive: `${ACTIVEPIECES_CDN}/oneDrive.png`,
  "microsoft-onedrive": `${ACTIVEPIECES_CDN}/oneDrive.png`,
  "outlook-mail": `${ACTIVEPIECES_CDN}/microsoft-outlook.png`,
  "microsoft-calendar": `${ACTIVEPIECES_CDN}/microsoft-outlook.png`,
  "microsoft-outlook-calendar": `${ACTIVEPIECES_CDN}/microsoft-outlook.png`,
  sharepoint: `${ACTIVEPIECES_CDN}/microsoft-sharepoint.png`,
  "notion-database": `${ACTIVEPIECES_CDN}/notion.png`,
  "slack-inbound": `${ACTIVEPIECES_CDN}/slack.png`,
  helpscout: `${ACTIVEPIECES_CDN}/help-scout.png`,
  figjam: `${ACTIVEPIECES_CDN}/figma.png`,
  webhook: `${ACTIVEPIECES_CDN}/new-core/webhooks.svg`,
  // Absent from the catalog CDN — served from a public icon source.
  make: "https://cdn.simpleicons.org/make",
  n8n: "https://cdn.simpleicons.org/n8n",
  zapier: "https://cdn.simpleicons.org/zapier",
  auth0: "https://cdn.simpleicons.org/auth0",
  basecamp: "https://cdn.simpleicons.org/basecamp",
  ebay: "https://cdn.simpleicons.org/ebay",
  gusto: "https://cdn.simpleicons.org/gusto",
  miro: "https://cdn.simpleicons.org/miro",
  sanity: "https://cdn.simpleicons.org/sanity",
  sentry: "https://cdn.simpleicons.org/sentry",
  opsgenie: "https://cdn.simpleicons.org/opsgenie",
  phony:
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://ph0ny.com",
  docuseal:
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://docuseal.com",
  braze:
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://braze.com",
  pipedream:
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://pipedream.com",
  weaviate:
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://weaviate.io",
  "adobe-creative-cloud":
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://adobe.com",
  clio: "https://www.google.com/s2/favicons?sz=64&domain_url=https://clio.com",
  marketo:
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://marketo.com",
  rippling:
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://rippling.com",
  "microsoft-graph":
    "https://www.google.com/s2/favicons?sz=64&domain_url=https://graph.microsoft.com",
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
 * the monogram tile.
 *
 * Order: explicit `iconUrl` → full-color vector mark for brands Simple Icons
 * delisted (svgl.app) → a pinned override → the ActivePieces CDN by id (covers
 * most of the hub catalog) → derived simpleicons slugs → monogram.
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
  // Vector mark for delisted brands first (Slack, Salesforce, the Microsoft 365
  // family, …): simpleicons 404s for these, so the crisp svgl.app SVG goes ahead
  // of the rest.
  const vectorName =
    PROVIDER_VECTOR_LOGOS[raw] ??
    PROVIDER_VECTOR_LOGOS[norm] ??
    (curated ? PROVIDER_VECTOR_LOGOS[curated] : undefined);
  if (vectorName) out.push(`https://svgl.app/library/${vectorName}.svg`);
  // The platform's logo source: a pinned override, then the ActivePieces CDN
  // keyed on the provider id. A 404 on a miss advances the <img> to the next
  // candidate rather than stranding on a wrong default.
  const pinned = PROVIDER_LOGO_URLS[raw] ?? PROVIDER_LOGO_URLS[norm];
  if (pinned) out.push(pinned);
  if (raw) out.push(`${ACTIVEPIECES_CDN}/${encodeURIComponent(raw)}.png`);
  // simpleicons fallback for providers absent from the catalog. Derived slug:
  // brand name with separators stripped, lowercased — covers the long tail
  // (notion, airtable, linear, asana, …) without an explicit entry.
  const slugs = new Set<string>();
  if (curated) slugs.add(curated);
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
