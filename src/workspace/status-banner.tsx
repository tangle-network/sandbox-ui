/**
 * StatusBanner — full-width notification banner for connection/provisioning states.
 */

import { Loader2, AlertCircle, AlertTriangle, CheckCircle, Wifi, WifiOff } from "lucide-react";
import { cn } from "../lib/utils";

export type BannerType =
  | "provisioning"
  | "connecting"
  | "error"
  | "warning"
  | "success"
  | "info";

export interface StatusBannerProps {
  type: BannerType;
  message: string;
  detail?: string;
  onDismiss?: () => void;
  className?: string;
}

const BANNER_STYLES: Record<
  BannerType,
  { bg: string; border: string; text: string; icon: typeof Loader2 }
> = {
  provisioning: { bg: "bg-primary/5", border: "border-primary/20", text: "text-primary", icon: Loader2 },
  connecting: { bg: "bg-[var(--code-number)]/5", border: "border-[var(--code-number)]/20", text: "text-[var(--code-number)]", icon: Wifi },
  error: { bg: "bg-[var(--code-error)]/5", border: "border-[var(--code-error)]/20", text: "text-[var(--code-error)]", icon: AlertCircle },
  // Degraded, not broken: the thing still works, with less than was asked for.
  // `error` would overstate it and `info` would understate it, and a notice
  // styled as neither gets read as neither. Uses the brand's theme-reactive
  // `--surface-warning-*` triple rather than a `warning` color utility —
  // `warning` is not registered in this package's `@theme`, so `bg-warning`
  // and friends emit no rule at all.
  warning: {
    bg: "bg-[var(--surface-warning-bg)]",
    border: "border-[var(--surface-warning-border)]",
    text: "text-[var(--surface-warning-text)]",
    icon: AlertTriangle,
  },
  success: { bg: "bg-[var(--code-success)]/5", border: "border-[var(--code-success)]/20", text: "text-[var(--code-success)]", icon: CheckCircle },
  info: { bg: "bg-surface-container-high", border: "border-[var(--md3-outline-variant)]", text: "text-muted-foreground", icon: AlertCircle },
};

export function StatusBanner({ type, message, detail, onDismiss, className }: StatusBannerProps) {
  const style = BANNER_STYLES[type];
  const Icon = style.icon;
  const isAnimated = type === "provisioning" || type === "connecting";
  // Every variant is inserted after first paint — a degradation arrives on a
  // live frame or an async status read, provisioning resolves, a connection
  // drops — so without a live region a screen reader is told nothing at all.
  // `alert` interrupts, which is right for a failure and wrong for a session
  // that still runs, so only `error` gets it.
  const role = type === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 border-b font-sans text-sm",
        style.bg,
        style.border,
        className,
      )}
    >
      {/* While provisioning/connecting the spin is the only thing saying the
          work is still in flight, so it stays under reduced motion. */}
      <Icon
        className={cn("h-4 w-4 shrink-0", style.text, isAnimated && "animate-spin")}
        {...(isAnimated ? { "data-motion": "essential" } : {})}
      />
      <span className="font-medium text-foreground">{message}</span>
      {detail && (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{detail}</span>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-auto font-sans text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
