"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import {
  Sidebar,
  SidebarRail,
  SidebarRailHeader,
  SidebarRailNav,
  SidebarRailFooter,
  SidebarPanel,
  SidebarContent,
  RailButton,
  RailFlyout,
  RailCollapseToggle,
  ProfileAvatar,
  RailThemeToggle,
} from "./app-sidebar"
import type { SidebarUser } from "./app-sidebar"
import { SidebarProvider, useSidebar } from "./sidebar-context"

// ============================================================================
// Types
// ============================================================================

/** A sub-destination revealed inside a nav item's right-flyout. */
export interface SidebarLayoutFlyoutItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  prefetch?: "none" | "intent" | "render" | "viewport"
}

export interface SidebarLayoutNavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Destination for link items. Omit when `togglesPanel` or `flyoutItems` is set. */
  href?: string
  /** Render this item as the panel toggle instead of a link. */
  togglesPanel?: boolean
  /**
   * Render this item as a right-flyout "door" fronting these sub-destinations
   * instead of a link. The flyout opens to the right of the rail item. Takes
   * precedence over `href`/`togglesPanel`.
   */
  flyoutItems?: SidebarLayoutFlyoutItem[]
  /** Ids of `flyoutItems` whose route is currently active (drives the door highlight). */
  flyoutActiveIds?: string[]
  badge?: number
  /**
   * React Router prefetch behavior for this link, forwarded to the underlying
   * `<Link prefetch>`. Omit to preserve the router's default (no prefetch).
   * Ignored for panel-toggle items and for `LinkComponent`s that don't support it.
   */
  prefetch?: "none" | "intent" | "render" | "viewport"
}

export interface SidebarLayoutProps {
  children: React.ReactNode
  /** Rail navigation, in display order. Each item is a link or the panel toggle. */
  navItems: SidebarLayoutNavItem[]
  /** Id of the active link item (drives the highlighted state). */
  activeId?: string
  /** Content rendered inside the slide-out panel (e.g. a SessionSidebar). */
  panel?: React.ReactNode
  /** Logo element rendered in the rail header. */
  logo?: React.ReactNode
  /** Destination for the logo link. */
  logoHref?: string
  /**
   * Content rendered in the rail header in place of the logo link — e.g. a
   * project/workspace switcher. Spans the header so the app's primary
   * orientation control sits at the top of the rail. When set, `logo`/`logoHref`
   * are ignored. The header keeps its `h-14` height for cross-view alignment.
   */
  railHeaderContent?: React.ReactNode
  user?: SidebarUser | null
  isLoading?: boolean
  onLogout?: () => void
  onSettingsClick?: () => void
  settingsHref?: string
  /** Extra items rendered before settings/logout in the profile menu. */
  profileMenuItems?: React.ReactNode
  /** Render a light/dark theme switch in the profile menu (uses the shared `useTheme`). */
  showThemeToggle?: boolean
  /** Extra content in the rail footer, above the profile avatar. */
  railFooter?: React.ReactNode
  // biome-ignore lint/suspicious/noExplicitAny: support various router Link components
  LinkComponent?: React.ComponentType<any>
  /**
   * Controlled panel-open state. Provide it (seeded from a server-readable
   * source such as a cookie) in SSR apps so the panel survives reload without a
   * hydration mismatch. Omit to let the panel persist to localStorage.
   */
  panelOpen?: boolean
  onPanelOpenChange?: (open: boolean) => void
  defaultPanelOpen?: boolean
  /** Hide the whole sidebar below this breakpoint (content spans full width). */
  hideBelow?: "md" | "lg"
  /**
   * Make the rail label-capable: it renders labels beside the icons on a wider
   * rail and gains a collapse/expand control that toggles between the labeled
   * width and the icon-only rail (icons + hover tooltips). When omitted the rail
   * is permanently icon-only with no collapse control.
   */
  railLabels?: boolean
  /**
   * Controlled rail-collapsed state. Provide it (seeded from a server-readable
   * source such as a cookie) in SSR apps so the collapsed/expanded rail survives
   * reload without a hydration mismatch. Omit to let the rail persist to
   * localStorage. Independent of `panelOpen` — the nav rail and the slide-out
   * panel collapse separately. Only meaningful with `railLabels`.
   */
  railCollapsed?: boolean
  onRailCollapsedChange?: (collapsed: boolean) => void
  /** Initial rail-collapsed state when uncontrolled (default: expanded). */
  defaultRailCollapsed?: boolean
  /**
   * Close the panel when a link nav item is clicked. Useful when the panel is
   * contextual to one section (e.g. a chat thread list) rather than a global
   * dock. Selecting items inside the panel itself does not trigger this.
   */
  closePanelOnNavigate?: boolean
  className?: string
  sidebarClassName?: string
  /** Class for the `<main>` content region (e.g. `flex h-screen ... overflow-hidden`). */
  contentClassName?: string
}

