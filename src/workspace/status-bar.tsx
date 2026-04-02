/**
 * StatusBar — bottom bar with model selector, context badges, credits.
 */

import { cn } from "../lib/utils";
import { Zap, FileText, X } from "lucide-react";

export interface ContextBadge {
  id: string;
  label: string;
  count?: number;
}

export interface StatusBarProps {
  modelLabel?: string;
  onModelClick?: () => void;
  credits?: number;
  contextBadges?: ContextBadge[];
  onRemoveBadge?: (id: string) => void;
  status?: "connected" | "connecting" | "disconnected" | "provisioning";
  className?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  connected: { label: "", color: "bg-[var(--code-success)]" },
  connecting: { label: "Connecting...", color: "bg-[var(--code-number)]" },
  disconnected: { label: "Disconnected", color: "bg-[var(--code-error)]" },
  provisioning: { label: "Provisioning...", color: "bg-[var(--code-number)]" },
};

export function StatusBar({
  modelLabel,
  onModelClick,
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
        "flex items-center gap-3 px-3 py-1 border-t border-border bg-muted/20 text-[12px]",
        className,
      )}
    >
      {/* Model selector */}
      {modelLabel && (
        <button
          onClick={onModelClick}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] border border-border text-muted-foreground hover:border-primary/20 hover:text-foreground transition-colors"
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", statusInfo.color)} />
          {modelLabel}
        </button>
      )}

      {/* Status label */}
      {statusInfo.label && (
        <span className="text-muted-foreground">{statusInfo.label}</span>
      )}

      {/* Context badges */}
      {contextBadges.map((badge) => (
        <span
          key={badge.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border border-border text-foreground bg-[var(--border-accent)]/5"
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
          <Zap className="h-3 w-3" />
          {credits.toLocaleString()} credits
        </span>
      )}
    </div>
  );
}
