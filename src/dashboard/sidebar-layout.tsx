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
  ProfileAvatar,
} from "./app-sidebar"
import type { SidebarUser } from "./app-sidebar"
import { SidebarProvider, useSidebar, SIDEBAR_RAIL_LABELED_WIDTH } from "./sidebar-context"

// ============================================================================
// Types
// ============================================================================

export interface SidebarLayoutNavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Destination for link items. Omit when `togglesPanel` is set. */
  href?: string
  /** Render this item as the panel toggle instead of a link. */
  togglesPanel?: boolean
  badge?: number
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
  user?: SidebarUser | null
  isLoading?: boolean
  onLogout?: () => void
  onSettingsClick?: () => void
  settingsHref?: string
  /** Extra items rendered before settings/logout in the profile menu. */
  profileMenuItems?: React.ReactNode
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
  /** Show text labels beside the rail icons on a wider rail (vs. icon-only with hover tooltips). */
  railLabels?: boolean
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
  user,
  isLoading = false,
  onLogout,
  onSettingsClick,
  settingsHref,
  profileMenuItems,
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
  const { panelOpen, togglePanel, setPanelOpen } = useSidebar()
  const handleNavClick = closePanelOnNavigate && panelOpen ? () => setPanelOpen(false) : undefined
  const hasProfile = user !== undefined || onLogout !== undefined || onSettingsClick !== undefined

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
            {logo !== undefined && (
              <SidebarRailHeader className={railLabels ? "justify-start px-4" : undefined}>
                <Link
                  href={logoHref}
                  to={logoHref}
                  className="flex items-center justify-center rounded-lg p-1 transition-colors hover:bg-muted/50"
                >
                  {logo}
                </Link>
              </SidebarRailHeader>
            )}

            <SidebarRailNav className={railLabels ? "px-2" : undefined}>
              {navItems.map((item) =>
                item.togglesPanel ? (
                  <RailButton
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    isActive={panelOpen}
                    onClick={togglePanel}
                    showLabel={railLabels}
                  />
                ) : (
                  <RailButton key={item.id} icon={item.icon} label={item.label} badge={item.badge} isActive={activeId === item.id} showLabel={railLabels} asChild>
                    <Link href={item.href} to={item.href} onClick={handleNavClick} />
                  </RailButton>
                ),
              )}
            </SidebarRailNav>

            {(railFooter !== undefined || hasProfile) && (
              <SidebarRailFooter className={cn("border-t border-border pt-2", railLabels && "items-stretch px-2")}>
                {railFooter}
                {hasProfile && (
                  <ProfileAvatar
                    user={user ?? undefined}
                    isLoading={isLoading}
                    onLogout={onLogout}
                    onSettingsClick={onSettingsClick}
                    settingsHref={settingsHref}
                    showDetails={railLabels}
                    LinkComponent={Link}
                  >
                    {profileMenuItems}
                  </ProfileAvatar>
                )}
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
  ...props
}: SidebarLayoutProps) {
  return (
    <SidebarProvider
      panelOpen={panelOpen}
      onPanelOpenChange={onPanelOpenChange}
      defaultPanelOpen={defaultPanelOpen}
      hasPanels={props.panel != null}
      railWidth={props.railLabels ? SIDEBAR_RAIL_LABELED_WIDTH : undefined}
    >
      <SidebarLayoutInner {...props} />
    </SidebarProvider>
  )
}
