"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { Logo } from "../primitives/logo";
import { Skeleton } from "../primitives/skeleton";
import { ThemeToggle } from "../primitives/theme-toggle";

export type ProductVariant = "sandbox";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface DashboardUser {
  email: string;
  name?: string;
  tier?: string;
  avatarUrl?: string;
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  variant?: ProductVariant;
  navItems: NavItem[];
  activeNavId?: string;
  user?: DashboardUser | null;
  isLoading?: boolean;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  settingsHref?: string;
  className?: string;
  sidebarClassName?: string;
  contentClassName?: string;
  /** Custom link component (e.g., Next.js Link). Use any type to support various router implementations. */
  // biome-ignore lint/suspicious/noExplicitAny: Support various router Link components
  LinkComponent?: React.ComponentType<any>;
}

const variantStyles = {
  sandbox: {
    activeNav: "bg-[var(--accent-surface-soft)] text-[var(--accent-text)]",
    userGradient: "bg-[image:var(--accent-gradient-strong)]",
  },
};

function DefaultLink({
  href,
  to,
  className,
  children,
  ...rest
}: {
  href?: string;
  to?: string;
  className?: string;
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  return (
    <a href={href ?? to} className={className} {...rest}>
      {children}
    </a>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>User icon</title>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Settings icon</title>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Log out icon</title>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Chevron right icon</title>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Menu icon</title>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Close icon</title>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function DashboardLayout({
  children,
  variant = "sandbox",
  navItems,
  activeNavId,
  user,
  isLoading = false,
  onLogout,
  onSettingsClick,
  settingsHref = "/dashboard/settings",
  className,
  sidebarClassName,
  contentClassName,
  LinkComponent = DefaultLink,
}: DashboardLayoutProps) {
  const styles = variantStyles[variant];
  const Link = LinkComponent;
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Close mobile menu on navigation
  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="border-border border-b p-6">
        <Logo variant={variant} size="md" />
      </div>

      <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNavId === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              to={item.href}
              onClick={handleNavClick}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
                isActive
                  ? styles.activeNav
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-border border-t p-4">
        <div className="mb-2 flex justify-end">
          <ThemeToggle />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2"
              aria-label="User menu"
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  styles.userGradient,
                )}
              >
                <UserIcon className="h-4 w-4 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 text-left">
                {isLoading ? (
                  <>
                    <Skeleton className="mb-1 h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </>
                ) : (
                  <>
                    <p className="truncate font-medium text-sm">
                      {user?.email ?? "Not logged in"}
                    </p>
                    <p className="text-muted-foreground text-xs capitalize">
                      {user?.tier ?? "Free"} Plan
                    </p>
                  </>
                )}
              </div>
              <ChevronRightIcon
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {onSettingsClick ? (
              <DropdownMenuItem onClick={onSettingsClick}>
                <SettingsIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href={settingsHref} to={settingsHref} className="flex items-center">
                  <SettingsIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Settings
                </Link>
              </DropdownMenuItem>
            )}
            {onLogout && (
              <DropdownMenuItem className="text-red-400" onClick={onLogout}>
                <LogOutIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign Out
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className={cn("flex min-h-screen bg-background", className)}>
      {/* Mobile header */}
      <header className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between border-border border-b bg-card/95 px-4 backdrop-blur-xl md:hidden">
        <Logo variant={variant} size="sm" />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-md p-2 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <XIcon className="h-6 w-6" />
          ) : (
            <MenuIcon className="h-6 w-6" />
          )}
        </button>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed top-16 bottom-0 left-0 z-30 flex w-64 flex-col border-border border-r bg-card/95 backdrop-blur-xl transition-transform duration-200 md:hidden",
          sidebarClassName,
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 hidden w-64 flex-col border-border border-r bg-card/50 backdrop-blur-xl md:flex",
          sidebarClassName,
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 pt-16 md:ml-64 md:pt-0", contentClassName)}>
        <div className="p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
