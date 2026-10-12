import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";
import { ShellHeader } from "./shell-header";

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
    <div className="flex min-h-0 min-w-0 flex-1 bg-[var(--md3-surface-dim)] p-[var(--shell-inset-gutter,0.5rem)]">
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

export type WorkspaceSurfaceHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface WorkspaceSurfaceTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Heading level; a page on the panel is the page, so it defaults to 1. */
  level?: WorkspaceSurfaceHeadingLevel;
}

/**
 * The page's heading in a surface header row. `WorkspaceSurface` renders it for
 * `title`; a custom `header` uses it so the page still has its heading. It keeps
 * the header's type: the heading element changes the outline, not the look.
 */
export function WorkspaceSurfaceTitle({ level = 1, className, ...props }: WorkspaceSurfaceTitleProps) {
  const Heading = `h${level}` as const;
  return (
    <Heading
      data-workspace-surface-title
      className={cn("m-0 min-w-0 flex-1 truncate text-[length:inherit] font-medium leading-[inherit]", className)}
      {...props}
    />
  );
}

export interface WorkspaceSurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The page's name, left in the header row and rendered as the page heading. */
  title?: ReactNode;
  /** Heading level for `title` (default 1). */
  headingLevel?: WorkspaceSurfaceHeadingLevel;
  /** Controls at the right of the header row: filters, a primary action. */
  actions?: ReactNode;
  /** Replaces `title` and `actions` when a page needs its own header layout; put a `WorkspaceSurfaceTitle` in it. */
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
  headingLevel,
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
              {title != null ? (
                <WorkspaceSurfaceTitle level={headingLevel}>{title}</WorkspaceSurfaceTitle>
              ) : (
                // No title, no empty heading: a spacer keeps the actions at the right.
                <div className="flex-1" />
              )}
              {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
            </>
          )}
        </ShellHeader>
        <div className={cn("min-h-0 flex-1 overflow-auto", contentClassName)}>{children}</div>
      </main>
    </WorkspaceSurfaceFrame>
  );
}
