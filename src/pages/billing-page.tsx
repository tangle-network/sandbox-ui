import * as React from "react";
import {
  type BillingBalance,
  BillingDashboard,
  type BillingSubscription,
  type BillingUsage,
} from "../dashboard/billing-dashboard";
import { PricingPage, type PricingTier } from "../dashboard/pricing-page";
import { Skeleton, SkeletonCard } from "../primitives/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../primitives/tabs";
import { UsageChart, type UsageDataPoint } from "../dashboard/usage-chart";

export type ProductVariant = "sandbox";

export interface BillingPageData {
  subscription: BillingSubscription | null;
  balance: BillingBalance;
  usage: BillingUsage;
  usageHistory: UsageDataPoint[];
  tiers: PricingTier[];
}

export interface BillingPageProps {
  variant?: ProductVariant;
  initialData?: BillingPageData;
  apiBasePath?: string;
  onManageSubscription?: () => void;
  onAddCredits?: () => void;
  onSelectTier?: (tierId: string) => void;
  fetchBillingData?: () => Promise<BillingPageData>;
}

interface BillingPageState {
  data: BillingPageData | null;
  loading: boolean;
  error: string | null;
  billingPeriod: "monthly" | "yearly";
  selectingTier: boolean;
}

const defaultBillingData: BillingPageData = {
  subscription: null,
  balance: { available: 0, used: 0 },
  usage: { period: "This Month", total: 0, byModel: {} },
  usageHistory: [],
  tiers: [],
};

async function fetchBillingDataFromApi(
  apiBasePath: string,
): Promise<BillingPageData> {
  const [subscriptionRes, balanceRes, usageRes, tiersRes] = await Promise.all([
    fetch(`${apiBasePath}/v1/billing/subscription`),
    fetch(`${apiBasePath}/v1/billing/balance`),
    fetch(`${apiBasePath}/v1/billing/usage`),
    fetch(`${apiBasePath}/v1/billing/tiers`),
  ]);

  if (!subscriptionRes.ok && subscriptionRes.status !== 404) {
    throw new Error("Failed to fetch subscription data");
  }
  if (!balanceRes.ok) {
    throw new Error("Failed to fetch balance data");
  }
  if (!usageRes.ok) {
    throw new Error("Failed to fetch usage data");
  }
  if (!tiersRes.ok) {
    throw new Error("Failed to fetch pricing tiers");
  }

  const subscription =
    subscriptionRes.status === 404 ? null : await subscriptionRes.json();
  const balance = await balanceRes.json();
  const usageData = await usageRes.json();
  const tiers = await tiersRes.json();

  return {
    subscription,
    balance,
    usage: {
      period: usageData.period || "This Month",
      total: usageData.total || 0,
      byModel: usageData.byModel || {},
    },
    usageHistory: usageData.history || [],
    tiers: tiers.tiers || tiers,
  };
}

function BillingPageSkeleton({
  variant: _variant = "sandbox",
}: {
  variant?: ProductVariant;
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-48" />
        <div className="h-48">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}

function BillingPageError({
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
        <h3 className="font-semibold text-lg">Failed to load billing data</h3>
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

export function BillingPage({
  variant = "sandbox",
  initialData,
  apiBasePath = "",
  onManageSubscription,
  onAddCredits,
  onSelectTier,
  fetchBillingData,
}: BillingPageProps) {
  const [state, setState] = React.useState<BillingPageState>({
    data: initialData || null,
    loading: !initialData,
    error: null,
    billingPeriod: "monthly",
    selectingTier: false,
  });

  const loadData = React.useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = fetchBillingData
        ? await fetchBillingData()
        : await fetchBillingDataFromApi(apiBasePath);
      setState((prev) => ({ ...prev, data, loading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "An unknown error occurred",
      }));
    }
  }, [apiBasePath, fetchBillingData]);

  React.useEffect(() => {
    if (!initialData) {
      loadData();
    }
  }, [initialData, loadData]);

  const handleManageSubscription = React.useCallback(() => {
    if (onManageSubscription) {
      onManageSubscription();
    } else {
      window.location.href = `${apiBasePath}/v1/billing/portal`;
    }
  }, [apiBasePath, onManageSubscription]);

  const handleAddCredits = React.useCallback(() => {
    if (onAddCredits) {
      onAddCredits();
    } else {
      window.location.href = `${apiBasePath}/v1/billing/credits`;
    }
  }, [apiBasePath, onAddCredits]);

  const handleSelectTier = React.useCallback(
    async (tierId: string) => {
      if (onSelectTier) {
        onSelectTier(tierId);
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

        const { checkoutUrl } = await res.json();
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          loadData();
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          selectingTier: false,
          error: err instanceof Error ? err.message : "Failed to select tier",
        }));
      }
    },
    [apiBasePath, state.billingPeriod, onSelectTier, loadData],
  );

  const handleBillingPeriodChange = React.useCallback(
    (period: "monthly" | "yearly") => {
      setState((prev) => ({ ...prev, billingPeriod: period }));
    },
    [],
  );

  if (state.loading) {
    return <BillingPageSkeleton variant={variant} />;
  }

  if (state.error) {
    return <BillingPageError message={state.error} onRetry={loadData} />;
  }

  const data = state.data || defaultBillingData;

  return (
    <div className="space-y-8">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="usage">Usage History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <BillingDashboard
            subscription={data.subscription}
            balance={data.balance}
            usage={data.usage}
            onManageSubscription={handleManageSubscription}
            onAddCredits={handleAddCredits}
            variant={variant}
          />
        </TabsContent>

        <TabsContent value="plans">
          <PricingPage
            tiers={data.tiers}
            currentTierId={data.subscription?.tierName}
            billingPeriod={state.billingPeriod}
            onBillingPeriodChange={handleBillingPeriodChange}
            onSelectTier={handleSelectTier}
            variant={variant}
            loading={state.selectingTier}
          />
        </TabsContent>

        <TabsContent value="usage">
          {data.usageHistory.length > 0 ? (
            <UsageChart
              data={data.usageHistory}
              title="Credit Usage History"
              unit="credits"
              variant={variant}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-4 h-12 w-12 text-muted-foreground"
              >
                <title>No usage data icon</title>
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              <h3 className="font-semibold text-lg">No usage data yet</h3>
              <p className="text-muted-foreground text-sm">
                Start using credits to see your usage history here.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
