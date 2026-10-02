import type { HTMLAttributes, ElementType, ReactNode } from "react";
import { PageHeader as CanonicalPageHeader } from "@tangle-network/ui/primitives";
import type { HeadingVariant } from "@tangle-network/ui/primitives";
import { cn } from "../lib/utils";

// Preserve relative imports as well as the public /primitives entry. These are
// the upstream bindings, not wrappers with a second set of typography classes.
export {
  Heading,
  type HeadingVariant,
  PageHeader,
  type PageHeaderProps,
} from "@tangle-network/ui/primitives";

/** The existing Sandbox type contract; the canonical component also accepts variant. */
export interface HeadingProps extends Omit<HTMLAttributes<HTMLElement>, "role"> {
  role: HeadingVariant;
  as?: ElementType;
  children: ReactNode;
}

export interface SectionTitleProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Legacy section API, composed through the one canonical header renderer. */
export function SectionTitle({ className, ...props }: SectionTitleProps) {
  return <CanonicalPageHeader {...props} level={2} className={cn("mb-0", className)} />;
}