const HIDE_BELOW_CLASS = {
  md: "max-md:hidden",
  lg: "max-lg:hidden",
} as const

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
  children?: React.ReactNode
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

function SidebarLayoutInner({
  children,
  navItems,
  activeId,
  panel,
  logo,
  logoHref,
  railHeaderContent,
  user,
  isLoading = false,
  onLogout,
  onSettingsClick,
  settingsHref,
  profileMenuItems,
  showThemeToggle = false,
  railFooter,
  LinkComponent,
  hideBelow,
  railLabels = false,
  closePanelOnNavigate = false,
  className,
  sidebarClassName,
  contentClassName,
}: SidebarLayoutProps) {
  const Link = LinkComponent ?? DefaultLink
  const { panelOpen, togglePanel, setPanelOpen, railCollapsed, toggleRail } = useSidebar()
  const handleNavClick = closePanelOnNavigate && panelOpen ? () => setPanelOpen(false) : undefined
  const hasProfile = user !== undefined || onLogout !== undefined || onSettingsClick !== undefined
  // The rail shows labels only when it is label-capable AND the user has not
  // collapsed it. Collapsing a labeled rail returns the icon-only look (with
  // hover tooltips via each RailButton's `title`).
  const showLabels = railLabels && !railCollapsed

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      {/* Wrap the fixed sidebar so the responsive-hide class lands on an
          element with no competing `display` utility. The rail itself carries
          `flex`; once the consumer's Tailwind redefines `.flex` (its stylesheet
          loads after this library's) that would win the equal-specificity
          cascade against `max-lg:hidden`. A bare wrapper has no such conflict. */}
      <div className={cn(hideBelow && HIDE_BELOW_CLASS[hideBelow])}>
        <Sidebar className={sidebarClassName}>
          <SidebarRail>
            {(railHeaderContent !== undefined || logo !== undefined) && (
              <SidebarRailHeader className={cn(showLabels && (railHeaderContent !== undefined ? "px-2" : "justify-start px-4"))}>
                {railHeaderContent !== undefined ? (
                  railHeaderContent
                ) : (
                  <Link
                    href={logoHref}
                    to={logoHref}
                    className="flex items-center justify-center rounded-lg p-1 transition-colors hover:bg-muted/50"
                  >
                    {logo}
                  </Link>
                )}
              </SidebarRailHeader>
            )}

            <SidebarRailNav className={showLabels ? "px-2" : undefined}>
              {navItems.map((item) => {
                if (item.flyoutItems && item.flyoutItems.length > 0) {
                  const activeSet = new Set(item.flyoutActiveIds ?? [])
                  return (
                    <RailFlyout
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      title={item.label}
                      showLabel={showLabels}
                      isActive={activeId === item.id || item.flyoutItems.some((f) => activeSet.has(f.id))}
                    >
                      {item.flyoutItems.map((f) => {
                        const FIcon = f.icon
                        const active = activeSet.has(f.id)
                        return (
                          <Link
                            key={f.id}
                            href={f.href}
                            to={f.href}
                            onClick={handleNavClick}
                            {...(f.prefetch !== undefined ? { prefetch: f.prefetch } : {})}
                            className={cn(
                              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                              active
                                ? "bg-[var(--accent-surface-strong)] font-medium text-[var(--accent-text)]"
                                : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-[var(--accent-text)]",
                            )}
                          >
                            <FIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{f.label}</span>
                          </Link>
                        )
                      })}
                    </RailFlyout>
                  )
                }
                return item.togglesPanel ? (
                  <RailButton
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    isActive={panelOpen}
                    onClick={togglePanel}
                    showLabel={showLabels}
                  />
                ) : (
                  <RailButton key={item.id} icon={item.icon} label={item.label} badge={item.badge} isActive={activeId === item.id} showLabel={showLabels} asChild>
                    <Link
                      href={item.href}
                      to={item.href}
                      onClick={handleNavClick}
                      {...(item.prefetch !== undefined ? { prefetch: item.prefetch } : {})}
                    />
                  </RailButton>
                )
              })}
            </SidebarRailNav>

            {(railLabels || railFooter !== undefined || hasProfile) && (
              <SidebarRailFooter className={cn("border-t border-border pt-2", showLabels && "items-stretch px-2")}>
                {railLabels && (
                  <RailCollapseToggle collapsed={railCollapsed} showLabel={showLabels} onToggle={toggleRail} />
                )}
                {railFooter}
                {hasProfile && (() => {
                  const profile = (
                    <ProfileAvatar
                      user={user ?? undefined}
                      isLoading={isLoading}
                      onLogout={onLogout}
                      onSettingsClick={onSettingsClick}
                      settingsHref={settingsHref}
                      showDetails={showLabels}
                      LinkComponent={Link}
                    >
                      {profileMenuItems}
                    </ProfileAvatar>
                  )
                  if (!showThemeToggle) return profile
                  // Visible compact theme switch beside the profile (a row on the
                  // labeled rail, stacked above the avatar on the icon-only rail).
                  return showLabels ? (
                    <div className="flex w-full items-center gap-1">
                      <div className="min-w-0 flex-1">{profile}</div>
                      <RailThemeToggle />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <RailThemeToggle />
                      {profile}
                    </div>
                  )
                })()}
              </SidebarRailFooter>
            )}
          </SidebarRail>

          {panel != null && <SidebarPanel>{panel}</SidebarPanel>}
        </Sidebar>
      </div>

      <SidebarContent className={contentClassName}>{children}</SidebarContent>
    </div>
  )
}

// ============================================================================
// Public export — wraps in SidebarProvider
// ============================================================================

/**
 * App shell built on the sidebar rail + slide-out panel, without a top nav bar.
 * Apps supply nav items, an optional panel, and profile/branding props; the
 * standard look, panel docking, content-margin coordination, and responsive
 * hide all live here. Pair `panelOpen`/`onPanelOpenChange` with a cookie for
 * SSR-safe persistence.
 */
export function SidebarLayout({
  panelOpen,
  onPanelOpenChange,
  defaultPanelOpen,
  railCollapsed,
  onRailCollapsedChange,
  defaultRailCollapsed,
  ...props
}: SidebarLayoutProps) {
  return (
    <SidebarProvider
      panelOpen={panelOpen}
      onPanelOpenChange={onPanelOpenChange}
      defaultPanelOpen={defaultPanelOpen}
      railCollapsed={railCollapsed}
      onRailCollapsedChange={onRailCollapsedChange}
      defaultRailCollapsed={defaultRailCollapsed}
      hasPanels={props.panel != null}
      labeledRail={props.railLabels ?? false}
    >
      <SidebarLayoutInner {...props} />
    </SidebarProvider>
  )
}
