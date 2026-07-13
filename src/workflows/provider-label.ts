/**
 * Display label for a connector slug ("github" → "GitHub"). Separate from
 * `model.ts` so consumers that only need the label avoid pulling the `yaml`
 * parser (a `model.ts` dependency) into their bundle.
 */

import { humanizeIdentifier } from "./naming";

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  slack: "Slack",
  stripe: "Stripe",
  notion: "Notion",
  linear: "Linear",
  discord: "Discord",
};

/**
 * The label above is a curated exception list (brands whose casing no rule
 * predicts: "GitHub", "GitLab"). Everything else is title-cased from its slug —
 * a connector id is multi-word far more often than not (`google-sheets`,
 * `microsoft-teams`), and merely capitalizing the first letter left the node
 * NAMED after the machine identifier: "Google-sheets".
 */
export function providerLabel(provider: string): string {
  const key = provider.toLowerCase();
  return PROVIDER_LABELS[key] ?? humanizeIdentifier(provider, "title");
}
