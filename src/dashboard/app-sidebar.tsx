"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
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
import {
  SIDEBAR_RAIL_WIDTH,
  SIDEBAR_PANEL_WIDTH,
  SIDEBAR_TOTAL_WIDTH,
  useSidebar,
} from "./sidebar-context"

// ============================================================================
// Types
// ============================================================================

export interface SidebarUser {
  email: string
  name?: string
  tier?: string
  avatarUrl?: string
}

// ============================================================================
// Helpers
// ============================================================================

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

function getInitials(name?: string, email?: string): string {
  if (name) return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
  if (email) return email[0].toUpperCase()
  return "?"
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

// ============================================================================
// Sidebar — root container (Rail + Panel)
// ============================================================================

export interface SidebarProps {
  children: React.ReactNode
  className?: string
}

export function Sidebar({ children, className }: SidebarProps) {
  const { panelOpen, hidden } = useSidebar()

  return (
    <div
      data-sidebar="true"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex bg-[var(--depth-1)] border-r border-[var(--border-subtle)] transition-[transform,width] duration-200 ease-in-out",
        hidden && "-translate-x-full",
        className,
      )}
      style={{ width: panelOpen ? SIDEBAR_TOTAL_WIDTH : SIDEBAR_RAIL_WIDTH }}
    >
      {children}
    </div>
  )
}

// ============================================================================
// SidebarRail — the always-visible icon strip (64px)
// ============================================================================

export interface SidebarRailProps {
  children: React.ReactNode
  className?: string
}

export function SidebarRail({ children, className }: SidebarRailProps) {
  return (
    <div className={cn("flex flex-col h-full w-16 shrink-0 bg-[var(--depth-2)]", className)}>
      {children}
    </div>
  )
}

// ============================================================================
// SidebarRailHeader — top section of the rail (logo area)
// ============================================================================

export interface SidebarRailHeaderProps {
  children: React.ReactNode
  className?: string
}

export function SidebarRailHeader({ children, className }: SidebarRailHeaderProps) {
  return (
    <div className={cn("flex h-14 items-center justify-center border-b border-[var(--border-subtle)]", className)}>
      {children}
    </div>
  )
}

// ============================================================================
// SidebarRailNav — scrollable nav section (takes remaining vertical space)
// ============================================================================

export interface SidebarRailNavProps {
  children: React.ReactNode
  className?: string
}

export function SidebarRailNav({ children, className }: SidebarRailNavProps) {
  return (
    <nav className={cn("flex flex-col items-center gap-1 py-3 flex-1", className)}>
      {children}
    </nav>
  )
}

// ============================================================================
// SidebarRailFooter — bottom section of the rail
// ============================================================================

export interface SidebarRailFooterProps {
  children: React.ReactNode
  className?: string
}

export function SidebarRailFooter({ children, className }: SidebarRailFooterProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1 pb-3", className)}>
      {children}
    </div>
  )
}

// ============================================================================
// RailSeparator — horizontal divider in the rail
// ============================================================================

export interface RailSeparatorProps {
  className?: string
}

export function RailSeparator({ className }: RailSeparatorProps) {
  return <div className={cn("my-2 h-px w-10 bg-[var(--border-subtle)]", className)} />
}

// ============================================================================
// RailButton — icon button with tooltip and optional badge
// ============================================================================

export interface RailButtonProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  isActive?: boolean
  badge?: number
  onClick?: () => void
  className?: string
}

export function RailButton({ icon: Icon, label, isActive, badge, onClick, className }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg transition-all duration-150",
        "hover:bg-[var(--accent-surface-soft)] hover:text-[var(--accent-text)]",
        "active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]",
        isActive && "bg-[var(--accent-surface-strong)] text-[var(--accent-text)] shadow-[0_0_12px_-2px_rgba(130,99,255,0.3)]",
        !isActive && "text-[var(--text-muted)]",
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className={cn(
        "text-[9px] leading-none font-medium tracking-tight truncate max-w-[44px]",
        isActive ? "text-[var(--accent-text)]" : "text-[var(--text-dim)] group-hover:text-[var(--accent-text)]"
      )}>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[8px] font-medium text-white px-0.5">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
}

