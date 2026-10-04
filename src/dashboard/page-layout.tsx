import type { ReactNode } from "react";
import { PageHeader, PageShell } from "@tangle-network/ui/primitives";
import { cn } from "../lib/utils";

export interface SandboxPageShellProps {
  children: ReactNode;
  className?: string;
}

/** Product page spacing; the generic UI PageShell remains an exact re-export. */
export function SandboxPageShell({ children, className }: SandboxPageShellProps) {
  return <PageShell className={cn("max-w-none space-y-5 px-4 py-6 sm:px-6 lg:px-8", className)}>{children}</PageShell>;
}

export interface DashboardPageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DashboardPageHeader({ title, description, actions, className }: DashboardPageHeaderProps) {
  return <PageHeader title={title} description={description} actions={actions}
    className={cn("gap-3 [&_h1]:text-2xl sm:[&_h1]:text-[28px] [&_h1]:font-semibold [&_p]:text-base [&_p]:leading-relaxed", className)} />;
}
