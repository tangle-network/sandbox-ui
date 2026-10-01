import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

export type WorkspacePaneHeaderProps = HTMLAttributes<HTMLDivElement>;

/**
 * The shared 56px header row for top-level workspace panes and drawers.
 * Bottom runtime panels intentionally use their own compact header.
 */
export function WorkspacePaneHeader({
  className,
  ...props
}: WorkspacePaneHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center border-b border-border bg-card px-3",
        className,
      )}
      {...props}
    />
  );
}
