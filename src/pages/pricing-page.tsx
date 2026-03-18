import * as React from "react";
import {
  PricingPage as PricingPageComponent,
  type PricingTier,
} from "../dashboard/pricing-page";
import { Skeleton, SkeletonCard } from "../primitives/skeleton";
import { cn } from "../lib/utils";

export type ProductVariant = "sandbox";

export interface StandalonePricingPageProps {
  variant?: ProductVariant;
  initialTiers?: PricingTier[];
  apiBasePath?: string;
  onSelectTier?: (tierId: string, billingPeriod: "monthly" | "yearly") => void;
  fetchTiers?: () => Promise<PricingTier[]>;
  title?: string;
  subtitle?: string;
}

interface PricingPageState {
  tiers: PricingTier[];
  loading: boolean;
  error: string | null;
  billingPeriod: "monthly" | "yearly";
  selectingTier: boolean;
}

const variantColors = {
  sandbox: {
    accent: "text-purple-400",
    gradientFrom: "from-purple-600",
    gradientTo: "to-purple-400",
  },
};

async function fetchTiersFromApi(apiBasePath: string): Promise<PricingTier[]> {
  const res = await fetch(`${apiBasePath}/v1/billing/tiers`);

  if (!res.ok) {
    throw new Error("Failed to fetch pricing tiers");
  }

  const data = await res.json();
  return data.tiers || data;
}

function PricingPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard className="h-96" />
        <SkeletonCard className="h-96" />
        <SkeletonCard className="h-96" />
      </div>
    </div>
  );
}

function PricingPageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-destructive"
        >
          <title>Error icon</title>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Failed to load pricing</h3>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
      >
        Try Again
      </button>
    </div>
  );
}

export function StandalonePricingPage({
  variant = "sandbox",
  initialTiers,
  apiBasePath = "",
  onSelectTier,
  fetchTiers,
  title = "Simple, transparent pricing",
  subtitle = "Choose the plan that fits your needs. Upgrade or downgrade at any time.",
}: StandalonePricingPageProps) {
  const colors = variantColors[variant];

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
          body: JSON.stringify({
            tierId,
            billingPeriod: state.billingPeriod,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to initiate subscription");
        }

        const { checkoutUrl, loginUrl } = await res.json();
        if (loginUrl) {
          // User needs to authenticate first
          window.location.href = loginUrl;
        } else if (checkoutUrl) {
          window.location.href = checkoutUrl;
        }
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

  const handleBillingPeriodChange = React.useCallback(
    (period: "monthly" | "yearly") => {
      setState((prev) => ({ ...prev, billingPeriod: period }));
    },
    [],
  );

  return (
    <div className="w-full space-y-12">
      {/* Header Section */}
      <div className="space-y-4 text-center">
        <h1
          className={cn(
            "font-bold text-4xl tracking-tight sm:text-5xl",
            "bg-gradient-to-r bg-clip-text text-transparent",
            colors.gradientFrom,
            colors.gradientTo,
          )}
        >
          {title}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          {subtitle}
        </p>
      </div>

      {/* Content */}
      {state.loading ? (
        <PricingPageSkeleton />
      ) : state.error ? (
        <PricingPageError message={state.error} onRetry={loadTiers} />
      ) : (
        <PricingPageComponent
          tiers={state.tiers}
          billingPeriod={state.billingPeriod}
          onBillingPeriodChange={handleBillingPeriodChange}
          onSelectTier={handleSelectTier}
          variant={variant}
          loading={state.selectingTier}
        />
      )}

      {/* FAQ or Additional Info Section */}
      <div className="mx-auto max-w-3xl space-y-6 border-border border-t pt-8">
        <h2 className="text-center font-semibold text-xl">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <details className="group rounded-lg border border-border bg-card p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
              What are credits?
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 transition-transform group-open:rotate-180"
              >
                <title>Toggle icon</title>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="mt-3 text-muted-foreground text-sm">
              Credits are used to pay for AI model usage. Different models
              consume different amounts of credits based on their complexity and
              the length of your requests.
            </p>
          </details>
          <details className="group rounded-lg border border-border bg-card p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
              Can I change plans later?
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 transition-transform group-open:rotate-180"
              >
                <title>Toggle icon</title>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="mt-3 text-muted-foreground text-sm">
              Yes! You can upgrade or downgrade your plan at any time. When you
              upgrade, you will be charged the prorated difference. When you
              downgrade, the change takes effect at the end of your billing
              cycle.
            </p>
          </details>
          <details className="group rounded-lg border border-border bg-card p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
              Do unused credits roll over?
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 transition-transform group-open:rotate-180"
              >
                <title>Toggle icon</title>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="mt-3 text-muted-foreground text-sm">
              Monthly credits do not roll over to the next month. However,
              purchased credit packs never expire and can be used at any time.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
