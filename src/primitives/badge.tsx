import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/15 border-destructive/25 text-destructive",
        outline: "text-foreground border-border",
        success:
          "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]",
        warning:
          "border-[var(--surface-warning-border)] bg-[var(--surface-warning-bg)] text-[var(--surface-warning-text)]",
        error:
          "border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] text-[var(--surface-danger-text)]",
        info:
          "border-[var(--surface-info-border)] bg-[var(--surface-info-bg)] text-[var(--surface-info-text)]",
        sandbox:
          "border-border bg-[var(--accent-surface-soft)] text-[var(--accent-text)]",
        /* Operational status variants */
        running:
          "border-[var(--surface-teal-border)] bg-[var(--surface-teal-bg)] text-[var(--surface-teal-text)]",
        creating:
          "border-[var(--surface-violet-border)] bg-[var(--surface-violet-bg)] text-[var(--surface-violet-text)]",
        stopped:
          "border-[var(--surface-warning-border)] bg-[var(--surface-warning-bg)] text-[var(--surface-warning-text)]",
        warm:
          "border-[var(--surface-orange-border)] bg-[var(--surface-orange-bg)] text-[var(--surface-orange-text)]",
        cold:
          "border-[var(--surface-info-border)] bg-[var(--surface-info-bg)] text-[var(--surface-info-text)]",
        deleted:
          "border-[var(--surface-neutral-border)] bg-[var(--surface-neutral-bg)] text-[var(--surface-neutral-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "sandbox"
  | "running"
  | "creating"
  | "stopped"
  | "warm"
  | "cold"
  | "deleted"
  | null;

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  variant?: BadgeVariant;
  className?: string;
  children?: React.ReactNode;
  dot?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
  id?: string;
  role?: React.AriaRole;
  title?: string;
  [key: string]: unknown;
}

const statusDotClass: Record<string, string> = {
  running: "status-dot status-dot-running",
  creating: "status-dot status-dot-creating",
  stopped: "status-dot status-dot-stopped",
  warm: "status-dot status-dot-warm",
  cold: "status-dot status-dot-cold",
  error: "status-dot status-dot-error",
  deleted: "status-dot status-dot-deleted",
};

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  const dotClass = dot && variant ? statusDotClass[variant] : null;

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dotClass && <span className={dotClass} aria-hidden />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