// ============================================================================
// RailModeButton — RailButton wired to sidebar mode switching
// ============================================================================

export interface RailModeButtonProps {
  mode: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge?: number
  className?: string
}

export function RailModeButton({ mode, icon, label, badge, className }: RailModeButtonProps) {
  const { panelOpen, mode: currentMode, switchMode } = useSidebar()
  return (
    <RailButton
      icon={icon}
      label={label}
      badge={badge}
      isActive={panelOpen && currentMode === mode}
      onClick={() => switchMode(mode)}
      className={className}
    />
  )
}

// ============================================================================
// SidebarPanel — slide-out content area (260px)
// ============================================================================

export interface SidebarPanelProps {
  children: React.ReactNode
  className?: string
}

export function SidebarPanel({ children, className }: SidebarPanelProps) {
  const { panelOpen } = useSidebar()

  return (
    <div
      className={cn(
        "transition-[opacity] duration-150 h-full overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--depth-1)]",
        panelOpen ? "w-[260px] opacity-100" : "w-0 opacity-0 pointer-events-none",
        className,
      )}
    >
      <div className="flex flex-col h-full w-[260px]">
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// SidebarPanelHeader — panel title bar
// ============================================================================

export interface SidebarPanelHeaderProps {
  children?: React.ReactNode
  title?: string
  className?: string
}

export function SidebarPanelHeader({ children, title, className }: SidebarPanelHeaderProps) {
  return (
    <div className={cn("flex h-14 items-center px-4 border-b border-[var(--border-subtle)] shrink-0", className)}>
      {children ?? (
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      )}
    </div>
  )
}

// ============================================================================
// SidebarPanelContent — scrollable content area
// ============================================================================

export interface SidebarPanelContentProps {
  children: React.ReactNode
  className?: string
}

export function SidebarPanelContent({ children, className }: SidebarPanelContentProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-2 py-2", className)}>
      {children}
    </div>
  )
}

// ============================================================================
// SidebarContent — main content area that responds to sidebar width
// ============================================================================

export interface SidebarContentProps {
  children: React.ReactNode
  className?: string
}

export function SidebarContent({ children, className }: SidebarContentProps) {
  const { contentMargin } = useSidebar()

  return (
    <main
      className={cn("min-h-screen transition-[margin-left] duration-200 ease-in-out", className)}
      style={{ marginLeft: contentMargin }}
    >
      {children}
    </main>
  )
}

// ============================================================================
// ProfileAvatar — avatar button with dropdown (for rail footer)
// ============================================================================

export interface ProfileAvatarProps {
  user?: SidebarUser | null
  isLoading?: boolean
  onLogout?: () => void
  onSettingsClick?: () => void
  settingsHref?: string
  /** Extra dropdown items rendered before settings/logout */
  children?: React.ReactNode
  className?: string
  // biome-ignore lint/suspicious/noExplicitAny: Support various router Link components
  LinkComponent?: React.ComponentType<any>
}

export function ProfileAvatar({
  user,
  isLoading = false,
  onLogout,
  onSettingsClick,
  settingsHref = "/dashboard/settings",
  children,
  className,
  LinkComponent,
}: ProfileAvatarProps) {
  const Link = LinkComponent ?? DefaultLink

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-lg transition-colors hover:bg-[var(--accent-surface-soft)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]",
            className,
          )}
          aria-label="User menu"
        >
          {isLoading ? (
            <Skeleton className="h-7 w-7 rounded-full" />
          ) : (
            <Avatar className="h-7 w-7">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="text-[10px] bg-violet-500/20 text-violet-300">
                {getInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-72">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-2 py-3">
            <Avatar className="h-12 w-12 shrink-0">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="text-sm bg-[var(--surface-violet-bg)] text-[var(--surface-violet-text)]">
                {getInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold truncate">{user?.name ?? user?.email ?? "Not logged in"}</p>
                  {user?.email && user?.name && (
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  )}
                  {user?.tier && (
                    <p className="text-xs text-muted-foreground capitalize">{user.tier} Plan</p>
                  )}
                </>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
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
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--surface-danger-text)]" onClick={onLogout}>
              <LogOutIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign Out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
