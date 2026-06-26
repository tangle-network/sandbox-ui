"use client"

import * as React from "react"
import { Plus, Bell } from "lucide-react"
import { cn } from "../lib/utils"
import { useBrandThemeSync } from "./use-brand-theme-sync"
import { Logo } from "../primitives"
import {
  Sidebar,
  SidebarRail,
  SidebarRailNav,
  SidebarRailFooter,
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
  SidebarContent,
  RailButton,
  RailModeButton,
  RailSeparator,
  RailHeader,
  ProfileAvatar,
} from "./app-sidebar"
import type { SidebarUser, AppearanceController } from "./app-sidebar"
import { SidebarProvider, useSidebar, SIDEBAR_MOBILE_WIDTH, SIDEBAR_PANEL_WIDTH } from "./sidebar-context"

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
  /** Arbitrary content rendered at the leading (left) edge of the top bar —
   * e.g. a workspace/team switcher — so consumers don't need a second bar. */
  topBarLeading?: React.ReactNode
  // biome-ignore lint/suspicious/noExplicitAny: Support various router Link components
  LinkComponent?: React.ComponentType<any>
  /**
   * Where the in-app logo links. Defaults to "/" (backward compatible);
   * pass an in-app path (e.g. "/dashboard") so the logo never bounces an
   * authenticated user back out to the public marketing homepage.
   */
  logoHref?: string
  /**
   * @deprecated No longer wired. The redesigned {@link RailHeader} renders the
   * brand mark plus a dedicated panel-toggle button; the logo is no longer the
   * collapse control. Kept for back-compat; has no effect.
   */
  onLogoClick?: () => void
  /**
   * @deprecated No longer wired (see {@link onLogoClick}). Has no effect.
   */
  logoAriaLabel?: string
  /**
   * Let the icon rail expand to a labeled rail. When true, the rail logo
   * toggles between icon-only and labeled instead of navigating.
   */
  labeledRail?: boolean
  /**
   * Initial rail-collapsed state when `labeledRail` is set and the rail is
   * uncontrolled. Defaults to expanded (`false`). Pass `true` to start on the
   * compact icon rail — the user's choice then persists to localStorage.
   */
  defaultRailCollapsed?: boolean
  footer?: React.ReactNode
  defaultPanelOpen?: boolean
  defaultMode?: string
  /** Extra content in the rail footer (above profile avatar) */
  railFooter?: React.ReactNode
  /** Extra dropdown items in the profile menu */
  profileMenuItems?: React.ReactNode
  /**
   * When provided, the profile menu shows an Appearance section
   * (Light/Dark/System) driven by this host-supplied controller. Replaces the
   * old standalone rail theme toggle.
   */
  appearance?: AppearanceController
  /** Notification data for the bell dropdown */
  notifications?: {
    items: { id: string; title: string; message: string; read: boolean; createdAt: string }[]
    unreadCount: number
    onMarkRead?: (id: string) => void
    onMarkAllRead?: () => void
  }
}

// ============================================================================
// Icons
// ============================================================================


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

