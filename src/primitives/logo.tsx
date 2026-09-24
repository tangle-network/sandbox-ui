import { Logo as BrandLogo } from "@tangle-network/brand";

export { TangleKnot } from "@tangle-network/brand";

export interface LogoProps {
  variant?: "sandbox";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  iconOnly?: boolean;
}

/** Keep the Sandbox wordmark API while Brand owns the mark and layout. */
export function Logo({
  variant = "sandbox",
  size = "md",
  className,
  iconOnly = false,
}: LogoProps) {
  return (
    <BrandLogo
      size={size}
      variant={iconOnly ? "icon" : "full"}
      suffix={variant === "sandbox" ? "Sandbox" : null}
      className={className}
    />
  );
}

Logo.displayName = "Logo";
