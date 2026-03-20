import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Badge } from "../primitives/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../primitives/card";

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents?: number;
  features: string[];
  recommended?: boolean;
  creditsPerMonth?: number;
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

const variantColors = {
  sandbox: {
    accent: "text-[var(--accent-text)]",
    border: "border-[var(--border-accent)]",
    bg: "bg-[var(--accent-surface-soft)]",
    ring: "ring-[hsl(var(--primary)/0.35)]",
  },
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
    >
      <title>Check icon</title>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function PricingPage({
  tiers,
  currentTierId,
  billingPeriod,
  onBillingPeriodChange,
  onSelectTier,
  variant = "sandbox",
  loading = false,
  className,
  cardClassName,
}: PricingPageProps) {
  const colors = variantColors[variant];

  return (
    <div className={cn("w-full space-y-8", className)}>
      {/* Billing Period Toggle */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onBillingPeriodChange("monthly")}
          className={cn(
            "rounded-lg px-4 py-2 font-medium text-sm transition-all",
            billingPeriod === "monthly"
              ? cn("bg-muted text-foreground", colors.ring, "ring-2")
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onBillingPeriodChange("yearly")}
          className={cn(
            "rounded-lg px-4 py-2 font-medium text-sm transition-all",
            billingPeriod === "yearly"
              ? cn("bg-muted text-foreground", colors.ring, "ring-2")
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Yearly
          <span className={cn("ml-2 text-xs", colors.accent)}>Save 20%</span>
        </button>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => {
          const isCurrentTier = tier.id === currentTierId;
          const price =
            billingPeriod === "yearly" && tier.yearlyPriceCents !== undefined
              ? tier.yearlyPriceCents
              : tier.monthlyPriceCents;
          const displayPrice =
            billingPeriod === "yearly" ? Math.round(price / 12) : price;

          return (
            <Card
              key={tier.id}
              variant={variant}
              className={cn(
                "relative flex flex-col",
                cardClassName,
                tier.recommended &&
                  cn(colors.border, "border-2 ring-2", colors.ring),
                isCurrentTier && "ring-2 ring-offset-2 ring-offset-background",
                isCurrentTier && colors.ring,
              )}
            >
              {/* Recommended Badge */}
              {tier.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant={variant}>Recommended</Badge>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentTier && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="secondary">Current Plan</Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-6">
                {/* Price Display */}
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={cn("font-bold text-4xl", colors.accent)}>
                      {formatPrice(displayPrice)}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  {billingPeriod === "yearly" &&
                    tier.yearlyPriceCents !== undefined && (
                      <p className="mt-1 text-muted-foreground text-sm">
                        {formatPrice(tier.yearlyPriceCents)} billed annually
                      </p>
                    )}
                </div>

                {/* Credits Per Month */}
                {tier.creditsPerMonth !== undefined && (
                  <div className={cn("rounded-lg p-3 text-center", colors.bg)}>
                    <span className={cn("font-semibold", colors.accent)}>
                      {tier.creditsPerMonth.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {" "}
                      credits/month
                    </span>
                  </div>
                )}

                {/* Features List */}
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckIcon
                        className={cn("mt-0.5 shrink-0", colors.accent)}
                      />
                      <span className="text-muted-foreground text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  variant={isCurrentTier ? "outline" : variant}
                  className="w-full"
                  disabled={isCurrentTier || loading}
                  loading={loading}
                  onClick={() => onSelectTier(tier.id)}
                >
                  {isCurrentTier
                    ? "Current Plan"
                    : currentTierId
                      ? "Upgrade"
                      : "Subscribe"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
