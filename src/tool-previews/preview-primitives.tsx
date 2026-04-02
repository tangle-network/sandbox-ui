import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

export interface PreviewCardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PreviewCard({
  icon,
  title,
  description,
  meta,
  children,
  className,
}: PreviewCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] bg-[var(--depth-1)] px-[var(--tool-card-px)] py-[var(--tool-card-py)]">
        <div className="flex h-[var(--tool-icon-size)] w-[var(--tool-icon-size)] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-accent)] bg-[var(--bg-section)] text-[var(--brand-cool)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{title}</span>
            {description ? (
              <span className="truncate text-xs font-mono text-muted-foreground">{description}</span>
            ) : null}
          </div>
        </div>
        {meta ? (
          <div className="shrink-0 text-xs text-muted-foreground">{meta}</div>
        ) : null}
      </div>
      {children ? <div className="space-y-2 px-[var(--tool-card-px)] py-[var(--tool-card-py)]">{children}</div> : null}
    </div>
  );
}

export function PreviewEmpty({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-2.5 text-xs text-[var(--text-muted)]",
        className,
      )}
    >
      {label}
    </div>
  );
}

export function PreviewError({ error }: { error: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] px-3 py-3 text-sm text-[var(--surface-danger-text)]">
      {error}
    </div>
  );
}

export function PreviewLoading({ label = "Running…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-2 text-xs text-[var(--text-muted)]">
      <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-cool)]" />
      <span>{label}</span>
    </div>
  );
}
