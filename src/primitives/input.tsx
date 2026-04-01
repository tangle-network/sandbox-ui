import * as React from "react";
import { cn } from "../lib/utils";

import { cva, type VariantProps } from "class-variance-authority";

const inputVariants = cva(
  "flex w-full rounded-lg border bg-[var(--depth-2)] px-4 py-2 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:font-medium file:text-sm",
  {
    variants: {
      variant: {
        default: "border-input focus:ring-ring",
        sandbox: "border-[var(--border-accent)] focus:border-[var(--border-accent-hover)] focus:ring-[var(--border-accent)]",
        error: "border-[var(--surface-danger-border)] focus:ring-[var(--surface-danger-border)]",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-3",
        lg: "h-12 px-5",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, variant, size, label, error, hint, id, ...props },
    ref,
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    const input = (
      <input
        type={type}
        id={inputId}
        className={cn(inputVariants({ variant: error ? "error" : variant, size, className }))}
        ref={ref}
        {...props}
      />
    );

    if (!label && !error && !hint) return input;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block font-medium text-foreground text-sm"
          >
            {label}
          </label>
        )}
        {input}
        {error && <p className="text-[var(--surface-danger-text)] text-sm font-medium">{error}</p>}
        {hint && !error && (
          <p className="text-muted-foreground/70 text-sm">{hint}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "sandbox";
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, variant = "default", label, error, hint, id, ...props },
    ref,
  ) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    const variants = {
      default: "border-input focus:ring-ring",
      sandbox:
        "border-[var(--border-accent)] focus:border-[var(--border-accent-hover)] focus:ring-[var(--border-accent)]",
    };

    const textarea = (
      <textarea
        id={textareaId}
        className={cn(
          "flex min-h-[120px] w-full resize-y rounded-lg border bg-[var(--depth-2)] px-4 py-3 text-sm transition-all duration-200",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-[var(--surface-danger-border)] focus:ring-[var(--surface-danger-border)]" : variants[variant],
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    if (!label && !error && !hint) return textarea;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block font-medium text-muted-foreground text-sm"
          >
            {label}
          </label>
        )}
        {textarea}
        {error && <p className="text-[var(--surface-danger-text)] text-sm">{error}</p>}
        {hint && !error && (
          <p className="text-muted-foreground/70 text-sm">{hint}</p>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
