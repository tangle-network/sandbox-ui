"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import { MOTION_CONTROL, MOTION_TRAVEL } from "../lib/motion"
import { useBrandThemeSync } from "./use-brand-theme-sync"
import {
  Sidebar,
  SidebarRail,
  SidebarRailNav,
  SidebarRailFooter,
  SidebarPanel,
  SidebarContent,
  RailButton,
  RailFlyout,
  RailExpandable,
  RailHeader,
  ProfileAvatar,
} from "./app-sidebar"
import type { SidebarUser, AppearanceController, RailExpandableSubItem } from "./app-sidebar"
import { SidebarProvider, useSidebar, SIDEBAR_MOBILE_WIDTH } from "./sidebar-context"

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
  /**
   * Give the item an emphasized "primary" pill so it stands out (e.g. a "New"
   * action). Ignored for `togglesPanel`/`flyoutItems`/`expandable` items.
   */
  variant?: "normal" | "primary"
  /**
   * Render as an expandable item: an inline accordion on the labeled rail, a
   * hover flyout on the icon-only rail. `href` (if set) navigates; the
   * disclosure reveals `subItems` (fixed) or `loadSubItems()` (lazy). Takes
   * precedence over `href`/`togglesPanel`/`flyoutItems`.
   */
  expandable?: boolean
  /** Fixed sub-items for an `expandable` item (icon optional). */
  subItems?: RailExpandableSubItem[]
  /** Lazy sub-items for an `expandable` item — loaded once on first open. */
  loadSubItems?: () => Promise<RailExpandableSubItem[]>
  /** Ids of an `expandable` item's sub-items whose route is active. */
  subActiveIds?: string[]
  /** Empty-state text for an `expandable` item that resolves to no sub-items. */
  emptyLabel?: string
  /** Start an `expandable` item expanded on mount (labeled rail). */
  defaultOpen?: boolean
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
  /**
   * When provided, the profile menu shows an Appearance section
   * (Light/Dark/System) driven by this host-supplied controller. The host wires
   * it to its own theme engine. Replaces the old standalone rail theme toggle.
   */
  appearance?: AppearanceController
  /**
   * @deprecated No-op. The standalone rail theme toggle was replaced by the
   * account-menu `appearance` control. Accepted (and ignored) for backward
   * compatibility; will be removed in a future major.
   */
  showThemeToggle?: boolean
  /**
   * @deprecated No-op. The collapse/expand control now always lives in the
   * header (`RailHeader`). Accepted (and ignored) for backward compatibility;
   * will be removed in a future major.
   */
  railCollapseToggle?: "header" | "footer"
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

/** Inverse of {@link HIDE_BELOW_CLASS} — the mobile surfaces that stand in for
 *  the hidden rail show exactly where the rail does not. */
