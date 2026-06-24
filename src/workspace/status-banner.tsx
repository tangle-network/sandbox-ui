/**
 * StatusBanner — full-width notification banner for connection/provisioning states.
 */

import { Loader2, AlertCircle, CheckCircle, Wifi, WifiOff } from "lucide-react";
import { cn } from "../lib/utils";

export type BannerType = "provisioning" | "connecting" | "error" | "success" | "info";

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
  success: { bg: "bg-[var(--code-success)]/5", border: "border-[var(--code-success)]/20", text: "text-[var(--code-success)]", icon: CheckCircle },
  info: { bg: "bg-surface-container-high", border: "border-[var(--md3-outline-variant)]", text: "text-muted-foreground", icon: AlertCircle },
};

export function StatusBanner({ type, message, detail, onDismiss, className }: StatusBannerProps) {
  const style = BANNER_STYLES[type];
  const Icon = style.icon;
  const isAnimated = type === "provisioning" || type === "connecting";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 border-b font-sans text-sm",
        style.bg,
        style.border,
        className,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", style.text, isAnimated && "animate-spin")} />
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
