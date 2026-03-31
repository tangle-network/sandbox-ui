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
    color: "text-[var(--brand-cool)]",
    bg: "bg-[var(--accent-surface-soft)]",
    border: "border-[var(--border-accent)]",
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
                ? "border-[var(--border-accent)] bg-[var(--accent-surface-soft)]"
                : "border-[var(--border-subtle)] bg-[var(--depth-2)] hover:border-[var(--border-default)] hover:bg-[var(--depth-3)]"
            }`}
            onClick={() => onSelect?.(variant.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={`${status.bg} ${status.border} ${status.color}`}>
                  <StatusIcon
                    className={`mr-1 h-3 w-3 ${status.animate ? "animate-spin" : ""}`}
                  />
                  {status.label}
                </Badge>
                <span className="font-medium text-[var(--text-primary)]">{variant.label}</span>
                {variant.sublabel && (
                  <span className="text-sm text-[var(--text-muted)]">
                    ({variant.sublabel})
                  </span>
                )}
                {variant.durationMs && (
                  <span className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
                    <Timer className="h-3 w-3" />
                    {(variant.durationMs / 1000).toFixed(2)}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[var(--surface-success-border)] bg-[var(--surface-success-bg)] text-[var(--surface-success-text)] hover:bg-[var(--surface-success-border)]"
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
                        className="border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] text-[var(--surface-danger-text)] hover:bg-[var(--surface-danger-border)]"
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
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
              <p className="mt-2 text-sm text-[var(--surface-danger-text)]">{variant.error}</p>
            )}
            {variant.summary && (
              <p className="mt-2 line-clamp-2 text-sm text-[var(--text-muted)]">
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
