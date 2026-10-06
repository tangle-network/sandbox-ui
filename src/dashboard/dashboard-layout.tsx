"use client"

import * as React from "react"
import { Plus, Bell, Users, ExternalLink } from "lucide-react"
import { focusRing } from "@tangle-network/ui/utils"
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@tangle-network/ui/primitives"
import { cn } from "../lib/utils"
import { MOTION_CONTROL } from "../lib/motion"
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
  /** @see {@link RailButtonProps.badgeLabel} */
  badgeLabel?: (count: number) => string
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
  /** Pass null when the host has no settings destination. */
  settingsHref?: string | null
  onNewSandbox?: () => void
  className?: string
  sidebarClassName?: string
  contentClassName?: string
  topNavLinks?: TopNavLink[]
  activeTopNavHref?: string
  /** Workspace controls below the sidebar brand. The mobile drawer is never collapsed. */
  sidebarLeading?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode)
  /** @deprecated Use sidebarLeading. Relocated into the sidebar; collapsed rails open a Workspace menu. */
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
  /** Keep notification access available even when data is still loading. Defaults to true. */
  notificationsEnabled?: boolean
  /** @deprecated The desktop top bar is always removed; controls live in the sidebar. */
  collapseEmptyTopBar?: boolean
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

/** Notifications use the shared menu's collision handling, keyboard movement and focus return. */
function SidebarNotifications({ data, showLabels, mobile }: {
  data: DashboardLayoutProps["notifications"]
  showLabels: boolean
  mobile: boolean
}) {
  const unread = data?.unreadCount ?? 0
  const NotificationIcon = ({ className }: { className?: string }) => <span className="relative">
    <Bell className={className} aria-hidden="true" />
    {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-surface-container-low" aria-hidden="true" />}
  </span>
  const content = (item: NonNullable<DashboardLayoutProps["notifications"]>["items"][number]) => <>
    <p className={cn("text-sm", item.read ? "text-muted-foreground" : "font-semibold text-foreground")}>{item.title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
    <time className="mt-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>{formatNotifDate(item.createdAt)}</time>
  </>
  return <DropdownMenu modal={false}>
    <RailButton icon={NotificationIcon} label="Notifications" showLabel={showLabels} asChild>
      <DropdownMenuTrigger aria-label="Notifications" aria-description={unread > 0 ? `${unread} unread` : undefined} />
    </RailButton>
    <DropdownMenuContent aria-label="Notifications" side={mobile ? "top" : "right"} align={mobile ? "start" : "end"} sideOffset={12} collisionPadding={12}
      className="w-80 max-w-[calc(100vw-24px)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto p-1.5">
      <DropdownMenuLabel className="px-2.5 py-2 text-sm">Notifications</DropdownMenuLabel>
      {unread > 0 && data?.onMarkAllRead && <DropdownMenuItem onSelect={(event) => { event.preventDefault(); data.onMarkAllRead?.() }}>Mark all read</DropdownMenuItem>}
      <DropdownMenuSeparator />
      {!data?.items.length ? <p className="px-2.5 py-5 text-sm text-muted-foreground">No notifications yet</p> : data.items.map((item) =>
        !item.read && data.onMarkRead ? <DropdownMenuItem key={item.id} className="block whitespace-normal px-2.5 py-3" onSelect={(event) => { event.preventDefault(); data.onMarkRead?.(item.id) }}>{content(item)}</DropdownMenuItem>
          : <div key={item.id} className="px-2.5 py-3">{content(item)}</div>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
}

function SidebarLeading({ content, legacy, collapsed }: {
  content: DashboardLayoutProps["sidebarLeading"]
  legacy: React.ReactNode
  collapsed: boolean
}) {
  if (typeof content === "function") return content({ collapsed })
  const node = content ?? legacy
  if (!node) return null
  if (!collapsed) return node
  return <DropdownMenu modal={false}>
    <RailButton icon={Users} label="Workspace" asChild><DropdownMenuTrigger /></RailButton>
    <DropdownMenuContent aria-label="Workspace" side="right" align="start" sideOffset={12} collisionPadding={12} className="w-64 max-w-[calc(100vw-24px)] p-3">{node}</DropdownMenuContent>
  </DropdownMenu>
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
  sidebarLeading,
  LinkComponent = DefaultLink,
  logoHref = "/",
  labeledRail = false,
  footer,
  railFooter,
  profileMenuItems,
  appearance,
  notifications: notifData,
  notificationsEnabled = true,
}: DashboardLayoutProps) {
  // Keep light/dark tokens switching correctly under brand 0.6 regardless of which
  // control toggled the theme (see useBrandThemeSync).
  useBrandThemeSync()
  const Link = LinkComponent
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const desktop = window.matchMedia("(min-width: 1024px)")
    const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false) }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])
  const { mode, hasPanels, panelOpen, toggleRail, railCollapsed } = useSidebar()
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
    (showLabels: boolean, allowCollapse: boolean, mobile = false) => (
      <>
        <SidebarRail wide={showLabels}>
          <RailHeader
            brand={<Logo variant={variant} size="sm" iconOnly={!showLabels} />}
            brandHref={logoHref}
            collapsed={!showLabels}
            onToggle={toggleRail}
            collapsible={allowCollapse}
            LinkComponent={Link}
          />

          {(sidebarLeading != null || topBarLeading != null || onNewSandbox) && <div className={cn("flex shrink-0 flex-col gap-2 pt-3", showLabels ? "px-2" : "items-center px-1")}>
            {(sidebarLeading != null || topBarLeading != null) && <SidebarLeading content={sidebarLeading} legacy={topBarLeading} collapsed={!showLabels} />}
            {onNewSandbox && <RailButton icon={Plus} label="New Sandbox" variant="primary" showLabel={showLabels} className="min-h-11" onClick={() => { if (mobile) setMobileMenuOpen(false); onNewSandbox() }} />}
          </div>}

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
              // Same staggered entrance the SidebarLayout rail uses — one nav
              // grammar across both shells, indexed by position in the list.
              const arrival = { className: "agent-arrive", style: { "--stagger-index": i } as React.CSSProperties }

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
                      badgeLabel={item.badgeLabel}
                      showLabel={showLabels}
                      {...arrival}
                    />
                  ) : (
                    <RailButton
                      icon={item.icon}
                      label={item.label}
                      isActive={activeNavId === item.id}
                      showLabel={showLabels}
                      asChild
                      {...arrival}
                    >
                      <Link href={item.href} to={item.href} />
                    </RailButton>
                  )}
                </React.Fragment>
              )
            })}
            {topNavLinks?.map((link) => <RailButton key={link.href} icon={ExternalLink} label={link.label} isActive={activeTopNavHref === link.href} showLabel={showLabels} asChild>
              <Link href={link.href} to={link.href} />
            </RailButton>)}
          </SidebarRailNav>

          <SidebarRailFooter className={cn("border-t border-[var(--md3-outline-variant)] pt-2", showLabels && "items-stretch px-2")}>
            {notificationsEnabled && <SidebarNotifications data={notifData} showLabels={showLabels} mobile={mobile} />}
            {railFooter !== undefined ? (
              showLabels ? (
                <div className="flex w-full items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <ProfileAvatar
                      user={sidebarUser}
                      isLoading={isLoading}
                      onLogout={onLogout ? () => { if (mobile) setMobileMenuOpen(false); onLogout() } : undefined}
                      onSettingsClick={onSettingsClick ? () => { if (mobile) setMobileMenuOpen(false); onSettingsClick() } : undefined}
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
                    onLogout={onLogout ? () => { if (mobile) setMobileMenuOpen(false); onLogout() } : undefined}
                    onSettingsClick={onSettingsClick ? () => { if (mobile) setMobileMenuOpen(false); onSettingsClick() } : undefined}
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
                onLogout={onLogout ? () => { if (mobile) setMobileMenuOpen(false); onLogout() } : undefined}
                onSettingsClick={onSettingsClick ? () => { if (mobile) setMobileMenuOpen(false); onSettingsClick() } : undefined}
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
      onNewSandbox,
      sidebarLeading,
      topBarLeading,
      topNavLinks,
      activeTopNavHref,
      notificationsEnabled,
      notifData,
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
  const mobileSidebarContent = React.useMemo(() => buildSidebarContent(true, false, true), [buildSidebarContent])

  return (
    <div className={cn("min-h-screen bg-surface text-foreground", className)}>
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <nav aria-label="Mobile navigation" className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-[var(--md3-outline-variant)] bg-surface-container-low px-4 lg:hidden">
          <Link href={logoHref} to={logoHref} aria-label="Home" className={cn("rounded-md p-1", focusRing)}><Logo variant={variant} size="sm" iconOnly /></Link>
          <DialogTrigger asChild><button type="button" aria-label="Open menu" className={cn("flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-container-high", focusRing)}><MenuIcon className="h-5 w-5" /></button></DialogTrigger>
        </nav>
        <DialogContent aria-describedby={undefined} hideCloseButton
          className="inset-y-0 left-0 flex h-dvh max-w-[calc(100vw-24px)] translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 bg-surface-container-low p-0 lg:hidden"
          style={{ width: panelOpen && hasPanels ? SIDEBAR_MOBILE_WIDTH + SIDEBAR_PANEL_WIDTH : SIDEBAR_MOBILE_WIDTH }}
          onClick={(event) => { if ((event.target as HTMLElement).closest("a[href]")) setMobileMenuOpen(false) }}>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogClose aria-label="Close menu" className={cn("absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-container-high", focusRing)}><XIcon className="h-5 w-5" /></DialogClose>
          {mobileSidebarContent}
        </DialogContent>
      </Dialog>

      {/* Desktop sidebar */}
      <Sidebar className={cn("hidden lg:flex", sidebarClassName)}>
        {sidebarContent}
      </Sidebar>

      {/* Single responsive main landmark — SidebarContent only applies the
          desktop sidebar margin at lg+, so this one <main> works for both
          viewports and keeps screen-reader landmarks unambiguous. */}
      <SidebarContent
        className={cn(
          "pt-12 px-6 pb-8 lg:px-8 lg:pt-0 bg-surface",
          contentClassName,
        )}
      >
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
