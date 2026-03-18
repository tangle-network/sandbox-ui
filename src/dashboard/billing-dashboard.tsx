import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Badge } from "../primitives/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../primitives/card";
import { Progress } from "../primitives/progress";

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
}

const variantColors = {
  sandbox: {
    accent: "text-purple-400",
    accentBg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
};

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

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
    >
      <title>Credit card icon</title>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
    >
      <title>Coins icon</title>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
    >
      <title>Chart icon</title>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

export function BillingDashboard({
  subscription,
  balance,
  usage,
  onManageSubscription,
  onAddCredits,
  variant = "sandbox",
}: BillingDashboardProps) {
  const colors = variantColors[variant];
  const totalCredits = balance.available + balance.used;
  const usagePercent =
    totalCredits > 0 ? (balance.used / totalCredits) * 100 : 0;
  const sortedModels = Object.entries(usage.byModel).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Current Plan Card */}
      <Card variant={variant} className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCardIcon className={colors.accent} />
              Current Plan
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
                <p className={cn("font-bold text-2xl", colors.accent)}>
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
                Manage Subscription
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="font-bold text-2xl text-muted-foreground">
                  No Active Plan
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
                View Plans
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Credit Balance Card */}
      <Card variant={variant} className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CoinsIcon className={colors.accent} />
            Credit Balance
          </CardTitle>
          <CardDescription>
            {formatCredits(balance.available)} credits remaining
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className="font-medium">{formatCredits(balance.used)}</span>
            </div>
            <Progress value={usagePercent} variant={variant} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className={cn("font-medium", colors.accent)}>
                {formatCredits(balance.available)}
              </span>
            </div>
          </div>
          <Button variant={variant} className="w-full" onClick={onAddCredits}>
            Add Credits
          </Button>
        </CardContent>
      </Card>

      {/* Usage Breakdown Card */}
      <Card variant={variant} className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ChartIcon className={colors.accent} />
            Usage Breakdown
          </CardTitle>
          <CardDescription>{usage.period}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-sm">Total Usage</span>
            <span className={cn("font-bold text-2xl", colors.accent)}>
              {formatCredits(usage.total)}
            </span>
          </div>

          {/* Model Breakdown */}
          <div className="space-y-3">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              By Model
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
                      <span className="ml-2 font-medium">
                        {formatCredits(credits)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          variant === "sandbox" && "bg-purple-500",
                        )}
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
