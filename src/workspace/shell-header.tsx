import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../lib/utils";

/**
 * One height for every header row in the app shell: the sidebar rail's top row,
 * the main pane, side panels, drawers and the assistant. Their bottom dividers
 * share one y, so the main header's underline continues the sidebar's.
 * Brand owns the value (`--shell-header-height`, 56px).
 */
export const SHELL_HEADER_HEIGHT = "var(--shell-header-height, 3.5rem)";

/**
 * An inset pane sits one gutter plus its 1px border below the shell top, so its
 * header is shorter by exactly that amount and its divider lands on the same y.
 */
export const SHELL_INSET_GUTTER = "var(--shell-inset-gutter, 0.5rem)";
const SHELL_INSET_HEADER_HEIGHT = `calc(${SHELL_HEADER_HEIGHT} - ${SHELL_INSET_GUTTER} - 1px)`;

export type ShellHeaderProps = HTMLAttributes<HTMLElement> & {
  /** Render as `<header>` (a page or pane landmark) instead of a `<div>`. */
  as?: "div" | "header";
  /** The header of a pane raised inside the inset gutter. */
  inset?: boolean;
  /** Draw the bottom divider. Off only for a row that sits on a surface which draws its own. */
  divider?: boolean;
};

/**
 * The shell's header row. Content fills it; nothing changes its height: the
 * height is set inline after `style`, so neither a class nor a style prop can
 * move this row's divider off the shared line.
 */
export function ShellHeader({
  as: Tag = "div",
  inset = false,
  divider = true,
  className,
  style,
  ...props
}: ShellHeaderProps) {
  const height = inset ? SHELL_INSET_HEADER_HEIGHT : SHELL_HEADER_HEIGHT;
  const fixed: CSSProperties = { ...style, height, minHeight: height, maxHeight: height, boxSizing: "border-box" };
  return (
    <Tag
      data-shell-header={inset ? "inset" : ""}
      className={cn(
        "flex shrink-0 items-center px-3",
        divider && "border-b border-border",
        inset ? "bg-transparent px-2" : "bg-card",
        className,
      )}
      style={fixed}
      {...props}
    />
  );
}

/** @deprecated Use `ShellHeader`; kept so existing imports keep the shared row. */
export const WorkspacePaneHeader = ShellHeader;
/** @deprecated Use `ShellHeaderProps`. */
export type WorkspacePaneHeaderProps = ShellHeaderProps;
