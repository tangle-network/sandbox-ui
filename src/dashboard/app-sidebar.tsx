"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@tangle-network/ui/primitives"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tangle-network/ui/primitives"
import { Logo } from "../primitives"
import { Skeleton } from "@tangle-network/ui/primitives"
import {
  SIDEBAR_PANEL_WIDTH,
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
  style?: React.CSSProperties
}

export function Sidebar({ children, className, style }: SidebarProps) {
  const { panelOpen, hidden, hasPanels, railWidth } = useSidebar()

  return (
    <div
      data-sidebar="true"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex bg-card border-r border-border transition-[transform,width] duration-200 ease-in-out",
        hidden && "-translate-x-full",
        className,
      )}
      style={{ width: (panelOpen && hasPanels) ? railWidth + SIDEBAR_PANEL_WIDTH : railWidth, ...style }}
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
  /**
   * Render the rail at the wider mobile-drawer width so labels fit
   * beside the icons. Defaults to the 64px icon-only rail used on
   * desktop.
   */
  wide?: boolean
}

export function SidebarRail({ children, className, wide = false }: SidebarRailProps) {
  const { railWidth } = useSidebar()
  return (
    <div
      className={cn(
        "flex flex-col h-full shrink-0 bg-transparent",
        wide && "w-full",
        className,
      )}
      style={wide ? undefined : { width: railWidth }}
    >
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
    <div className={cn("flex h-14 items-center justify-center border-b border-border", className)}>
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
  return <div className={cn("my-2 h-px w-10 bg-[var(--md3-outline-variant)]", className)} />
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
  /** Show label text next to icon (for mobile drawer) */
  showLabel?: boolean
  /**
   * Render the rail-button styling onto a single child element (e.g. a router
   * `<Link>`) instead of an inner `<button>`. The child receives the button
   * classes, `title`, and the icon/label/badge as its content — so navigation
   * items stay real anchors (keyboard, cmd-click, prefetch) without copying the
   * class recipe or nesting `<a><button>`.
   */
  asChild?: boolean
  children?: React.ReactNode
}

export function RailButton({ icon: Icon, label, isActive, badge, onClick, className, showLabel, asChild, children }: RailButtonProps) {
  const classes = cn(
    "group relative flex items-center justify-center rounded-xl transition-all duration-200",
    showLabel ? "w-full justify-start px-3 h-11 gap-3" : "w-11 h-11 justify-center",
    "hover:bg-[var(--accent-surface-soft)] hover:text-[var(--accent-text)]",
    "active:scale-95",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    isActive && "bg-[var(--accent-surface-strong)] text-[var(--accent-text)]",
    !isActive && "text-muted-foreground",
    className,
  )

  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      {showLabel && (
        <span className="text-sm font-medium">{label}</span>
      )}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-[var(--md3-on-primary)] px-1 shadow-sm">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  )

  if (asChild && React.isValidElement(children)) {
    // biome-ignore lint/suspicious/noExplicitAny: merge onto an unknown child element (Link/anchor)
    const child = children as React.ReactElement<any>
    return React.cloneElement(
      child,
      { className: cn(classes, child.props.className), title: child.props.title ?? label },
      content,
    )
  }

  return (
    <button type="button" onClick={onClick} title={label} className={classes}>
      {content}
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
  /** Show label text next to icon (for mobile drawer) */
  showLabel?: boolean
}

export function RailModeButton({ mode, icon, label, badge, className, showLabel }: RailModeButtonProps) {
  const { panelOpen, mode: currentMode, switchMode } = useSidebar()
  return (
    <RailButton
      icon={icon}
      label={label}
      isActive={mode === currentMode && panelOpen}
      badge={badge}
      onClick={() => switchMode(mode)}
      className={className}
      showLabel={showLabel}
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
        "transition-[opacity] duration-150 h-full overflow-hidden border-l border-border bg-card",
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
    <div className={cn("flex h-14 items-center px-4 border-b border-border shrink-0", className)}>
      {children ?? (
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
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

  // Single responsive <main> landmark. Margin-left only applies at lg+ where
  // the desktop sidebar is visible as a rail; on mobile the drawer is an
  // overlay so content starts at the viewport edge.
  return (
    <main
      className={cn(
        "min-h-screen transition-[margin-left] duration-200 ease-in-out lg:ml-[var(--sb-content-margin,0px)]",
        className,
      )}
      style={{ "--sb-content-margin": `${contentMargin}px` } as React.CSSProperties}
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
  /** Show name/email beside the avatar (for a labeled rail) instead of an icon-only avatar button. */
  showDetails?: boolean
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
  showDetails = false,
  LinkComponent,
}: ProfileAvatarProps) {
  const Link = LinkComponent ?? DefaultLink

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center rounded-lg transition-colors hover:bg-[var(--accent-surface-soft)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            showDetails ? "w-full gap-2.5 px-3 py-2 text-left" : "justify-center w-12 h-12",
            className,
          )}
          aria-label="User menu"
        >
          {isLoading ? (
            <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          ) : (
            <Avatar className="h-7 w-7 shrink-0">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="text-[10px] bg-violet-500/20 text-violet-300">
                {getInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
          )}
          {showDetails && (
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <>
                  <Skeleton className="mb-1 h-3.5 w-20" />
                  <Skeleton className="h-3 w-28" />
                </>
              ) : (
                <>
                  <p className="truncate text-sm font-medium text-foreground">
                    {user?.name ?? user?.email ?? "Not signed in"}
                  </p>
                  {user?.email && user?.name && (
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  )}
                </>
              )}
            </div>
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
