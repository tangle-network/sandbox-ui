"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu"
import { Logo } from "../primitives/logo"
import { Skeleton } from "../primitives/skeleton"
import { ThemeToggle } from "../primitives/theme-toggle"

export type ProductVariant = "sandbox"

export interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  /** Material icon name for Stitch sidebar (optional, falls back to icon component) */
  materialIcon?: string
}

export interface DashboardUser {
  email: string
  name?: string
  tier?: string
  avatarUrl?: string
}

export interface TopNavLink {
  label: string
  href: string
}

export interface DashboardLayoutProps {
  children: React.ReactNode
  variant?: ProductVariant
  navItems: NavItem[]
  activeNavId?: string
  user?: DashboardUser | null
  isLoading?: boolean
  onLogout?: () => void
  onSettingsClick?: () => void
  settingsHref?: string
  onNewSandbox?: () => void
  className?: string
  sidebarClassName?: string
  contentClassName?: string
  topNavLinks?: TopNavLink[]
  activeTopNavHref?: string
  sandboxName?: string
  sandboxLabel?: string
  /** Custom link component (e.g., Next.js Link). Use any type to support various router implementations. */
  // biome-ignore lint/suspicious/noExplicitAny: Support various router Link components
  LinkComponent?: React.ComponentType<any>
  /** Footer content rendered at bottom of viewport */
  footer?: React.ReactNode
}

const variantStyles = {
  sandbox: {
    activeNav: "bg-[var(--accent-surface-soft)] text-[var(--accent-text)]",
    userGradient: "bg-[image:var(--accent-gradient-strong)]",
  },
}

function DefaultLink({
  href,
  to,
  className,
  children,
  ...rest
}: {
  href?: string
  to?: string
  className?: string
  children: React.ReactNode
  [key: string]: unknown
}) {
  return (
    <a href={href ?? to} className={className} {...rest}>
      {children}
    </a>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>User icon</title>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Settings icon</title>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Log out icon</title>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  )
}

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
    >
      {name}
    </span>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Menu icon</title>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Close icon</title>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
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
  onNewSandbox,
  className,
  sidebarClassName,
  contentClassName,
  topNavLinks,
  activeTopNavHref,
  sandboxName,
  sandboxLabel,
  LinkComponent = DefaultLink,
  footer,
}: DashboardLayoutProps) {
  const styles = variantStyles[variant]
  const Link = LinkComponent
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const handleNavClick = () => {
    setMobileMenuOpen(false)
  }

  const SidebarContent = () => (
    <>
      {/* Sandbox selector */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center">
            <MaterialIcon name="terminal" className="text-on-primary-container text-sm" />
          </div>
          <div className="min-w-0">
            {sandboxName ? (
              <>
                <div className="font-mono text-xs text-white font-bold tracking-tight truncate">
                  {sandboxName}
                </div>
                {sandboxLabel && (
                  <div className="font-mono text-[10px] text-slate-500 truncate">
                    {sandboxLabel}
                  </div>
                )}
              </>
            ) : (
              <div className="font-mono text-xs text-slate-500">No sandbox selected</div>
            )}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 space-y-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = activeNavId === item.id
          return (
            <Link
              key={item.id}
              href={item.href}
              to={item.href}
              onClick={handleNavClick}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-xs transition-colors",
                isActive
                  ? "bg-violet-500/10 text-violet-300 border-r-4 border-violet-500"
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-300",
              )}
            >
              {item.materialIcon ? (
                <MaterialIcon name={item.materialIcon} className="text-lg" />
              ) : (
                <item.icon className="h-5 w-5" aria-hidden="true" />
              )}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-4 py-4 mt-auto space-y-1 border-t border-outline-variant/10">
        <button
          type="button"
          onClick={onNewSandbox}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-md3-primary to-primary-container text-on-primary font-bold py-2.5 rounded-lg mb-4 text-xs active:scale-95 duration-200 transition-transform"
        >
          <MaterialIcon name="add" className="text-sm" />
          New Agent
        </button>
        <Link
          href="/docs"
          to="/docs"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors font-mono text-xs"
        >
          <MaterialIcon name="menu_book" className="text-sm" />
          Documentation
        </Link>
        <Link
          href="/support"
          to="/support"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors font-mono text-xs"
        >
          <MaterialIcon name="contact_support" className="text-sm" />
          Support
        </Link>
      </div>
    </>
  )

  return (
    <div className={cn("min-h-screen bg-surface text-on-surface", className)}>
      {/* Top nav bar */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/60 backdrop-blur-xl flex justify-between items-center px-8 h-16 font-sans text-sm tracking-tight">
        <div className="flex items-center gap-8">
          <Logo variant={variant} size="md" className="hidden md:block" />
          {topNavLinks && topNavLinks.length > 0 && (
            <div className="hidden md:flex gap-6">
              {topNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  to={link.href}
                  className={cn(
                    "transition-all duration-300 px-2 py-1 rounded",
                    activeTopNavHref === link.href
                      ? "text-white border-b-2 border-violet-500 pb-1"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {onNewSandbox && (
            <button
              type="button"
              onClick={onNewSandbox}
              className="hidden md:flex items-center gap-2 bg-md3-primary text-on-primary px-4 py-2 rounded-lg font-bold hover:shadow-[0_0_15px_rgba(209,188,255,0.4)] transition-all active:scale-95 text-xs"
            >
              <MaterialIcon name="add" className="text-sm" />
              New Sandbox
            </button>
          )}
          <button type="button" className="text-slate-400 hover:text-violet-400 transition-colors p-2 rounded-lg hover:bg-white/5">
            <MaterialIcon name="notifications" />
          </button>
          {onSettingsClick ? (
            <button type="button" onClick={onSettingsClick} className="text-slate-400 hover:text-violet-400 transition-colors p-2 rounded-lg hover:bg-white/5">
              <MaterialIcon name="settings" />
            </button>
          ) : (
            <Link href={settingsHref} to={settingsHref} className="text-slate-400 hover:text-violet-400 transition-colors p-2 rounded-lg hover:bg-white/5">
              <MaterialIcon name="settings" />
            </Link>
          )}
          {/* User avatar / dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/20 overflow-hidden" aria-label="User menu">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="h-4 w-4 text-on-surface-variant" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {isLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <div>
                    <p className="truncate text-sm">{user?.email ?? "Not logged in"}</p>
                    <p className="text-muted-foreground text-xs capitalize">{user?.tier ?? "Free"} Plan</p>
                  </div>
                )}
              </DropdownMenuLabel>
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
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-md p-2 hover:bg-white/5 md:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed top-16 bottom-0 left-0 z-30 flex w-64 flex-col bg-slate-900/95 backdrop-blur-xl transition-transform duration-200 lg:hidden",
          sidebarClassName,
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex h-screen w-64 fixed left-0 top-0 flex-col py-6 bg-slate-800/40 z-40 pt-20",
          sidebarClassName,
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className={cn("lg:ml-64 pt-24 px-8 pb-12 min-h-screen", contentClassName)}>
        {children}
      </main>

      {/* Footer */}
      {footer}
    </div>
  )
}
