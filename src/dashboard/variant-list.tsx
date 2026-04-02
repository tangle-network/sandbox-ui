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
    border: string;
    label: string;
    animate: boolean;
  }
> = {
  pending: {
    icon: Clock,
    color: "text-[var(--surface-warning-text)]",
    bg: "bg-[var(--surface-warning-bg)]",
    border: "border-[var(--surface-warning-border)]",
    label: "Pending",
    animate: false,
  },
  running: {
    icon: Loader2,
    color: "text-primary",
    bg: "bg-[var(--accent-surface-soft)]",
    border: "border-border",
    label: "Running",
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: "text-[var(--surface-success-text)]",
    bg: "bg-[var(--surface-success-bg)]",
    border: "border-[var(--surface-success-border)]",
    label: "Completed",
    animate: false,
  },
  failed: {
    icon: XCircle,
    color: "text-[var(--surface-danger-text)]",
    bg: "bg-[var(--surface-danger-bg)]",
    border: "border-[var(--surface-danger-border)]",
    label: "Failed",
    animate: false,
  },
  cancelled: {
    icon: XCircle,
    color: "text-[var(--surface-neutral-text)]",
    bg: "bg-[var(--surface-neutral-bg)]",
    border: "border-[var(--surface-neutral-border)]",
    label: "Cancelled",
    animate: false,
  },
};

const outcomeConfig: Record<
  VariantOutcome,
  { color: string; bg: string; border: string; label: string }
> = {
  pending_review: {
    color: "text-[var(--surface-warning-text)]",
    bg: "bg-[var(--surface-warning-bg)]",
    border: "border-[var(--surface-warning-border)]",
    label: "Pending Review",
  },
  accepted: {
    color: "text-[var(--surface-success-text)]",
    bg: "bg-[var(--surface-success-bg)]",
    border: "border-[var(--surface-success-border)]",
    label: "Accepted",
  },
  rejected: {
    color: "text-[var(--surface-danger-text)]",
    bg: "bg-[var(--surface-danger-bg)]",
    border: "border-[var(--surface-danger-border)]",
    label: "Rejected",
  },
  merged_with_conflicts: {
    color: "text-[var(--surface-orange-text)]",
    bg: "bg-[var(--surface-orange-bg)]",
    border: "border-[var(--surface-orange-border)]",
    label: "Merged (conflicts)",
  },
  expired: {
    color: "text-[var(--surface-neutral-text)]",
    bg: "bg-[var(--surface-neutral-bg)]",
    border: "border-[var(--surface-neutral-border)]",
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
    <div className={`space-y-2 ${className || ""}`}>
      {variants.map((variant) => {
        const status = statusConfig[variant.status];
        const StatusIcon = status.icon;
        const isSelected = variant.id === selectedId;

        return (
          <div
            key={variant.id}
            className={`cursor-pointer rounded-lg border px-3 py-2.5 transition-colors ${
              isSelected
                ? "border-primary/30 bg-[var(--accent-surface-soft)]"
                : "border-border bg-card hover:border-primary/20 hover:bg-muted/50"
            }`}
            onClick={() => onSelect?.(variant.id)}
          >
            <div className="flex items-center gap-2">
              <Badge className={`shrink-0 ${status.bg} ${status.border} ${status.color}`}>
                <StatusIcon
                  className={`mr-1 h-3 w-3 ${status.animate ? "animate-spin" : ""}`}
                />
                {status.label}
              </Badge>
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">{variant.label}</span>
              {variant.sublabel && (
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  ({variant.sublabel})
                </span>
              )}
              {variant.durationMs && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Timer className="h-3 w-3" />
                  {(variant.durationMs / 1000).toFixed(1)}s
                </span>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {variant.outcome && (
                  <Badge
                    className={`${outcomeConfig[variant.outcome].bg} ${outcomeConfig[variant.outcome].border} ${outcomeConfig[variant.outcome].color}`}
                  >
                    {outcomeConfig[variant.outcome].label}
                  </Badge>
                )}
                {variant.status === "completed" &&
                  variant.outcome === "pending_review" &&
                  onAccept &&
                  onReject && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 border-[var(--surface-success-border)] bg-[var(--surface-success-bg)] px-2 text-xs text-[var(--surface-success-text)] hover:bg-[var(--surface-success-border)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAccept(variant.id);
                        }}
                        disabled={isActioning === variant.id}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] px-2 text-xs text-[var(--surface-danger-text)] hover:bg-[var(--surface-danger-border)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject(variant.id);
                        }}
                        disabled={isActioning === variant.id}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                    </>
                  )}
                {variant.detailsUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(variant.detailsUrl, "_blank");
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            {variant.error && (
              <p className="mt-1.5 text-xs text-[var(--surface-danger-text)]">{variant.error}</p>
            )}
            {variant.summary && (
              <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-muted)]">
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