const SHOW_BELOW_CLASS = {
  md: "md:hidden",
  lg: "lg:hidden",
} as const

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
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
  appearance,
  railFooter,
  LinkComponent,
  hideBelow,
  railLabels = false,
  closePanelOnNavigate = false,
  className,
  sidebarClassName,
  contentClassName,
}: SidebarLayoutProps) {
  // Keep light/dark tokens switching correctly under brand 0.6 regardless of which
  // control toggled the theme (see useBrandThemeSync).
  useBrandThemeSync()
  const Link = LinkComponent ?? DefaultLink
  const { panelOpen, togglePanel, setPanelOpen, railCollapsed, toggleRail } = useSidebar()
  const handleNavClick = closePanelOnNavigate && panelOpen ? () => setPanelOpen(false) : undefined
  // On a collapsed labeled rail, clicking the empty body (not an item) expands
  // it — a large, discoverable hit target. The `currentTarget` guard keeps item
  // clicks (which bubble) from triggering it.
  const expandOnEmptyClick =
    railLabels && railCollapsed
      ? (e: React.MouseEvent<HTMLElement>) => { if (e.target === e.currentTarget) toggleRail() }
      : undefined
  const hasProfile = user !== undefined || onLogout !== undefined || onSettingsClick !== undefined
  // The rail shows labels only when it is label-capable AND the user has not
  // collapsed it. Collapsing a labeled rail returns the icon-only look (with
  // hover tooltips via each RailButton's `title`).
  const showLabels = railLabels && !railCollapsed

  // The mobile drawer's own open state. Local rather than context: the rail's
  // collapse and the slide-out panel both persist across reloads, and a nav
  // drawer that reopened itself on every page load would be a bug, not a
  // feature.
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const closeMobileNav = React.useCallback(() => setMobileNavOpen(false), [])

  /**
   * One nav list, rendered twice — once in the desktop rail, once in the mobile
   * drawer. Sharing the renderer is the point: a product adds a destination to
   * `navItems` and it appears on both, so a phone can never silently lose a
   * door the desktop has.
   *
   * Every item arrives on the shared entrance, staggered by its position: the
   * rail reads as a list unfolding top-down rather than a block of icons
   * appearing at once. `--stagger-index` is capped inside `.agent-arrive`, so a
   * long nav does not open with a cascade.
   */
  function renderNavItems({
    showLabels,
    onNavigate,
  }: {
    showLabels: boolean
    onNavigate?: () => void
  }) {
    return navItems.map((item, index) => {
      const arrival = { className: "agent-arrive", style: { "--stagger-index": index } as React.CSSProperties }
      if (item.expandable) {
        return (
          <RailExpandable
            key={item.id}
            icon={item.icon}
            label={item.label}
            href={item.href}
            isActive={activeId === item.id}
            showLabel={showLabels}
            subItems={item.subItems}
            loadSubItems={item.loadSubItems}
            activeSubIds={item.subActiveIds}
            emptyLabel={item.emptyLabel}
            defaultOpen={item.defaultOpen}
            onNavigate={onNavigate}
            LinkComponent={LinkComponent}
            {...arrival}
          />
        )
      }
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
            {...arrival}
          >
            {item.flyoutItems.map((f) => {
              const FIcon = f.icon
              const active = activeSet.has(f.id)
              return (
                <Link
                  key={f.id}
                  href={f.href}
                  to={f.href}
                  onClick={onNavigate}
                  {...(f.prefetch !== undefined ? { prefetch: f.prefetch } : {})}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                    MOTION_CONTROL,
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
          onClick={() => {
            togglePanel()
            onNavigate?.()
          }}
          showLabel={showLabels}
          {...arrival}
        />
      ) : (
        <RailButton key={item.id} icon={item.icon} label={item.label} badge={item.badge} isActive={activeId === item.id} showLabel={showLabels} variant={item.variant} asChild {...arrival}>
          <Link
            href={item.href}
            to={item.href}
            onClick={onNavigate}
            {...(item.prefetch !== undefined ? { prefetch: item.prefetch } : {})}
          />
        </RailButton>
      )
    })
  }

  return (
    <div className={cn("min-h-screen bg-surface text-foreground", className)}>
      {/* Wrap the fixed sidebar so the responsive-hide class lands on an
          element with no competing `display` utility. The rail itself carries
          `flex`; once the consumer's Tailwind redefines `.flex` (its stylesheet
          loads after this library's) that would win the equal-specificity
          cascade against `max-lg:hidden`. A bare wrapper has no such conflict. */}
      <div className={cn(hideBelow && HIDE_BELOW_CLASS[hideBelow])}>
        <Sidebar className={sidebarClassName}>
          <SidebarRail>
            {(logo !== undefined || railHeaderContent !== undefined || railLabels) && (
              <RailHeader
                brand={logo}
                brandHref={logoHref}
                collapsed={!showLabels}
                onToggle={toggleRail}
                collapsible={railLabels}
                LinkComponent={LinkComponent}
              >
                {railHeaderContent}
              </RailHeader>
            )}

            <SidebarRailNav className={cn(showLabels ? "px-2" : undefined, expandOnEmptyClick && "cursor-pointer")} onClick={expandOnEmptyClick}>
              {renderNavItems({ showLabels, onNavigate: handleNavClick })}
            </SidebarRailNav>

            {(railFooter !== undefined || hasProfile) && (
              <SidebarRailFooter className={cn("border-t border-[var(--md3-outline-variant)] pt-2", showLabels && "items-stretch px-2")}>
                {railFooter}
                {hasProfile && (
                  <ProfileAvatar
                    user={user ?? undefined}
                    isLoading={isLoading}
                    onLogout={onLogout}
                    onSettingsClick={onSettingsClick}
                    settingsHref={settingsHref}
                    showDetails={showLabels}
                    appearance={appearance}
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

      <SidebarContent className={contentClassName}>
        {/* Below `hideBelow` the rail is display:none, so without this bar the
            app's sections have no entry point at all on a phone. It renders as
            the first child of <main> rather than a sibling so a consumer's
            `h-screen flex-col` content class keeps working: the bar is a
            shrink-0 row and the app's own content flexes beneath it. */}
        {hideBelow && (
          <header
            className={cn(
              "flex h-14 shrink-0 items-center gap-1 border-b border-[var(--md3-outline-variant)] bg-surface px-2",
              SHOW_BELOW_CLASS[hideBelow],
            )}
          >
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="sidebar-mobile-nav"
              aria-haspopup="dialog"
              onClick={() => setMobileNavOpen(true)}
              className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--accent-surface-soft)] hover:text-foreground", MOTION_CONTROL)}
            >
              <MenuIcon className="size-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center">
              {railHeaderContent ?? (
                logo !== undefined ? (
                  <Link href={logoHref} to={logoHref} className="flex min-w-0 items-center">
                    {logo}
                  </Link>
                ) : null
              )}
            </div>
            {hasProfile && (
              <ProfileAvatar
                user={user ?? undefined}
                isLoading={isLoading}
                onLogout={onLogout}
                onSettingsClick={onSettingsClick}
                settingsHref={settingsHref}
                appearance={appearance}
                LinkComponent={Link}
              >
                {profileMenuItems}
              </ProfileAvatar>
            )}
          </header>
        )}
        {children}
      </SidebarContent>

      {hideBelow && mobileNavOpen && (
        <MobileNavDrawer
          breakpoint={hideBelow}
          onClose={closeMobileNav}
          header={railHeaderContent ?? logo}
          footer={
            railFooter !== undefined || hasProfile ? (
              <>
                {railFooter}
                {hasProfile && (
                  <ProfileAvatar
                    user={user ?? undefined}
                    isLoading={isLoading}
                    onLogout={onLogout}
                    onSettingsClick={onSettingsClick}
                    settingsHref={settingsHref}
                    showDetails
                    appearance={appearance}
                    LinkComponent={Link}
                  >
                    {profileMenuItems}
                  </ProfileAvatar>
                )}
              </>
            ) : null
          }
          panel={panel}
        >
          {/* Labels always show here — the drawer has the width the rail does
              not, and an icon-only phone drawer would be a worse rail. */}
          {renderNavItems({
            showLabels: true,
            onNavigate: () => {
              handleNavClick?.()
              closeMobileNav()
            },
          })}
        </MobileNavDrawer>
      )}
    </div>
  )
}

// ============================================================================
// MobileNavDrawer — the rail's stand-in below `hideBelow`
// ============================================================================

/**
 * A left slide-over holding the same nav items the rail renders, plus the
 * slide-out panel's content when the app has one (on a phone there is no room
 * to dock a panel beside a rail, so the two stack in one surface).
 *
 * Deliberately built on plain elements rather than a dialog dependency: the
 * package ships no modal primitive, and a nav drawer needs only a backdrop,
 * Escape, a focus trap and a scroll lock.
 */
function MobileNavDrawer({
  breakpoint,
  onClose,
  header,
  footer,
  panel,
  children,
}: {
  breakpoint: "md" | "lg"
  onClose: () => void
  header?: React.ReactNode
  footer?: React.ReactNode
  panel?: React.ReactNode
  children: React.ReactNode
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)

  // Escape closes, and Tab cycles inside the drawer. Without the trap, tabbing
  // walks into the page behind the backdrop, which a screen reader then reads
  // as if the drawer were not there.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const root = panelRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [onClose])

  // Scroll lock, restoring whatever the page had rather than assuming "".
  React.useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Move focus in on open so a keyboard or screen-reader user lands inside the
  // drawer instead of on the page behind it.
  React.useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("button,a[href]")?.focus()
  }, [])

  return (
    <div className={cn("fixed inset-0 z-50", SHOW_BELOW_CLASS[breakpoint])}>
      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        ref={panelRef}
        id="sidebar-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        style={{ width: SIDEBAR_MOBILE_WIDTH }}
        // The drawer arrives on the shared entrance rather than snapping into
        // place; its nav items then arrive staggered inside it, so the surface
        // and its contents read as one movement instead of two events.
        className="agent-arrive absolute inset-y-0 left-0 flex max-w-[85vw] flex-col border-r border-[var(--md3-outline-variant)] bg-surface-container-low shadow-xl"
      >
        <div className="flex h-14 shrink-0 items-center gap-1 border-b border-[var(--md3-outline-variant)] px-2">
          <div className="flex min-w-0 flex-1 items-center">{header}</div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--accent-surface-soft)] hover:text-foreground", MOTION_CONTROL)}
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <nav aria-label="Sections" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {children}
          {panel != null && (
            <div className="mt-2 border-t border-[var(--md3-outline-variant)] pt-2">{panel}</div>
          )}
        </nav>

        {footer != null && (
          <div className="shrink-0 border-t border-[var(--md3-outline-variant)] px-2 py-2">{footer}</div>
        )}
      </div>
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
