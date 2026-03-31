"use client";

import type * as React from "react";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";
import { Button, type ButtonProps } from "../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";

// GitHub icon SVG
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export interface SessionUser {
  customer_id: string;
  email: string;
  name?: string;
  tier?: string;
  github?: {
    login: string;
    connected: boolean;
  } | null;
  session_expires_at: string;
}

export interface GitHubLoginButtonProps extends Omit<ButtonProps, "onClick"> {
  /** API base URL (defaults to /auth/github) */
  authUrl?: string;
  /** Product variant for styling */
  variant?: "sandbox" | "default" | "outline";
}

export function GitHubLoginButton({
  authUrl = "/auth/github",
  variant = "default",
  className,
  children,
  ...props
}: GitHubLoginButtonProps) {
  return (
    <Button
      variant={variant}
      className={cn("gap-2", className)}
      onClick={() => {
        window.location.href = authUrl;
      }}
      {...props}
    >
      <GitHubIcon className="h-5 w-5" />
      {children ?? "Sign in with GitHub"}
    </Button>
  );
}

export interface UserMenuProps {
  user: SessionUser;
  /** API base URL for logout */
  logoutUrl?: string;
  /** Links to show in menu */
  links?: Array<{
    href: string;
    label: string;
    icon?: React.ReactNode;
  }>;
  /** Product variant for styling */
  variant?: "sandbox";
  /** Callback when logout is clicked */
  onLogout?: () => void;
}

export function UserMenu({
  user,
  logoutUrl = "/auth/logout",
  links = [],
  variant = "sandbox",
  onLogout,
}: UserMenuProps) {
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  const avatarGradient = {
    sandbox: "bg-[image:var(--accent-gradient-strong)]",
  }[variant];

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    window.location.href = logoutUrl;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={undefined} alt={user.name ?? user.email} />
            <AvatarFallback
              className={cn(
                "text-white text-xs",
                avatarGradient,
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="font-medium text-sm">{user.name ?? user.email}</p>
            {user.tier && (
              <p className="text-muted-foreground text-xs capitalize">
                {user.tier} Plan
              </p>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="font-medium text-sm">{user.name ?? "Account"}</p>
            <p className="text-muted-foreground text-xs">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <a href={link.href} className="flex items-center gap-2">
              {link.icon}
              {link.label}
            </a>
          </DropdownMenuItem>
        ))}
        {links.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-[var(--surface-danger-text)] focus:text-[var(--surface-danger-text)]"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface AuthHeaderProps {
  /** Current session user (null if not logged in) */
  user: SessionUser | null;
  /** Whether session is loading */
  loading?: boolean;
  /** Product variant */
  variant?: "sandbox";
  /** API base URL */
  apiBaseUrl?: string;
  /** Links for user menu */
  menuLinks?: UserMenuProps["links"];
  /** Custom className */
  className?: string;
}

export function AuthHeader({
  user,
  loading = false,
  variant = "sandbox",
  apiBaseUrl = "",
  menuLinks,
  className,
}: AuthHeaderProps) {
  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        <div className="hidden md:block">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <GitHubLoginButton
          authUrl={`${apiBaseUrl}/auth/github`}
          variant={variant}
          size="sm"
        />
      </div>
    );
  }

  return (
    <UserMenu
      user={user}
      variant={variant}
      logoutUrl={`${apiBaseUrl}/auth/logout`}
      links={menuLinks}
    />
  );
}
