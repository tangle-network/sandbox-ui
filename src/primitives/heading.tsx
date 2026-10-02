import { PageHeader } from "@tangle-network/ui/primitives";
import type { HeadingVariant, PageHeaderProps } from "@tangle-network/ui/primitives";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

// Retain relative imports used by existing Sandbox compositions and stories.
// UI owns the renderer, semantic defaults, legacy role/action/titleAs inputs,
// class merging and refs. Do not wrap or copy these bindings.
export {
  Heading,
  type HeadingVariant,
  PageHeader,
  type PageHeaderProps,
} from "@tangle-network/ui/primitives";

/** Preserve the existing public type's required visual role and children.
 * The binding above remains UI's object, without a local render function.
 */
export interface HeadingProps extends Omit<HTMLAttributes<HTMLElement>, "role"> {
  role: HeadingVariant;
  as?: ElementType;
  children: ReactNode;
}

export type SectionTitleProps = Pick<
  PageHeaderProps,
  "title" | "description" | "action" | "className"
>;

/** Compatibility name for the canonical nested (h2) page header. */
export function SectionTitle(props: SectionTitleProps) {
  return <PageHeader {...props} level={2} />;
}
