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

const BANNER_STYLES: Record<BannerType, { bg: string; border: string; icon: typeof Loader2 }> = {
  provisioning: { bg: "bg-primary/5", border: "border-primary/20", icon: Loader2 },
  connecting: { bg: "bg-[var(--code-number)]/5", border: "border-[var(--code-number)]/20", icon: Wifi },
  error: { bg: "bg-[var(--code-error)]/5", border: "border-[var(--code-error)]/20", icon: AlertCircle },
  success: { bg: "bg-[var(--code-success)]/5", border: "border-[var(--code-success)]/20", icon: CheckCircle },
  info: { bg: "bg-muted/50", border: "border-border", icon: AlertCircle },
};

export function StatusBanner({ type, message, detail, onDismiss, className }: StatusBannerProps) {
  const style = BANNER_STYLES[type];
  const Icon = style.icon;
  const isAnimated = type === "provisioning" || type === "connecting";

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2 border-b text-sm", style.bg, style.border, className)}>
      <Icon className={cn("h-4 w-4 shrink-0", isAnimated && "animate-spin")} />
      <span className="text-foreground">{message}</span>
      {detail && <span className="text-muted-foreground text-xs">{detail}</span>}
      {onDismiss && (
        <button onClick={onDismiss} className="ml-auto text-muted-foreground hover:text-foreground text-xs">
          Dismiss
        </button>
      )}
    </div>
  );
}
