import { cn } from "../lib/utils";
import { Check, Zap } from "lucide-react";

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
 * @param cents - Amount in whole US cents (e.g. 1099 for $10.99).
 */
export function formatPrice(cents: number): string {
  return cents % 100 === 0
    ? `$${cents / 100}`
    : `$${(cents / 100).toFixed(2)}`;
}

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

  return (
    <div className={cn("w-full space-y-10", className)}>
      {/* Billing Period Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => onBillingPeriodChange("monthly")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition-all",
              billingPeriod === "monthly"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => onBillingPeriodChange("yearly")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition-all",
              billingPeriod === "yearly"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Yearly
            <span className="ml-2 rounded-full bg-[var(--surface-success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--surface-success-text)]">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
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
                "relative flex flex-col rounded-2xl border transition-all",
                isRecommended
                  ? "border-primary shadow-[var(--shadow-glow)] scale-[1.02] z-10"
                  : "border-border hover:border-primary/30",
              )}
            >
              {/* Recommended banner */}
              {isRecommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm">
                    <Zap className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current plan indicator */}
              {isCurrentTier && !isRecommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-muted border border-border px-4 py-1.5 text-xs font-bold text-foreground">
                    Current Plan
                  </span>
                </div>
              )}

              <div className={cn("flex flex-col p-8", isRecommended && "pt-10")}>
                {/* Header */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className={cn("text-5xl font-extrabold tracking-tight", isRecommended ? "text-primary" : "text-foreground")}>
                      {isFree ? "Free" : formatPrice(displayPrice)}
                    </span>
                    {!isFree && (
                      <span className="text-muted-foreground text-sm font-medium">/mo</span>
                    )}
                  </div>
                  {billingPeriod === "yearly" && tier.yearlyPriceCents !== undefined && !isFree && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatPrice(tier.yearlyPriceCents)} billed annually
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  type="button"
                  onClick={() => onSelectTier(tier.id)}
                  disabled={isCurrentTier || loading}
                  className={cn(
                    "w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50",
                    isRecommended
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      : isCurrentTier
                        ? "bg-muted text-muted-foreground border border-border cursor-default"
                        : "bg-card text-foreground border border-border hover:border-primary/50 hover:bg-muted",
                  )}
                >
                  {isCurrentTier ? "Current Plan" : isFree ? "Get Started" : "Subscribe"}
                </button>

                {/* Divider */}
                <div className="my-8 border-t border-border" />

                {/* Features */}
                <ul className="space-y-3.5 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                        isRecommended ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-foreground/80">{feature}</span>
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
