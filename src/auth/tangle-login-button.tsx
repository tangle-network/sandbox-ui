"use client";

import type * as React from "react";
import { Button, type ButtonProps } from "@tangle-network/ui/primitives";
import { cn } from "@tangle-network/ui/utils";

function TangleMark({ className }: { className?: string }) {
  // Stylised "T" mark — `currentColor` so it adapts to any button variant.
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 5h16v3.2h-6.4V19h-3.2V8.2H4V5z" />
    </svg>
  );
}

export interface TangleLoginButtonProps extends Omit<ButtonProps, "onClick"> {
  /**
   * Consumer-app endpoint that starts the cross-site SSO flow. The
   * consumer's server is expected to redirect this request to the
   * platform's `/cross-site/authorize` URL (built via
   * `PlatformAuthClient.authorizeUrl` from
   * `@tangle-network/agent-runtime/platform`). Defaults to
   * `/auth/tangle`.
   */
  authUrl?: string;
  /** Product variant for styling. */
  variant?: "sandbox" | "default" | "outline";
}

/**
 * "Login with Tangle" button — kicks off the cross-site SSO bridge.
 * Server-side, the consumer app should:
 *   1. Generate a `state` for CSRF.
 *   2. Persist `state` in a session cookie or signed JWT.
 *   3. 302-redirect to `PlatformAuthClient.authorizeUrl({ state, redirectUri })`.
 *
 * This component itself only triggers the redirect to `authUrl`; the
 * server owns the platform URL construction.
 */
export function TangleLoginButton({
  authUrl = "/auth/tangle",
  variant = "default",
  className,
  children,
  ...props
}: TangleLoginButtonProps) {
  return (
    <Button
      variant={variant}
      className={cn("gap-2", className)}
      onClick={() => {
        window.location.href = authUrl;
      }}
      {...props}
    >
      <TangleMark className="h-5 w-5" />
      {children ?? "Sign in with Tangle"}
    </Button>
  );
}
