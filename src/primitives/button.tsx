import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary/20 border border-primary/30 text-primary hover:text-primary-foreground shadow-[var(--shadow-accent)] hover:bg-primary hover:shadow-[var(--shadow-glow)] active:scale-[0.97] duration-[var(--transition-fast)]",
        destructive:
          "bg-destructive/10 border border-destructive/30 text-destructive hover:text-destructive-foreground hover:bg-destructive/80 active:scale-[0.97] duration-[var(--transition-fast)]",
        outline:
          "border border-border bg-card/50 backdrop-blur-xl hover:bg-muted hover:border-primary/20 active:scale-[0.97] duration-[var(--transition-fast)] text-foreground shadow-sm",
        secondary:
          "bg-muted/50 border border-border text-foreground backdrop-blur-xl hover:bg-muted active:scale-[0.97] duration-[var(--transition-fast)] shadow-sm",
        ghost:
          "hover:bg-muted hover:text-foreground duration-[var(--transition-fast)] text-muted-foreground border border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
        sandbox:
          "bg-[image:var(--accent-gradient-strong)] text-white shadow-[var(--shadow-accent)] backdrop-blur-2xl border border-[var(--border-accent)] hover:brightness-110 active:scale-[0.97] duration-[var(--transition-fast)]",
      },
      size: {
        default: "h-[var(--control-height)] px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-7 text-sm",
        xl: "h-13 rounded-xl px-9 text-base",
        icon: "h-[var(--control-height)] w-[var(--control-height)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "sandbox" | null;
  size?: "default" | "sm" | "lg" | "xl" | "icon" | null;
  asChild?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // When using asChild, we can't add the loading spinner as it would create multiple children
    // which breaks Slot's single-child requirement
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 -ml-1 h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <title>Loading spinner</title>
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
