import { cn } from "../lib/utils";
import { Button } from "@tangle-network/ui/primitives";
import { Badge } from "@tangle-network/ui/primitives";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tangle-network/ui/primitives";
import { Progress } from "@tangle-network/ui/primitives";
import { ChartLine, Coins, CreditCard } from "lucide-react";

export interface BillingSubscription {
  status: string;
  tierName: string;
  renewsAt: string;
}

export interface BillingBalance {
  available: number;
  used: number;
}

export interface BillingUsage {
  period: string;
  total: number;
  byModel: Record<string, number>;
}

export interface BillingDashboardProps {
  subscription: BillingSubscription | null;
  balance: BillingBalance;
  usage: BillingUsage;
  onManageSubscription: () => void;
  onAddCredits: () => void;
  variant?: "sandbox";
  className?: string;
  cardClassName?: string;
}

function formatCredits(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadgeVariant(
  status: string,
): "success" | "warning" | "error" | "secondary" {
  switch (status.toLowerCase()) {
    case "active":
      return "success";
    case "trialing":
    case "past_due":
      return "warning";
    case "canceled":
    case "unpaid":
      return "error";
    default:
      return "secondary";
  }
}




export function BillingDashboard({
  subscription,
  balance,
  usage,
  onManageSubscription,
  onAddCredits,
  variant = "sandbox",
  className,
  cardClassName,
}: BillingDashboardProps) {
  const totalCredits = balance.available + balance.used;
  const usagePercent =
    totalCredits > 0 ? (balance.used / totalCredits) * 100 : 0;
  const sortedModels = Object.entries(usage.byModel).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className={cn("grid gap-6 lg:grid-cols-3", className)}>
      {/* Current Plan Card */}
      <Card variant={variant} className={cn("lg:col-span-1", cardClassName)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-5 text-muted-foreground" />
              Current plan
            </CardTitle>
            {subscription && (
              <Badge variant={getStatusBadgeVariant(subscription.status)}>
                {subscription.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <>
              <div>
                <p className="font-medium text-2xl">
                  {subscription.tierName}
                </p>
                <p className="text-muted-foreground text-sm">
                  Renews {formatDate(subscription.renewsAt)}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={onManageSubscription}
              >
                Manage subscription
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="font-medium text-2xl text-muted-foreground">
                  No active plan
                </p>
                <p className="text-muted-foreground text-sm">
                  Subscribe to get started
                </p>
              </div>
              <Button
                variant={variant}
                className="w-full"
                onClick={onManageSubscription}
              >
                View plans
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Credit Balance Card */}
      <Card variant={variant} className={cn("lg:col-span-1", cardClassName)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-5 text-muted-foreground" />
            Credit balance
          </CardTitle>
          <CardDescription>
            {formatCredits(balance.available)} credits remaining
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-medium tabular-nums">{formatCredits(balance.used)}</span>
            </div>
            <Progress value={usagePercent} variant={variant} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className="font-medium tabular-nums">
                {formatCredits(balance.available)}
              </span>
            </div>
          </div>
          <Button variant={variant} className="w-full" onClick={onAddCredits}>
            Add credits
          </Button>
        </CardContent>
      </Card>

      {/* Usage Breakdown Card */}
      <Card variant={variant} className={cn("lg:col-span-1", cardClassName)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartLine className="size-5 text-muted-foreground" />
            Usage breakdown
          </CardTitle>
          <CardDescription>{usage.period}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-sm">Total usage</span>
            <span className="font-medium text-2xl tabular-nums">
              {formatCredits(usage.total)}
            </span>
          </div>

          {/* Model Breakdown */}
          <div className="space-y-3">
            <p className="font-medium text-muted-foreground text-xs">
              By model
            </p>
            <div className="space-y-2">
              {sortedModels.slice(0, 5).map(([model, credits]) => {
                const modelPercent =
                  usage.total > 0 ? (credits / usage.total) * 100 : 0;
                return (
                  <div key={model} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate text-muted-foreground">
                        {model}
                      </span>
                      <span className="ml-2 font-medium tabular-nums">
                        {formatCredits(credits)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${modelPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {sortedModels.length > 5 && (
                <p className="text-muted-foreground text-xs">
                  +{sortedModels.length - 5} more models
                </p>
              )}
              {sortedModels.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No usage this period
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
