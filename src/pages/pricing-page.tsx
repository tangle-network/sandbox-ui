import * as React from "react";
import {
  PricingPage as PricingPageComponent,
  type PricingTier,
} from "../dashboard/pricing-page";
import { Skeleton, SkeletonCard } from "../primitives/skeleton";
import { cn } from "../lib/utils";
import { ChevronDown } from "lucide-react";

export type ProductVariant = "sandbox";

export interface StandalonePricingPageProps {
  variant?: ProductVariant;
  initialTiers?: PricingTier[];
  apiBasePath?: string;
  onSelectTier?: (tierId: string, billingPeriod: "monthly" | "yearly") => void;
  fetchTiers?: () => Promise<PricingTier[]>;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  className?: string;
}

interface PricingPageState {
  tiers: PricingTier[];
  loading: boolean;
  error: string | null;
  billingPeriod: "monthly" | "yearly";
  selectingTier: boolean;
}

async function fetchTiersFromApi(apiBasePath: string): Promise<PricingTier[]> {
  const res = await fetch(`${apiBasePath}/v1/billing/tiers`);
  if (!res.ok) throw new Error("Failed to fetch pricing tiers");
  const data = await res.json();
  return data.tiers || data;
}

const FAQ = [
  {
    q: "What are credits?",
    a: "Credits are used to pay for AI model usage. Different models consume different amounts of credits based on their complexity and the length of your requests.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. You can upgrade or downgrade your plan at any time. When you upgrade, you are charged the prorated difference. When you downgrade, the change takes effect at the end of your billing cycle.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Monthly credits do not roll over to the next month. However, purchased credit packs never expire and can be used at any time.",
  },
];

export function StandalonePricingPage({
  variant = "sandbox",
  initialTiers,
  apiBasePath = "",
  onSelectTier,
  fetchTiers,
  title = "Simple, transparent pricing",
  subtitle = "Choose the plan that fits your needs. Upgrade or downgrade at any time.",
  eyebrow,
  className,
}: StandalonePricingPageProps) {
  const [state, setState] = React.useState<PricingPageState>({
    tiers: initialTiers || [],
    loading: !initialTiers,
    error: null,
    billingPeriod: "monthly",
    selectingTier: false,
  });

  const loadTiers = React.useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const tiers = fetchTiers
        ? await fetchTiers()
        : await fetchTiersFromApi(apiBasePath);
      setState((prev) => ({ ...prev, tiers, loading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "An unknown error occurred",
      }));
    }
  }, [apiBasePath, fetchTiers]);

  React.useEffect(() => {
    if (!initialTiers) {
      loadTiers();
    }
  }, [initialTiers, loadTiers]);

  const handleSelectTier = React.useCallback(
    async (tierId: string) => {
      if (onSelectTier) {
        onSelectTier(tierId, state.billingPeriod);
        return;
      }
      setState((prev) => ({ ...prev, selectingTier: true }));
      try {
        const res = await fetch(`${apiBasePath}/v1/billing/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tierId, billingPeriod: state.billingPeriod }),
        });
        if (!res.ok) throw new Error("Failed to initiate subscription");
        const { checkoutUrl, loginUrl } = await res.json();
        if (loginUrl) window.location.href = loginUrl;
        else if (checkoutUrl) window.location.href = checkoutUrl;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          selectingTier: false,
          error: err instanceof Error ? err.message : "Failed to select tier",
        }));
      }
    },
    [apiBasePath, state.billingPeriod, onSelectTier],
  );

  return (
    <div className={cn("mx-auto max-w-6xl px-6 py-16 space-y-16", className)}>
      {/* Header */}
      <div className="space-y-4 text-center">
        {eyebrow && (
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--brand-emerald,#009f6e)]">{eyebrow}</span>
        )}
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl font-[var(--font-display)]">
          {title}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          {subtitle}
        </p>
      </div>

      {/* Content */}
      {state.loading ? (
        <div className="space-y-8">
          <div className="flex items-center justify-center gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SkeletonCard className="h-[500px]" />
            <SkeletonCard className="h-[500px]" />
            <SkeletonCard className="h-[500px]" />
          </div>
        </div>
      ) : state.error ? (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <p className="text-destructive text-sm font-medium">{state.error}</p>
          <button
            type="button"
            onClick={loadTiers}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <PricingPageComponent
          tiers={state.tiers}
          billingPeriod={state.billingPeriod}
          onBillingPeriodChange={(p) => setState((prev) => ({ ...prev, billingPeriod: p }))}
          onSelectTier={handleSelectTier}
          variant={variant}
          loading={state.selectingTier}
        />
      )}

      {/* FAQ */}
      <div className="mx-auto max-w-2xl space-y-4 border-t border-border pt-12">
        <h2 className="text-center text-xl font-bold text-foreground mb-6">
          Frequently Asked Questions
        </h2>
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group rounded-xl border border-border bg-card overflow-hidden">
            <summary className="flex cursor-pointer items-center justify-between px-6 py-4 font-medium text-foreground text-sm">
              {q}
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
