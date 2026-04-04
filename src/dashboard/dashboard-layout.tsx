"use client"

import * as React from "react"
import { Plus, Bell } from "lucide-react"
import { cn } from "../lib/utils"
import { Logo } from "../primitives/logo"
import {
  Sidebar,
  SidebarRail,
  SidebarRailHeader,
  SidebarRailNav,
  SidebarRailFooter,
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
  SidebarContent,
  RailButton,
  RailModeButton,
  RailSeparator,
  ProfileAvatar,
} from "./app-sidebar"
import type { SidebarUser } from "./app-sidebar"
import { SidebarProvider, useSidebar, SIDEBAR_TOTAL_WIDTH, SIDEBAR_RAIL_WIDTH } from "./sidebar-context"

// ============================================================================
// Types
// ============================================================================

export type ProductVariant = "sandbox"

export interface NavItem {
  id: string
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
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

export interface PanelConfig {
  mode: string
  title: string
  content: React.ReactNode
}

export interface DashboardLayoutProps {
  children: React.ReactNode
  variant?: ProductVariant
  /** Navigation items for the rail */
  navItems: NavItem[]
  /** Nav item IDs that act as panel mode switchers (others are direct links) */
  modeItems?: string[]
  /** Panel content per mode */
  panels?: PanelConfig[]
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
  // biome-ignore lint/suspicious/noExplicitAny: Support various router Link components
  LinkComponent?: React.ComponentType<any>
  footer?: React.ReactNode
  defaultPanelOpen?: boolean
  defaultMode?: string
  /** Extra content in the rail footer (above profile avatar) */
  railFooter?: React.ReactNode
  /** Extra dropdown items in the profile menu */
  profileMenuItems?: React.ReactNode
}

// ============================================================================
// Icons
// ============================================================================


function SettingsIconSmall({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Settings</title>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
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

// ============================================================================
// Inner layout (consumes sidebar context)
// ============================================================================

function DashboardLayoutInner({
  children,
  variant = "sandbox",
  navItems,
  modeItems = [],
  panels = [],
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
  LinkComponent = DefaultLink,
  footer,
  railFooter,
  profileMenuItems,
}: DashboardLayoutProps) {
  const Link = LinkComponent
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const { contentMargin, hidden, mode, hasPanels, panelOpen } = useSidebar()
  const modeSet = React.useMemo(() => new Set(modeItems), [modeItems])

  const sidebarUser: SidebarUser | undefined = user
    ? { email: user.email, name: user.name, tier: user.tier, avatarUrl: user.avatarUrl }
    : undefined

  const activePanel = panels.find((p) => p.mode === mode)

  // The composable sidebar — consumers can replace this entirely
  const sidebarContent = (
    <>
      <SidebarRail>
        <SidebarRailHeader>
          <Link href="/" to="/" className="p-1 rounded-md transition-colors hover:bg-muted/50">
            <Logo variant={variant} size="sm" iconOnly />
          </Link>
        </SidebarRailHeader>

        <SidebarRailNav>
          {navItems.map((item, i) => {
            const isMode = modeSet.has(item.id)
            const prevIsMode = i > 0 && modeSet.has(navItems[i - 1].id)
            const showSep = i > 0 && isMode && !prevIsMode

            return (
              <React.Fragment key={item.id}>
                {showSep && <RailSeparator />}
                {isMode ? (
                  <RailModeButton
                    mode={item.id}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                  />
                ) : (
                  <Link href={item.href} to={item.href}>
                    <RailButton
                      icon={item.icon}
                      label={item.label}
                      isActive={activeNavId === item.id}
                    />
                  </Link>
                )}
              </React.Fragment>
            )
          })}
        </SidebarRailNav>

        <SidebarRailFooter>
          {onSettingsClick ? (
            <RailButton icon={SettingsIconSmall} label="Settings" onClick={onSettingsClick} />
          ) : (
            <Link href={settingsHref} to={settingsHref}>
              <RailButton icon={SettingsIconSmall} label="Settings" />
            </Link>
          )}
          {railFooter}
          <RailSeparator />
          <ProfileAvatar
            user={sidebarUser}
            isLoading={isLoading}
            onLogout={onLogout}
            onSettingsClick={onSettingsClick}
            settingsHref={settingsHref}
            LinkComponent={LinkComponent}
          >
            {profileMenuItems}
          </ProfileAvatar>
        </SidebarRailFooter>
      </SidebarRail>

      {panels.length > 0 && (
        <SidebarPanel>
          <SidebarPanelHeader title={activePanel?.title ?? mode} />
          <SidebarPanelContent>
            {activePanel?.content}
          </SidebarPanelContent>
        </SidebarPanel>
      )}
    </>
  )

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      {/* Top nav bar */}
      <nav
        className="fixed top-0 z-50 bg-card border-b border-border flex justify-between items-center px-8 h-14 font-sans text-[13px] tracking-tight transition-[left,width] duration-200 ease-in-out"
        style={{
          left: hidden ? 0 : contentMargin,
          width: hidden ? "100%" : `calc(100% - ${contentMargin}px)`,
        }}
      >
        <div className="flex items-center gap-8">
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
                      ? "text-foreground border-b-2 border-primary pb-1"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
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
              className="hidden md:flex items-center gap-2 bg-[var(--accent-surface-soft)] border border-border text-[var(--accent-text)] px-4 py-2 rounded-lg font-bold hover:bg-[var(--accent-surface-strong)] transition-all active:scale-95 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Sandbox
            </button>
          )}
          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50">
            <Bell className="h-4 w-4" />
          </button>
        </div>
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-md p-2 hover:bg-muted/50 lg:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed top-14 bottom-0 left-0 z-30 flex bg-background transition-transform duration-200 lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ width: (panelOpen && hasPanels) ? SIDEBAR_TOTAL_WIDTH : SIDEBAR_RAIL_WIDTH }}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <Sidebar className={cn("hidden lg:flex", sidebarClassName)}>
        {sidebarContent}
      </Sidebar>

      {/* Main content */}
      <SidebarContent className={cn("pt-16 px-8 pb-8 hidden lg:block bg-background", contentClassName)}>
        {children}
      </SidebarContent>

      {/* Mobile main content (no sidebar offset) */}
      <main className={cn("pt-16 px-6 pb-8 min-h-screen lg:hidden bg-background", contentClassName)}>
        {children}
      </main>

      {footer}
    </div>
  )
}

// ============================================================================
// Public export — wraps in SidebarProvider
// ============================================================================

export function DashboardLayout({ defaultPanelOpen, defaultMode, ...props }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultPanelOpen={defaultPanelOpen} defaultMode={defaultMode} hasPanels={(props.panels?.length ?? 0) > 0}>
      <DashboardLayoutInner defaultPanelOpen={defaultPanelOpen} defaultMode={defaultMode} {...props} />
    </SidebarProvider>
  )
}
