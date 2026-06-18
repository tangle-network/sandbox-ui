import type { ElementType, ReactNode } from "react";
import { cn } from "../lib/utils";

/**
 * Canonical type roles for the Tangle design system. Every title in every
 * product app should be a Heading (or a PageHeader / SectionTitle composite
 * built on it) so size, weight, tracking, and leading stay identical across
 * surfaces. Sizes/leadings/tracking resolve from @tangle-network/brand tokens
 * (with literal fallbacks so the component still renders if brand styles are
 * absent, e.g. in isolation tests or Storybook).
 *
 * Weights are deliberately quiet (Tangle Quiet): heroes at 700, titles at 600
 * — never extrabold.
 */
export type HeadingRole =
  | "display" // marketing hero headline
  | "hero" // secondary hero / large marketing section head
  | "page" // the page title (dashboard h1, marketing section h2)
  | "section" // section heading inside a page (h2)
  | "subsection" // sub-section heading (h3)
  | "eyebrow"; // uppercase label above a title

const ROLE_CLASS: Record<HeadingRole, string> = {
  display:
    "font-display font-bold text-foreground text-[length:var(--font-size-display,3rem)] leading-[var(--line-height-display,1.05)] tracking-[var(--tracking-tight,-0.02em)]",
  hero: "font-display font-bold text-foreground text-[length:var(--font-size-hero,2.5rem)] leading-[1.1] tracking-[var(--tracking-tight,-0.02em)]",
  page: "font-display font-semibold text-foreground text-[length:var(--font-size-3xl,1.875rem)] leading-[var(--line-height-heading,1.15)] tracking-[var(--tracking-tight,-0.02em)]",
  section:
    "font-display font-semibold text-foreground text-[length:var(--font-size-xl,1.25rem)] leading-[1.3] tracking-[var(--tracking-snug,-0.01em)]",
  subsection:
    "font-semibold text-foreground text-[length:var(--font-size-lg,1rem)] leading-[1.4]",
  eyebrow:
    "font-semibold uppercase text-muted-foreground text-[length:var(--font-size-sm,0.75rem)] leading-none tracking-[var(--tracking-wide,0.08em)]",
};

const DEFAULT_TAG: Record<HeadingRole, ElementType> = {
  display: "h1",
  hero: "h2",
  page: "h1",
  section: "h2",
  subsection: "h3",
  eyebrow: "p",
};

export interface HeadingProps {
  role: HeadingRole;
  /** Override the rendered element (defaults to the semantic tag for the role). */
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
}

export function Heading({ role, as, className, children, ...rest }: HeadingProps) {
  const Tag = as ?? DEFAULT_TAG[role];
  return (
    <Tag className={cn(ROLE_CLASS[role], className)} {...rest}>
      {children}
    </Tag>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Uppercase label rendered above the title. */
  eyebrow?: ReactNode;
  /** Primary action(s), right-aligned on wide viewports. */
  action?: ReactNode;
  className?: string;
  /** Override the title element (default h1). */
  titleAs?: ElementType;
}

/**
 * Standard page header: one title size, one description style, one action
 * slot — used by every page so titles never drift between surfaces.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
  titleAs,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1.5">
        {eyebrow ? <Heading role="eyebrow">{eyebrow}</Heading> : null}
        <Heading role="page" as={titleAs}>
          {title}
        </Heading>
        {description ? (
          <p className="max-w-2xl text-[length:var(--font-size-base,0.9375rem)] text-muted-foreground leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

export interface SectionTitleProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Section heading inside a page — smaller than PageHeader, same rhythm. */
export function SectionTitle({
  title,
  description,
  action,
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <Heading role="section">{title}</Heading>
        {description ? (
          <p className="max-w-xl text-[length:var(--font-size-sm,0.75rem)] text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Canonical page container — one max-width, one gutter, one vertical rhythm
 * so every page sits on the same grid. Gutter widens on large viewports.
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
