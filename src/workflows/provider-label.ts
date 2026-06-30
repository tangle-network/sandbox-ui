/**
 * Display label for a connector slug ("github" → "GitHub"). Separate from
 * `model.ts` so consumers that only need the label avoid pulling the `yaml`
 * parser (a `model.ts` dependency) into their bundle.
 */

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  slack: "Slack",
  stripe: "Stripe",
  notion: "Notion",
  linear: "Linear",
  discord: "Discord",
};

export function providerLabel(provider: string): string {
  const key = provider.toLowerCase();
  return (
    PROVIDER_LABELS[key] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
  );
}
