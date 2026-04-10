import { type ReactNode, useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ── Types ──

export interface ApprovalItem {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: "pending" | "approved" | "rejected" | "executed";
  createdAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  /** Arbitrary metadata — e.g. rejectionReason, confidence, content preview */
  meta?: Record<string, unknown>;
}

export interface ApprovalConfidenceStat {
  type: string;
  approved: number;
  rejected: number;
  total: number;
  rate: number;
}

export interface ApprovalQueueProps {
  items: ApprovalItem[];
  className?: string;

  // ── Callbacks ──
  onApprove?: (item: ApprovalItem) => void;
  onReject?: (item: ApprovalItem, reason?: string) => void;

  // ── Customization ──
  /** Render custom content inside each approval card */
  renderItemDetail?: (item: ApprovalItem) => ReactNode;
  /** Render a custom badge for the item type */
  renderTypeBadge?: (type: string) => ReactNode;
  /** Render custom stats at the top. If not provided, auto-computed confidence stats shown. */
  renderStats?: (stats: ApprovalConfidenceStat[]) => ReactNode;
  /** Whether the user can approve/reject. Default true. */
  canResolve?: boolean;
  /** Header slot */
  header?: ReactNode;
  /** Empty state */
  emptyState?: ReactNode;
  /** Whether to show resolved items. Default: collapsed toggle. */
  showResolved?: boolean;
}

// ── Component ──

/**
 * ApprovalQueue — review queue for agent-proposed actions.
 *
 * Shows pending items with approve/reject controls, confidence stats per type,
 * and a collapsible resolved history. Designed for the agent approval feedback
 * loop: agent proposes → user approves/rejects → rejection reasons feed back.
 */
export function ApprovalQueue({
  items,
  className,
  onApprove,
  onReject,
  renderItemDetail,
  renderTypeBadge,
  renderStats,
  canResolve = true,
  header,
  emptyState,
  showResolved: controlledShowResolved,
}: ApprovalQueueProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showResolved, setShowResolved] = useState(controlledShowResolved ?? false);

  const pending = useMemo(
    () => items.filter((a) => a.status === "pending"),
    [items],
  );
  const resolved = useMemo(
    () => items.filter((a) => a.status !== "pending"),
    [items],
  );

  const stats = useMemo(() => {
    const map: Record<string, ApprovalConfidenceStat> = {};
    for (const item of items) {
      if (!map[item.type])
        map[item.type] = { type: item.type, approved: 0, rejected: 0, total: 0, rate: 0 };
      map[item.type].total++;
      if (item.status === "approved" || item.status === "executed")
        map[item.type].approved++;
      if (item.status === "rejected") map[item.type].rejected++;
    }
    for (const s of Object.values(map)) {
      s.rate = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
    }
    return Object.values(map);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className={cn("flex-1 flex items-center justify-center", className)}>
        {emptyState ?? (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">No proposals yet</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex-1 overflow-y-auto", className)}>
      <div className="max-w-3xl mx-auto p-6">
        {header}

        {/* Confidence stats */}
        {stats.length > 0 && (
          <div className="flex gap-3 mb-6 flex-wrap">
            {renderStats
              ? renderStats(stats)
              : stats.map((s) => (
                  <div
                    key={s.type}
                    className="flex-1 min-w-[120px] rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {renderTypeBadge ? (
                        renderTypeBadge(s.type)
                      ) : (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {s.type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-semibold text-foreground">
                        {s.rate}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {s.approved}/{s.total} approved
                    </p>
                  </div>
                ))}
          </div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <section className="mb-8">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Pending ({pending.length})
            </h3>
            <div className="space-y-3">
              {pending.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-primary/20 bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-foreground">
                          {item.title}
                        </h4>
                        {renderTypeBadge ? (
                          renderTypeBadge(item.type)
                        ) : (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {item.type}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      {renderItemDetail?.(item)}
                    </div>
                    {canResolve && (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onApprove?.(item)}
                          className="h-8 px-3 rounded-md border border-border text-xs font-medium text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(
                              rejectingId === item.id ? null : item.id,
                            );
                            setRejectReason("");
                          }}
                          className="h-8 px-3 rounded-md border border-border text-xs font-medium text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                  {rejectingId === item.id && (
                    <div className="mt-3 border-t border-border pt-3">
                      <textarea
                        placeholder="Why are you rejecting this?"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 mb-2"
                        rows={2}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason("");
                          }}
                          className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onReject?.(item, rejectReason.trim() || undefined);
                            setRejectingId(null);
                            setRejectReason("");
                          }}
                          className="h-7 px-3 rounded-md bg-destructive text-destructive-foreground text-xs font-medium"
                        >
                          Submit Rejection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Resolved (collapsible) */}
        {resolved.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowResolved(!showResolved)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={cn(
                  "transition-transform",
                  showResolved && "rotate-180",
                )}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              Resolved ({resolved.length})
            </button>
            {showResolved && (
              <div className="space-y-2">
                {resolved.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-4 opacity-60"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-foreground">
                        {item.title}
                      </h4>
                      {renderTypeBadge?.(item.type)}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          item.status === "approved" &&
                            "bg-emerald-500/10 text-emerald-500",
                          item.status === "rejected" &&
                            "bg-destructive/10 text-destructive",
                          item.status === "executed" &&
                            "bg-primary/10 text-primary",
                        )}
                      >
                        {item.status}
                      </span>
                    </div>
                    {item.meta?.rejectionReason && (
                      <p className="mt-1 text-xs text-destructive">
                        Reason: {String(item.meta.rejectionReason)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
