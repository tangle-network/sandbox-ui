"use client";

import {
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "../primitives/button";
import { Badge } from "../primitives/badge";

export type VariantStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type VariantOutcome =
  | "pending_review"
  | "accepted"
  | "rejected"
  | "merged_with_conflicts"
  | "expired";

export interface Variant {
  id: string;
  label: string;
  sublabel?: string;
  status: VariantStatus;
  outcome?: VariantOutcome;
  durationMs?: number;
  error?: string;
  summary?: string;
  /** Link to view variant details (e.g., chat UI) */
  detailsUrl?: string;
}

export interface VariantListProps {
  variants: Variant[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  isActioning?: string | null;
  className?: string;
}

const statusConfig: Record<
  VariantStatus,
  {
    icon: typeof Clock;
    color: string;
    bg: string;
    label: string;
    animate: boolean;
  }
> = {
  pending: {
    icon: Clock,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    label: "Pending",
    animate: false,
  },
  running: {
    icon: Loader2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    label: "Running",
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10",
    label: "Completed",
    animate: false,
  },
  failed: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    label: "Failed",
    animate: false,
  },
  cancelled: {
    icon: XCircle,
    color: "text-gray-400",
    bg: "bg-gray-500/10",
    label: "Cancelled",
    animate: false,
  },
};

const outcomeConfig: Record<
  VariantOutcome,
  { color: string; bg: string; label: string }
> = {
  pending_review: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    label: "Pending Review",
  },
  accepted: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    label: "Accepted",
  },
  rejected: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    label: "Rejected",
  },
  merged_with_conflicts: {
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    label: "Merged (conflicts)",
  },
  expired: {
    color: "text-gray-400",
    bg: "bg-gray-500/10",
    label: "Expired",
  },
};

export function VariantList({
  variants,
  selectedId,
  onSelect,
  onAccept,
  onReject,
  isActioning,
  className,
}: VariantListProps) {
  return (
    <div className={`space-y-3 ${className || ""}`}>
      {variants.map((variant) => {
        const status = statusConfig[variant.status];
        const StatusIcon = status.icon;
        const isSelected = variant.id === selectedId;

        return (
          <div
            key={variant.id}
            className={`cursor-pointer rounded-lg border p-4 transition-colors ${
              isSelected
                ? "border-blue-500 bg-blue-500/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onClick={() => onSelect?.(variant.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={`${status.bg} ${status.color} border-0`}>
                  <StatusIcon
                    className={`mr-1 h-3 w-3 ${status.animate ? "animate-spin" : ""}`}
                  />
                  {status.label}
                </Badge>
                <span className="font-medium">{variant.label}</span>
                {variant.sublabel && (
                  <span className="text-muted-foreground text-sm">
                    ({variant.sublabel})
                  </span>
                )}
                {variant.durationMs && (
                  <span className="flex items-center gap-1 text-muted-foreground text-sm">
                    <Timer className="h-3 w-3" />
                    {(variant.durationMs / 1000).toFixed(2)}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {variant.outcome && (
                  <Badge
                    className={`${outcomeConfig[variant.outcome].bg} ${outcomeConfig[variant.outcome].color} border-0`}
                  >
                    {outcomeConfig[variant.outcome].label}
                  </Badge>
                )}
                {variant.status === "completed" &&
                  variant.outcome === "pending_review" &&
                  onAccept &&
                  onReject && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-400 hover:bg-green-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAccept(variant.id);
                        }}
                        disabled={isActioning === variant.id}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject(variant.id);
                        }}
                        disabled={isActioning === variant.id}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                {variant.detailsUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(variant.detailsUrl, "_blank");
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {variant.error && (
              <p className="mt-2 text-red-400 text-sm">{variant.error}</p>
            )}
            {variant.summary && (
              <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
                {variant.summary}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export {
  statusConfig as variantStatusConfig,
  outcomeConfig as variantOutcomeConfig,
};
