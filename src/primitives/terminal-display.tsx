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
      sandbox: "border-[var(--border-accent)] shadow-[var(--shadow-accent)]",
    };

    const dotColors = {
      default: ["bg-red-500", "bg-yellow-500", "bg-green-500"],
      sandbox: ["bg-red-500", "bg-yellow-500", "bg-[var(--brand-cool)]"],
    };

    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden rounded-xl border bg-[#0a0a0a] font-mono text-sm",
          variants[variant],
          className,
        )}
        {...props}
      >
        {showHeader && (
          <div className="flex items-center gap-2 border-border/50 border-b bg-card/30 px-4 py-3">
            <div className="flex gap-1.5">
              {dotColors[variant].map((color) => (
                <div
                  key={color}
                  className={cn("h-3 w-3 rounded-full", color)}
                />
              ))}
            </div>
            <span className="ml-2 text-muted-foreground text-xs">{title}</span>
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
      input: "text-foreground",
      output: "text-muted-foreground",
      error: "text-red-400",
      success: "text-green-400",
      info: "text-blue-400",
      thinking: "text-yellow-400 animate-pulse",
      command: "text-foreground",
      warning: "text-yellow-400",
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
          <span className="shrink-0 select-none text-green-400">{prompt}</span>
        )}
        {type === "thinking" && (
          <span className="shrink-0 select-none">...</span>
        )}
        {timestamp && (
          <span className="shrink-0 select-none text-muted-foreground/50">
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
      default: "border-border focus-within:border-muted-foreground",
      sandbox: "border-[var(--border-accent)] focus-within:border-[var(--border-accent-hover)]",
    };

    return (
      <div
        className={cn(
          "flex items-center rounded-lg border bg-[#0a0a0a] px-4 py-2.5 font-mono text-sm transition-colors",
          variants[variant],
          className,
        )}
      >
        <span className="mr-2 select-none text-green-400">$</span>
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
