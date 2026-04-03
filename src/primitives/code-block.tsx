// Re-exports the canonical themed CodeBlock from the markdown package.
// Kept here for backwards compatibility with openui and other importers.
export { CodeBlock, CopyButton } from "../markdown/code-block";
export type { CodeBlockProps } from "../markdown/code-block";

import { cn } from "../lib/utils";

export interface InlineCodeProps extends React.HTMLAttributes<HTMLElement> {}

export function InlineCode({ className, children, ...props }: InlineCodeProps) {
  return (
    <code
      className={cn(
        "rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--code-keyword)]",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}
