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
        "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] bg-[var(--depth-1)] px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-accent)] bg-[var(--bg-section)] text-[var(--brand-cool)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </div>
          {description ? (
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {description}
            </div>
          ) : null}
        </div>
        {meta ? (
          <div className="shrink-0 text-xs text-[var(--text-muted)]">{meta}</div>
        ) : null}
      </div>
      {children ? <div className="space-y-3 px-4 py-4">{children}</div> : null}
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
        "rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-4 text-sm text-[var(--text-muted)]",
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
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-3 text-sm text-[var(--text-muted)]">
      <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-cool)]" />
      <span>{label}</span>
    </div>
  );
}
