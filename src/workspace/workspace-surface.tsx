import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";
import { ShellHeader, SHELL_INSET_GUTTER } from "./shell-header";

export type WorkspaceSurfaceFrameProps = HTMLAttributes<HTMLDivElement>;

/**
 * The raised panel every workspace page sits in: an even gutter of recessed
 * backdrop on every side, then one rounded, bordered surface. `WorkspaceLayout`
 * with `surface="inset"` draws its center and right panes inside this frame, and
 * `WorkspaceSurface` draws a single page inside it, so the chat and every other
 * page share one silhouette and one header line.
 */
export function WorkspaceSurfaceFrame({ className, children, ...props }: WorkspaceSurfaceFrameProps) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 bg-[var(--md3-surface-dim)]"
      style={{ padding: SHELL_INSET_GUTTER }}
    >
      <div
        data-workspace-surface
        className={cn(
          "flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--md3-outline-variant)] bg-background shadow-[var(--shadow-card)]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export interface WorkspaceSurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The page's name, left in the header row. */
  title?: ReactNode;
  /** Controls at the right of the header row: filters, a primary action. */
  actions?: ReactNode;
  /** Replaces `title` and `actions` when a page needs its own header layout. */
  header?: ReactNode;
  /** Classes for the scrolling body under the header. */
  contentClassName?: string;
  children?: ReactNode;
}

/**
 * One page of a workspace (assets, tasks, activity, integrations, a terminal…)
 * on the same floating panel as the chat. The header is an inset `ShellHeader`,
 * so its divider continues the sidebar's first divider; the body scrolls inside
 * the panel and the panel never scrolls the page.
 */
export function WorkspaceSurface({
  title,
  actions,
  header,
  contentClassName,
  children,
  ...props
}: WorkspaceSurfaceProps) {
  return (
    <WorkspaceSurfaceFrame {...props}>
      <main className="relative flex min-w-0 flex-1 flex-col">
        <ShellHeader inset data-workspace-header="center" className="gap-2">
          {header ?? (
            <>
              <div className="min-w-0 flex-1 truncate font-medium">{title}</div>
              {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
            </>
          )}
        </ShellHeader>
        <div className={cn("min-h-0 flex-1 overflow-auto", contentClassName)}>{children}</div>
      </main>
    </WorkspaceSurfaceFrame>
  );
}
