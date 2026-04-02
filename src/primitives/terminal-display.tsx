import * as React from "react";
import { useEffect, useRef } from "react";
import { cn } from "../lib/utils";

export interface TerminalDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "sandbox";
  title?: string;
  showHeader?: boolean;
  autoScroll?: boolean;
  maxHeight?: string;
}

const TerminalDisplay = React.forwardRef<HTMLDivElement, TerminalDisplayProps>(
  (
    {
      className,
      variant = "default",
      title = "Terminal",
      showHeader = true,
      autoScroll = true,
      maxHeight = "400px",
      children,
      ...props
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (autoScroll && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [autoScroll]);

    const variants = {
      default: "border-border",
      sandbox: "border-border shadow-[var(--shadow-accent)]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden rounded-xl border bg-background font-mono text-sm",
          variants[variant],
          className,
        )}
        {...props}
      >
        {showHeader && (
          <div className="flex items-center border-b border-border bg-card px-4 py-3">
            <span className="text-muted-foreground text-xs">{title}</span>
          </div>
        )}
        <div
          ref={containerRef}
          className="overflow-auto p-4"
          style={{ maxHeight }}
        >
          {children}
        </div>
      </div>
    );
  },
);
TerminalDisplay.displayName = "TerminalDisplay";

export interface TerminalLineProps
  extends React.HTMLAttributes<HTMLDivElement> {
  type?:
    | "input"
    | "output"
    | "error"
    | "success"
    | "info"
    | "thinking"
    | "command"
    | "warning";
  prompt?: string;
  timestamp?: string;
}

const TerminalLine = React.forwardRef<HTMLDivElement, TerminalLineProps>(
  (
    { className, type = "output", prompt = "$", timestamp, children, ...props },
    ref,
  ) => {
    const typeStyles = {
      input:    "text-foreground",
      output:   "text-foreground",
      error:    "text-[var(--surface-danger-text)]",
      success:  "text-[var(--surface-success-text)]",
      info:     "text-[var(--surface-info-text)]",
      thinking: "text-[var(--surface-warning-text)] animate-pulse",
      command:  "text-foreground",
      warning:  "text-[var(--surface-warning-text)]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-start gap-2 py-0.5 leading-relaxed",
          typeStyles[type],
          className,
        )}
        {...props}
      >
        {(type === "input" || type === "command") && (
          <span className="shrink-0 select-none text-[var(--surface-success-text)]">{prompt}</span>
        )}
        {type === "thinking" && (
          <span className="shrink-0 select-none">...</span>
        )}
        {timestamp && (
          <span className="shrink-0 select-none text-muted-foreground opacity-50">
            [{timestamp}]
          </span>
        )}
        <span className="whitespace-pre-wrap break-all">{children}</span>
      </div>
    );
  },
);
TerminalLine.displayName = "TerminalLine";

const TerminalCursor = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground",
      className,
    )}
    {...props}
  />
));
TerminalCursor.displayName = "TerminalCursor";

export interface TerminalInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onSubmit"> {
  onSubmit?: (value: string) => void;
  variant?: "default" | "sandbox";
}

const TerminalInput = React.forwardRef<HTMLInputElement, TerminalInputProps>(
  ({ className, onSubmit, variant = "default", ...props }, ref) => {
    const [value, setValue] = React.useState("");

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim() && onSubmit) {
        onSubmit(value.trim());
        setValue("");
      }
    };

    const variants = {
      default: "border-border focus-within:border-border",
      sandbox: "border-border focus-within:border-[var(--border-accent-hover)]",
    };

    return (
      <div
        className={cn(
          "flex items-center rounded-lg border bg-background px-4 py-2.5 font-mono text-sm transition-colors",
          variants[variant],
          className,
        )}
      >
        <span className="mr-2 select-none text-[var(--surface-success-text)]">$</span>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          {...props}
        />
        <TerminalCursor />
      </div>
    );
  },
);
TerminalInput.displayName = "TerminalInput";

export { TerminalDisplay, TerminalLine, TerminalCursor, TerminalInput };
