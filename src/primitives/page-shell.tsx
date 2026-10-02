import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Canonical page container — one max-width, one gutter, one vertical rhythm
 * so every page sits on the same grid. Gutter widens on large viewports.
 * Layout primitive (not a heading); kept in its own module so consumers
 * looking for page layout don't have to reach into the typography file.
 */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl space-y-8 px-6 py-8 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
