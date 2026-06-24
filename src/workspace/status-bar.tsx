/**
 * StatusBar — compact bottom bar: connection state, file/artifact context
 * badges, credits. The active model lives in the input box, not here.
 */

import { cn } from "../lib/utils";
import { Zap, FileText, X } from "lucide-react";

export interface ContextBadge {
  id: string;
  label: string;
  count?: number;
}

export interface StatusBarProps {
  /** @deprecated The model now lives in the input box; the status bar no longer
   *  renders it. Retained so existing callers keep type-checking. */
  modelLabel?: string;
  /** @deprecated See `modelLabel`. */
  onModelClick?: () => void;
  credits?: number;
  contextBadges?: ContextBadge[];
  onRemoveBadge?: (id: string) => void;
  status?: "connected" | "connecting" | "disconnected" | "provisioning";
  className?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  connected: { label: "Connected", color: "bg-[var(--code-success)]" },
  connecting: { label: "Connecting…", color: "bg-[var(--code-number)]" },
  disconnected: { label: "Disconnected", color: "bg-[var(--code-error)]" },
  provisioning: { label: "Provisioning…", color: "bg-[var(--code-number)]" },
};

export function StatusBar({
  credits,
  contextBadges = [],
  onRemoveBadge,
  status = "connected",
  className,
}: StatusBarProps) {
  const statusInfo = STATUS_LABELS[status];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-1 border-t border-[var(--md3-outline-variant)] bg-surface-container-high font-sans text-[12px]",
        className,
      )}
    >
      {/* Connection */}
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className={cn("w-1.5 h-1.5 rounded-full", statusInfo.color)} />
        {statusInfo.label}
      </span>

      {/* Context badges */}
      {contextBadges.map((badge) => (
        <span
          key={badge.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border border-[var(--md3-outline-variant)] text-foreground bg-[var(--border-accent)]/5"
        >
          <FileText className="h-3 w-3" />
          {badge.label}
          {badge.count !== undefined && (
            <span className="text-muted-foreground">{badge.count}</span>
          )}
          {onRemoveBadge && (
            <button
              onClick={() => onRemoveBadge(badge.id)}
              className="hover:text-foreground transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}

      <div className="flex-1" />

      {/* Credits */}
      {credits !== undefined && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Zap className="h-3 w-3 shrink-0" />
          <span className="font-mono tabular-nums">{credits.toLocaleString()}</span>
          <span>credits</span>
        </span>
      )}
    </div>
  );
}
