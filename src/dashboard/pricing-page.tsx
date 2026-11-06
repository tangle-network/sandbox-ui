import { Button } from "@tangle-network/ui/primitives";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents?: number;
  features: string[];
  recommended?: boolean;
  creditsPerMonth?: number;
  monthlyPriceId?: string;
  yearlyPriceId?: string;
}

export interface PricingPageProps {
  tiers: PricingTier[];
  currentTierId?: string;
  billingPeriod: "monthly" | "yearly";
  onBillingPeriodChange: (period: "monthly" | "yearly") => void;
  onSelectTier: (tierId: string) => void;
  variant?: "sandbox";
  loading?: boolean;
  className?: string;
  cardClassName?: string;
}

/**
 * Formats an integer cent amount as a human-readable USD price.
 * Whole-dollar amounts omit decimals ($10), fractional amounts show two ($10.99).
 * Returns "$0" for non-finite or negative inputs.
 * @param cents - Amount in whole US cents (e.g. 1099 for $10.99).
 */
export function formatPrice(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return "$0";
  return cents % 100 === 0
    ? `$${cents / 100}`
    : `$${(cents / 100).toFixed(2)}`;
}

/**
 * The saving a yearly price gives over twelve months at the monthly price, in
 * whole percent, from the tiers the caller passed. Null when no paid tier has a
 * yearly price that saves anything. When the tiers disagree, the largest saving
 * is returned and `exact` is false.
 */
function yearlySaving(tiers: PricingTier[]): { percent: number; exact: boolean } | null {
  const savings = tiers
    .filter((tier) => tier.monthlyPriceCents > 0 && tier.yearlyPriceCents !== undefined)
    .map((tier) => Math.round((1 - (tier.yearlyPriceCents as number) / (tier.monthlyPriceCents * 12)) * 100))
    .filter((percent) => percent > 0);
  if (savings.length === 0) return null;
  const percent = Math.max(...savings);
  return { percent, exact: savings.every((value) => value === percent) };
}

const PERIOD_BUTTON =
  "rounded-lg px-4 py-2 text-sm font-medium transition-colors";

export function PricingPage({
  tiers,
  currentTierId,
  billingPeriod,
  onBillingPeriodChange,
  onSelectTier,
  loading = false,
  className,
}: PricingPageProps) {
  // Auto-mark the middle tier as recommended if none explicitly set
  const tiersWithRecommended = tiers.map((tier, i) => ({
    ...tier,
    recommended: tier.recommended ?? (tiers.length === 3 && i === 1),
  }));
  const saving = yearlySaving(tiers);

  return (
    <div className={cn("w-full space-y-10", className)}>
      {/* Billing Period Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-xl border border-[var(--md3-outline-variant)] bg-surface-container-low p-1">
          <button
            type="button"
            aria-pressed={billingPeriod === "monthly"}
            onClick={() => onBillingPeriodChange("monthly")}
            className={cn(
              PERIOD_BUTTON,
              billingPeriod === "monthly"
                ? "bg-surface-container-high text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={billingPeriod === "yearly"}
            onClick={() => onBillingPeriodChange("yearly")}
            className={cn(
              PERIOD_BUTTON,
              billingPeriod === "yearly"
                ? "bg-surface-container-high text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Yearly
            {saving && (
              <span className="ml-2 text-xs font-medium text-[var(--surface-success-text)]">
                {saving.exact ? "Save" : "Save up to"} {saving.percent}%
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {tiersWithRecommended.map((tier) => {
          const isCurrentTier = tier.id === currentTierId;
          const isRecommended = tier.recommended;
          const isFree = tier.monthlyPriceCents === 0;
          const price =
            billingPeriod === "yearly" && tier.yearlyPriceCents !== undefined
              ? tier.yearlyPriceCents
              : tier.monthlyPriceCents;
          const displayPrice =
            billingPeriod === "yearly" ? Math.round(price / 12) : price;

          return (
            <div
              key={tier.id}
              className={cn(
                "flex flex-col rounded-xl border bg-surface-container transition-colors",
                isRecommended
                  ? "border-primary"
                  : "border-[var(--md3-outline-variant)] hover:border-foreground/20",
              )}
            >
              <div className="flex flex-1 flex-col p-8">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-medium text-foreground">{tier.name}</h3>
                    {isRecommended && (
                      <span className="text-xs font-medium text-[var(--accent-text)]">Most popular</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-medium tracking-tight tabular-nums text-foreground">
                      {isFree ? "Free" : formatPrice(displayPrice)}
                    </span>
                    {!isFree && (
                      <span className="text-muted-foreground text-sm">/mo</span>
                    )}
                  </div>
                  {billingPeriod === "yearly" && tier.yearlyPriceCents !== undefined && !isFree && (
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {formatPrice(tier.yearlyPriceCents)} billed annually
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <Button
                  type="button"
                  size="lg"
                  variant={isRecommended && !isCurrentTier ? "default" : "outline"}
                  onClick={() => onSelectTier(tier.id)}
                  disabled={isCurrentTier || loading}
                  className="w-full"
                >
                  {isCurrentTier ? "Current plan" : isFree ? "Get started" : "Subscribe"}
                </Button>

                {/* Divider */}
                <div className="my-8 border-t border-[var(--md3-outline-variant)]" />

                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm text-[var(--text-secondary)]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