function formatNotifDate(raw: string): string {
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
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
  topBarLeading,
  LinkComponent = DefaultLink,
  logoHref = "/",
  labeledRail = false,
  footer,
  railFooter,
  profileMenuItems,
  appearance,
  notifications: notifData,
}: DashboardLayoutProps) {
  // Keep light/dark tokens switching correctly under brand 0.6 regardless of which
  // control toggled the theme (see useBrandThemeSync).
  useBrandThemeSync()
  const Link = LinkComponent
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const notifRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!notificationsOpen) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotificationsOpen(false)
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", keyHandler)
    }
  }, [notificationsOpen])
  const { contentMargin, hidden, mode, hasPanels, panelOpen, toggleRail, railCollapsed } =
    useSidebar()
  const modeSet = React.useMemo(() => new Set(modeItems), [modeItems])

  // Memoised so the `buildSidebarContent` callback below (which depends on
  // this value) doesn't recreate on every render — that was silently
  // defeating both `sidebarContent` / `mobileSidebarContent` useMemos.
  const sidebarUser = React.useMemo<SidebarUser | undefined>(
    () =>
      user
        ? { email: user.email, name: user.name, tier: user.tier, avatarUrl: user.avatarUrl }
        : undefined,
    [user?.email, user?.name, user?.tier, user?.avatarUrl],
  )

  const activePanel = panels.find((p) => p.mode === mode)

  // Build the sidebar tree once per relevant dependency change. We keep
  // desktop (icon-only rail) and mobile (labeled drawer) as two memoised
  // trees so a state change that only affects one (e.g. toggling
  // `mobileMenuOpen`) doesn't force the other to reconcile.
  const buildSidebarContent = React.useCallback(
    (showLabels: boolean, allowCollapse: boolean) => (
      <>
        <SidebarRail wide={showLabels}>
          <RailHeader
            brand={<Logo variant={variant} size="sm" iconOnly />}
            brandHref={logoHref}
            collapsed={!showLabels}
            onToggle={toggleRail}
            collapsible={allowCollapse}
            LinkComponent={Link}
          />

          <SidebarRailNav
            className={cn(showLabels ? "px-2" : undefined, !showLabels && allowCollapse && "cursor-pointer")}
            onClick={
              !showLabels && allowCollapse
                ? (e) => { if (e.target === e.currentTarget) toggleRail() }
                : undefined
            }
          >
            {navItems.map((item, i) => {
              const isMode = modeSet.has(item.id)
              const prevIsMode = i > 0 && modeSet.has(navItems[i - 1].id)
              const showSep = i > 0 && isMode && !prevIsMode

              return (
                <React.Fragment key={item.id}>
                  {showSep && (
                    <RailSeparator
                      className={showLabels ? "w-full" : undefined}
                    />
                  )}
                  {isMode ? (
                    <RailModeButton
                      mode={item.id}
                      icon={item.icon}
                      label={item.label}
                      badge={item.badge}
                      showLabel={showLabels}
                    />
                  ) : (
                    <RailButton
                      icon={item.icon}
                      label={item.label}
                      isActive={activeNavId === item.id}
                      showLabel={showLabels}
                      asChild
                    >
                      <Link href={item.href} to={item.href} />
                    </RailButton>
                  )}
                </React.Fragment>
              )
            })}
          </SidebarRailNav>

          <SidebarRailFooter className={cn("border-t border-[var(--md3-outline-variant)] pt-2", showLabels && "items-stretch px-2")}>
            {/* No nav items live in the footer anymore — Settings moved into the
                account menu, collapse moved into the header. The footer is just
                the account avatar (plus any host-provided railFooter content). */}
            {railFooter !== undefined ? (
              showLabels ? (
                <div className="flex w-full items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <ProfileAvatar
                      user={sidebarUser}
                      isLoading={isLoading}
                      onLogout={onLogout}
                      onSettingsClick={onSettingsClick}
                      settingsHref={settingsHref}
                      showDetails={showLabels}
                      appearance={appearance}
                      LinkComponent={LinkComponent}
                    >
                      {profileMenuItems}
                    </ProfileAvatar>
                  </div>
                  <div className="shrink-0">{railFooter}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  {railFooter}
                  <ProfileAvatar
                    user={sidebarUser}
                    isLoading={isLoading}
                    onLogout={onLogout}
                    onSettingsClick={onSettingsClick}
                    settingsHref={settingsHref}
                    showDetails={showLabels}
                    appearance={appearance}
                    LinkComponent={LinkComponent}
                  >
                    {profileMenuItems}
                  </ProfileAvatar>
                </div>
              )
            ) : (
              <ProfileAvatar
                user={sidebarUser}
                isLoading={isLoading}
                onLogout={onLogout}
                onSettingsClick={onSettingsClick}
                settingsHref={settingsHref}
                showDetails={showLabels}
                appearance={appearance}
                LinkComponent={LinkComponent}
              >
                {profileMenuItems}
              </ProfileAvatar>
            )}
          </SidebarRailFooter>
        </SidebarRail>

        {panels.length > 0 && (
          <SidebarPanel>
            <SidebarPanelHeader title={activePanel?.title ?? mode} />
            <SidebarPanelContent>{activePanel?.content}</SidebarPanelContent>
          </SidebarPanel>
        )}
      </>
    ),
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only the inputs that actually affect the sidebar tree
    [
      Link,
      variant,
      logoHref,
      labeledRail,
      toggleRail,
      railCollapsed,
      navItems,
      modeSet,
      activeNavId,
      onSettingsClick,
      settingsHref,
      railFooter,
      sidebarUser,
      isLoading,
      onLogout,
      LinkComponent,
      profileMenuItems,
      appearance,
      panels,
      activePanel,
      mode,
    ],
  )

  // The collapse toggle only belongs on the desktop rail (where collapsing
  // changes the layout). The mobile drawer is always labeled and doesn't
  // collapse, so it never renders the toggle.
  const sidebarContent = React.useMemo(
    () => buildSidebarContent(labeledRail && !railCollapsed, labeledRail),
    [buildSidebarContent, labeledRail, railCollapsed],
  )
  const mobileSidebarContent = React.useMemo(() => buildSidebarContent(true, false), [buildSidebarContent])

  return (
    <div className={cn("min-h-screen bg-surface text-foreground", className)}>
      {/* Top nav bar */}
      <nav
        className="fixed top-0 z-50 bg-surface-container-low border-b border-[var(--md3-outline-variant)] flex justify-between items-center px-8 h-14 font-sans text-[13px] tracking-tight transition-[left,width] duration-200 ease-in-out"
        style={{
          left: hidden ? 0 : contentMargin,
          width: hidden ? "100%" : `calc(100% - ${contentMargin}px)`,
        }}
      >
        <div className="flex items-center gap-8">
          {/* Mobile-only brand — the desktop sidebar rail carries the logo
              on lg+, but on mobile the rail is hidden behind the drawer and
              the top bar otherwise contained only a bell + hamburger. */}
          <Link href={logoHref} to={logoHref} className="lg:hidden flex items-center p-1 rounded-md hover:bg-surface-container-high transition-colors">
            <Logo variant={variant} size="sm" iconOnly />
          </Link>
          {topBarLeading}
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
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-container-high",
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
              className="hidden md:flex items-center gap-2 bg-[var(--btn-primary-bg)] border border-[var(--border-accent)] text-[var(--btn-primary-text)] px-4 py-2 rounded-lg font-bold hover:bg-[var(--btn-primary-hover)] transition-all active:scale-95 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Sandbox
            </button>
          )}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="relative text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-surface-container-high"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-4 w-4" />
              {(notifData?.unreadCount ?? 0) > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container-highest shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14] z-50">
                <div className="flex items-center justify-between border-b border-[var(--md3-outline-variant)] px-4 py-3">
                  <p className="font-bold text-foreground text-sm">Notifications</p>
                  {(notifData?.unreadCount ?? 0) > 0 && notifData?.onMarkAllRead && (
                    <button
                      type="button"
                      onClick={() => { notifData.onMarkAllRead?.(); }}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {(!notifData?.items || notifData.items.length === 0) ? (
                  <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-muted-foreground text-sm">No notifications yet</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">We'll notify you about important updates</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifData.items.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={cn(
                          "w-full text-left px-4 py-3 border-b border-[var(--md3-outline-variant)] last:border-0 transition-colors",
                          n.read ? "cursor-default" : "bg-primary/5 hover:bg-white/5"
                        )}
                        onClick={() => { if (!n.read) notifData.onMarkRead?.(n.id); }}
                      >
                        <p className={cn("text-sm", !n.read ? "font-semibold text-foreground" : "text-muted-foreground")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">
                          {formatNotifDate(n.createdAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-md p-2 hover:bg-surface-container-high lg:hidden"
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

      {/* Mobile sidebar drawer. The mobile rail renders labels beside
          icons (see `SidebarRail` `wide` prop) so the drawer must be wider
          than the 64px icon rail to avoid truncating them. When a panel
          is open we extend by the panel width so both sit side-by-side. */}
      <aside
        className={cn(
          "fixed top-14 bottom-0 left-0 z-30 flex bg-surface-container-low transition-transform duration-200 lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          width:
            panelOpen && hasPanels
              ? SIDEBAR_MOBILE_WIDTH + SIDEBAR_PANEL_WIDTH
              : SIDEBAR_MOBILE_WIDTH,
        }}
      >
        {mobileSidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <Sidebar className={cn("hidden lg:flex", sidebarClassName)}>
        {sidebarContent}
      </Sidebar>

      {/* Single responsive main landmark — SidebarContent only applies the
          desktop sidebar margin at lg+, so this one <main> works for both
          viewports and keeps screen-reader landmarks unambiguous. */}
      <SidebarContent className={cn("pt-16 px-6 pb-8 lg:px-8 bg-surface", contentClassName)}>
        {children}
      </SidebarContent>

      {footer}
    </div>
  )
}

// ============================================================================
// Public export — wraps in SidebarProvider
// ============================================================================

export function DashboardLayout({ defaultPanelOpen, defaultMode, labeledRail, defaultRailCollapsed, ...props }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultPanelOpen={defaultPanelOpen} defaultMode={defaultMode} labeledRail={labeledRail} defaultRailCollapsed={defaultRailCollapsed} hasPanels={(props.panels?.length ?? 0) > 0}>
      <DashboardLayoutInner defaultPanelOpen={defaultPanelOpen} defaultMode={defaultMode} labeledRail={labeledRail} {...props} />
    </SidebarProvider>
  )
}
