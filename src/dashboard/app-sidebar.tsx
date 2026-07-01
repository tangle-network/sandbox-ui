"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "../lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@tangle-network/ui/primitives"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@tangle-network/ui/primitives"
import { Logo } from "../primitives"
import { Skeleton, useTheme } from "@tangle-network/ui/primitives"
import { Check, Monitor, MoreHorizontal, PanelLeft } from "lucide-react"
import {
  SIDEBAR_PANEL_WIDTH,
  useSidebar,
} from "./sidebar-context"
import { RailTooltip, RAIL_FLOATING_SURFACE } from "./rail-tooltip"

// ============================================================================
// Types
// ============================================================================

export interface SidebarUser {
  email: string
  name?: string
  tier?: string
  avatarUrl?: string
}

/** Theme modes offered by the account menu's Appearance section. */
export type ThemeMode = "light" | "dark" | "system"

/**
 * Host-supplied controller for the account-menu Appearance section. The rail is
 * theme-engine-agnostic: each app wires this to its own theme hook (gtm-agent
 * uses the shared `useTheme`; the sandbox app uses its `vault`-aware
 * `useThemeMode`). Provide it to {@link ProfileAvatar} to render Light/Dark/System.
 */
export interface AppearanceController {
  value: ThemeMode
  onChange: (mode: ThemeMode) => void
  /** Which modes to offer, in order. Defaults to all three. */
  modes?: ThemeMode[]
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

function SunIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Light mode icon</title>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Dark mode icon</title>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

/**
 * Compact light/dark switch driven by the shared `useTheme` hook.
 *
 * @deprecated The redesigned rail no longer renders a standalone theme toggle —
 * theme lives in the account menu as a Light/Dark/System control via the
 * `appearance` controller on {@link ProfileAvatar} (and both layouts). Kept for
 * backward compatibility; not used by `SidebarLayout`/`DashboardLayout`.
 */
export function RailThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isDark =
    mounted &&
    (theme === "dark" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches))

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  )
}

function ChevronsLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Collapse sidebar</title>
      <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
    </svg>
  )
}

function ChevronsRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Expand sidebar</title>
      <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />
    </svg>
  )
}

export interface RailCollapseToggleProps {
  /** Whether the rail is currently collapsed (icon-only). */
  collapsed: boolean
  /** Render with a label beside the chevron (expanded/labeled rail) vs. icon-only. */
  showLabel?: boolean
  onToggle: () => void
  className?: string
}

// Collapse/expand control for the labeled nav rail. A chevron-only button when
// collapsed (with a styled hover tooltip), a labeled row when expanded.
// Independent of the panel toggle — this only changes the rail width.
export function RailCollapseToggle({ collapsed, showLabel, onToggle, className }: RailCollapseToggleProps) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar"
  const Icon = collapsed ? ChevronsRightIcon : ChevronsLeftIcon
  return (
    <RailTooltip label={label} disabled={showLabel} className={showLabel ? "w-full" : undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-pressed={collapsed}
        className={cn(
          "flex shrink-0 items-center rounded-md text-muted-foreground transition-colors",
          showLabel ? "h-9 w-full justify-start gap-2.5 px-2.5" : "h-9 w-9 justify-center",
          "hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className,
        )}
      >
        <Icon className="h-[17px] w-[17px] shrink-0" />
        {showLabel && <span className="text-[13.5px] font-medium">{label}</span>}
      </button>
    </RailTooltip>
  )
}

// ============================================================================
// RailHeader — three-slot rail header (brand · middle · panel toggle)
// ============================================================================

export interface RailHeaderProps {
  /** Brand mark shown on the left, e.g. `<Logo iconOnly />`. */
  brand?: React.ReactNode
  /** Destination for the brand link. When set with `LinkComponent`, the brand is a link. */
  brandHref?: string
  /** Optional middle content (e.g. a project/workspace switcher). Hidden when collapsed. */
  children?: React.ReactNode
  /** Whether the rail is collapsed (icon-only). */
  collapsed: boolean
  /** Collapse/expand the rail. */
  onToggle: () => void
  /**
   * Whether the rail can collapse/expand. When `false`, no panel toggle is
   * rendered and the collapsed header shows the brand without the hover-morph.
   * Defaults to `true`.
   */
  collapsible?: boolean
  // biome-ignore lint/suspicious/noExplicitAny: support various router Link components
  LinkComponent?: React.ComponentType<any>
  className?: string
}

// Panel-icon toggle for the expanded header's right slot. Uses the panel
// glyph (not chevrons) so the affordance reads as "show/hide the sidebar".
function PanelToggleButton({ collapsed, onToggle, className }: { collapsed: boolean; onToggle: () => void; className?: string }) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar"
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={collapsed}
      title={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {/* Same panel glyph for collapse and expand (the affordance is "toggle the sidebar"). */}
      <PanelLeft className="h-[18px] w-[18px] shrink-0" />
    </button>
  )
}

/**
 * The redesigned rail header. Expanded: brand (left) · optional middle · panel
 * toggle (right). Collapsed: only the brand mark, which morphs into the
 * expand button on hover (brand fades out, panel glyph fades in over the same
 * box) so the collapse affordance is discoverable without spending rail width.
 * Renders its own `h-14` bordered bar — drop it in at the top of {@link SidebarRail}.
 */
export function RailHeader({ brand, brandHref, children, collapsed, onToggle, collapsible = true, LinkComponent, className }: RailHeaderProps) {
  const Link = LinkComponent ?? DefaultLink

  const brandNode =
    brandHref !== undefined ? (
      <Link
        href={brandHref}
        to={brandHref}
        aria-label="Home"
        className="flex items-center justify-center rounded-md p-1 transition-colors hover:bg-[var(--accent-surface-soft)]"
      >
        {brand}
      </Link>
    ) : (
      <span className="flex items-center justify-center p-1">{brand}</span>
    )

  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center border-b border-[var(--md3-outline-variant)]",
        collapsed ? "justify-center px-2" : "gap-2 px-3",
        className,
      )}
    >
      {collapsed ? (
        collapsible ? (
          <RailTooltip label="Expand sidebar">
            <button
              type="button"
              onClick={onToggle}
              aria-label="Expand sidebar"
              aria-pressed={true}
              className="group/brand relative flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--accent-surface-soft)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className="flex items-center justify-center transition-opacity duration-150 group-hover/brand:opacity-0">
                {brand}
              </span>
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-foreground opacity-0 transition-opacity duration-150 group-hover/brand:opacity-100">
                <PanelLeft className="h-[18px] w-[18px]" />
              </span>
            </button>
          </RailTooltip>
        ) : (
          brandNode
        )
      ) : (
        <>
          {brand !== undefined && brandNode}
          <div className="min-w-0 flex-1">{children}</div>
          {collapsible && <PanelToggleButton collapsed={collapsed} onToggle={onToggle} />}
        </>
      )}
    </div>
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
        "fixed inset-y-0 left-0 z-40 flex bg-surface-container-low border-r border-[var(--md3-outline-variant)] transition-[transform,width] duration-200 ease-in-out",
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

/**
 * @deprecated Superseded by {@link RailHeader}, the three-slot header
 * (brand · middle · panel toggle) used by both shells. Kept for backward
 * compatibility; no longer rendered by `SidebarLayout`/`DashboardLayout`.
 */
export function SidebarRailHeader({ children, className }: SidebarRailHeaderProps) {
  return (
    <div className={cn("flex h-14 shrink-0 items-center justify-center border-b border-[var(--md3-outline-variant)]", className)}>
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
  /**
   * Click handler on the `<nav>` itself. Layouts use it (with a
   * `target === currentTarget` guard) so clicking the empty body of a collapsed
   * rail expands it, without intercepting clicks on the nav items.
   */
  onClick?: React.MouseEventHandler<HTMLElement>
}

export function SidebarRailNav({ children, className, onClick }: SidebarRailNavProps) {
  return (
    <nav onClick={onClick} className={cn("flex flex-col items-center gap-1 py-3 flex-1 min-h-0 overflow-y-auto", className)}>
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
    <div className={cn("flex flex-col items-center gap-1 pb-3 shrink-0", className)}>
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
  /**
   * `"primary"` gives the item a distinct emphasized pill (accent fill + accent
   * border) so it stands out from the rest of the nav, e.g. a "New" action.
   * Defaults to `"normal"`.
   */
  variant?: "normal" | "primary"
}

export function RailButton({ icon: Icon, label, isActive, badge, onClick, className, showLabel, asChild, children, variant = "normal" }: RailButtonProps) {
  const classes = cn(
    "relative flex shrink-0 items-center justify-center rounded-md transition-colors duration-150",
    showLabel ? "w-full justify-start px-2.5 h-9 gap-2.5" : "w-9 h-9 justify-center",
    // Quiet press feedback via color only — no scale on the full-width row.
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    // The active item (route matches) and any explicit primary share one
    // emphasized look — a filled accent pill with an accent ring — so the
    // current destination clearly stands out from the default rows.
    variant === "primary" || isActive
      ? "bg-[var(--accent-surface-strong)] text-[var(--accent-text)] font-medium ring-1 ring-inset ring-[var(--border-accent)]"
      : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
    className,
  )

  // Badge anchored to the icon (not the row) so it stays on the icon corner in
  // both icon-only and labeled modes, and through the collapse transition.
  const iconWithBadge = (
    <span className="relative flex shrink-0 items-center justify-center">
      <Icon className="h-[17px] w-[17px] shrink-0" />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-[var(--md3-on-primary)] px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </span>
  )

  const content = (
    <>
      {iconWithBadge}
      {showLabel && <span className="text-[13.5px] font-medium">{label}</span>}
    </>
  )

  if (asChild && React.isValidElement(children)) {
    // biome-ignore lint/suspicious/noExplicitAny: merge onto an unknown child element (Link/anchor)
    const child = children as React.ReactElement<any>
    const merged = React.cloneElement(
      child,
      { className: cn(classes, child.props.className), "aria-label": child.props["aria-label"] ?? label },
      content,
    )
    return (
      <RailTooltip label={label} disabled={showLabel} className={showLabel ? "w-full" : undefined}>
        {merged}
      </RailTooltip>
    )
  }

  return (
    <RailTooltip label={label} disabled={showLabel} className={showLabel ? "w-full" : undefined}>
      <button type="button" onClick={onClick} aria-label={label} className={classes}>
        {content}
      </button>
    </RailTooltip>
  )
}

// ============================================================================
// RailFlyout — a rail item whose children open in a panel to the RIGHT of the rail
// ============================================================================

export interface RailFlyoutProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  /** Highlight the trigger (e.g. when a child route is active). */
  isActive?: boolean
  /** Show the label text beside the icon (labeled rail) vs. icon-only. */
  showLabel?: boolean
  /** Heading rendered at the top of the open flyout. Defaults to `label`. */
  title?: string
  /** Flyout body — the sub-surfaces revealed when the item is opened. */
  children: React.ReactNode
  className?: string
}

/**
 * A rail entry that reveals its sub-surfaces in a small panel anchored to the
 * RIGHT of the rail item, rather than pushing the rail open with an inline
 * accordion. Opens on click, closes on outside-click, Escape, or selecting an
 * item inside it. Use for a single "door" (e.g. Studio) that fronts several
 * related destinations without permanently spending rail height on them.
 */
export function RailFlyout({
  icon: Icon,
  label,
  isActive,
  showLabel,
  title,
  children,
  className,
}: RailFlyoutProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const active = isActive || open
  const triggerClasses = cn(
    "relative flex shrink-0 items-center rounded-md transition-colors duration-150",
    showLabel ? "w-full justify-start px-2.5 h-9 gap-2.5" : "w-9 h-9 justify-center",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    active
      ? "bg-[var(--accent-surface-strong)] text-[var(--accent-text)]"
      : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
    className,
  )

  return (
    <div ref={ref} className={cn("relative", showLabel && "w-full")}>
      <RailTooltip label={label} disabled={showLabel || open} className={showLabel ? "w-full" : undefined}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={triggerClasses}
      >
        <Icon className="h-[17px] w-[17px] shrink-0" />
        {showLabel && <span className="text-sm font-medium">{label}</span>}
        {showLabel && (
          <ChevronRightIcon
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        )}
      </button>
      </RailTooltip>

      {open && (
        // Anchored to the right edge of the rail item; full-height-independent
        // floating card. `onClickCapture` closes after a child link/button fires
        // so selecting a sub-surface dismisses the flyout.
        <div
          role="menu"
          onClickCapture={(e) => {
            const el = e.target as HTMLElement
            if (el.closest("a,button")) setOpen(false)
          }}
          className={cn(
            "absolute left-full top-0 z-50 ml-2 min-w-[12rem] p-1.5",
            RAIL_FLOATING_SURFACE,
          )}
        >
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 select-none">
            {title ?? label}
          </p>
          {children}
        </div>
      )}
    </div>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <title>Expand</title>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

// ============================================================================
// RailExpandable — nav item with sub-items (inline accordion / collapsed flyout)
// ============================================================================

/** A single entry in a sub-item's hover actions menu (kebab). */
export interface RailSubItemAction {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  /** Style the item as a destructive action (e.g. delete). */
  destructive?: boolean
  onSelect: () => void
}

/** A sub-destination revealed by a {@link RailExpandable} item. */
export interface RailExpandableSubItem {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  href: string
  prefetch?: "none" | "intent" | "render" | "viewport"
  /** Show a live working indicator on the row while the item is busy. */
  isLoading?: boolean
  /** Render the row emphasized (bold + accent) so it stands out — e.g. a
   *  trailing "view all" action below a capped list. */
  emphasis?: boolean
  /** Mark the row as unread — bold label + a leading dot. Suppressed while
   *  `isLoading` so a responding row shows only the working indicator. */
  unread?: boolean
  /** Hover-revealed kebab actions (e.g. rename/delete). Rendered on the
   *  labeled rail only; ignored in the collapsed-rail flyout. */
  actions?: RailSubItemAction[]
}

export interface RailExpandableProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  /** Destination for the row itself. Clicking the label navigates here. */
  href?: string
  /** Highlight the row (e.g. its own route or a child route is active). */
  isActive?: boolean
  /** Labeled (expanded) rail vs. icon-only (collapsed) rail. */
  showLabel?: boolean
  /** Fixed sub-items. Mutually exclusive with `loadSubItems`. */
  subItems?: RailExpandableSubItem[]
  /** Lazy sub-items — called once on first open; the result is cached. */
  loadSubItems?: () => Promise<RailExpandableSubItem[]>
  /** Start expanded on mount (labeled rail). Defaults to collapsed. */
  defaultOpen?: boolean
  /** Ids of sub-items whose route is active (drives sub-item highlight). */
  activeSubIds?: string[]
  /** Shown when the resolved sub-item list is empty. */
  emptyLabel?: string
  /** Called when the row or a sub-item navigates (e.g. to close a mobile drawer). */
  onNavigate?: () => void
  // biome-ignore lint/suspicious/noExplicitAny: support various router Link components
  LinkComponent?: React.ComponentType<any>
  className?: string
}

// Shared lazy-load: fixed `subItems` resolve immediately; `loadSubItems` fires
// once on first open and caches. A failed load resets so the next open retries.
function useExpandableItems(
  subItems?: RailExpandableSubItem[],
  loadSubItems?: () => Promise<RailExpandableSubItem[]>,
) {
  const [items, setItems] = React.useState<RailExpandableSubItem[] | null>(subItems ?? null)
  const [loading, setLoading] = React.useState(false)
  const loadedRef = React.useRef(subItems !== undefined)

  // Keep fixed items in sync if the prop identity changes.
  React.useEffect(() => {
    if (subItems !== undefined) {
      setItems(subItems)
      loadedRef.current = true
    }
  }, [subItems])

  const ensureLoaded = React.useCallback(() => {
    if (loadedRef.current || !loadSubItems) return
    loadedRef.current = true
    setLoading(true)
    Promise.resolve(loadSubItems()).then(
      (resolved) => { setItems(resolved); setLoading(false) },
      () => { setItems([]); setLoading(false); loadedRef.current = false },
    )
  }, [loadSubItems])

  return { items, loading, ensureLoaded }
}

function SubItemsSkeleton() {
  const widths = ["w-[88%]", "w-[76%]", "w-[82%]", "w-[64%]"]
  return (
    <div className="flex flex-col gap-1.5 px-2 py-1.5">
      {widths.map((w, i) => (
        <Skeleton key={i} className={cn("h-4", w)} />
      ))}
    </div>
  )
}

/**
 * A nav item that reveals sub-items. On the labeled rail it expands inline as an
 * accordion: the leading icon morphs into a chevron on hover, clicking the
 * chevron toggles the list, and clicking the label navigates (`href`). On the
 * icon-only rail it shows the sub-items in a right-anchored flyout on hover.
 * Sub-items can be fixed (`subItems`) or lazy (`loadSubItems`, with a loading
 * skeleton). Used for e.g. a "History" entry fronting recent sessions.
 */
export function RailExpandable({
  icon: Icon,
  label,
  href,
  isActive,
  showLabel,
  subItems,
  loadSubItems,
  activeSubIds,
  emptyLabel = "Nothing here yet",
  defaultOpen,
  onNavigate,
  LinkComponent,
  className,
}: RailExpandableProps) {
  const Link = LinkComponent ?? DefaultLink
  const [open, setOpen] = React.useState(defaultOpen ?? false)
  const { items, loading, ensureLoaded } = useExpandableItems(subItems, loadSubItems)
  // Start-open consumers still need lazy sub-items loaded without a manual toggle.
  React.useEffect(() => { if (defaultOpen) ensureLoaded() }, [defaultOpen, ensureLoaded])
  const activeSet = React.useMemo(() => new Set(activeSubIds ?? []), [activeSubIds])
  // Collapsed-rail flyout is portaled to <body> (it must escape the rail's
  // scroll-overflow clipping), so it's positioned from the trigger's rect and
  // kept open across the trigger→flyout gap by a small close delay.
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [coords, setCoords] = React.useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  React.useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  const subLink = (item: RailExpandableSubItem) => {
    const FIcon = item.icon
    const active = activeSet.has(item.id)
    const link = (
      <Link
        key={item.id}
        href={item.href}
        to={item.href}
        onClick={onNavigate}
        {...(item.prefetch !== undefined ? { prefetch: item.prefetch } : {})}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 text-[12px] transition-colors",
          active
            ? "h-7 bg-[var(--accent-surface-strong)] font-medium text-[var(--accent-text)]"
            : item.emphasis
              ? "py-2 font-medium text-[var(--accent-text)] hover:underline"
              : "h-7 text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
        )}
      >
        {item.unread && !item.isLoading && !active && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        )}
        {FIcon ? <FIcon className="h-4 w-4 shrink-0" /> : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            item.isLoading && "shimmer-text",
            item.unread && !active && "font-medium text-foreground",
          )}
          {...(item.isLoading ? { role: "status", "aria-label": "Agent responding" } : {})}
        >
          {item.label}
        </span>
      </Link>
    )

    // Kebab actions are an expanded-rail affordance only — the collapsed-rail
    // hover flyout stays plain links (a portaled dropdown inside the
    // mouse-leave-closed flyout would fight its own dismissal).
    if (!showLabel || !item.actions?.length) return link

    return (
      <div key={item.id} className="group/sub relative flex items-center">
        {link}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Chat actions"
              className="absolute right-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent-surface-soft)] text-muted-foreground opacity-0 transition hover:text-foreground focus-visible:opacity-100 group-hover/sub:opacity-100 data-[state=open]:bg-[var(--accent-surface-strong)] data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {item.actions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                onSelect={action.onSelect}
                className={cn(
                  "gap-2",
                  action.destructive && "text-destructive focus:text-destructive",
                )}
              >
                {action.icon ? <action.icon className="h-3.5 w-3.5" /> : null}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  const list = loading
    ? <SubItemsSkeleton />
    : items && items.length > 0
      ? items.map(subLink)
      : <p className="px-2.5 py-1.5 text-xs text-muted-foreground">{emptyLabel}</p>

  // ---- Collapsed (icon-only) rail: hover-triggered right flyout (portaled) ----
  if (!showLabel) {
    const triggerClasses = cn(
      "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      isActive || open
        ? "bg-[var(--accent-surface-strong)] text-[var(--accent-text)] font-medium ring-1 ring-inset ring-[var(--border-accent)]"
        : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
    )
    const openFlyout = () => {
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
      ensureLoaded()
      const el = triggerRef.current
      if (el) {
        const r = el.getBoundingClientRect()
        const m = 8
        const left = r.right + m
        const spaceBelow = window.innerHeight - r.top - m
        const spaceAbove = r.bottom - m
        // Anchor downward from the trigger top when there's room; otherwise (e.g.
        // a History item near the bottom) anchor the flyout's bottom to the
        // trigger and let it grow upward. Either way it's capped to the available
        // space and scrolls internally so it never runs off the screen.
        setCoords(
          spaceBelow >= spaceAbove
            ? { left, top: r.top, maxHeight: spaceBelow }
            : { left, bottom: window.innerHeight - r.bottom, maxHeight: spaceAbove },
        )
      }
      setOpen(true)
    }
    const scheduleClose = () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      closeTimer.current = setTimeout(() => setOpen(false), 140)
    }
    const cancelClose = () => {
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    }
    return (
      <div
        ref={triggerRef}
        className={cn("relative", className)}
        onMouseEnter={openFlyout}
        onMouseLeave={scheduleClose}
        onFocusCapture={openFlyout}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) scheduleClose() }}
      >
        {href ? (
          <Link href={href} to={href} onClick={onNavigate} aria-label={label} className={triggerClasses}>
            <Icon className="h-[17px] w-[17px] shrink-0" />
          </Link>
        ) : (
          <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} className={triggerClasses}>
            <Icon className="h-[17px] w-[17px] shrink-0" />
          </button>
        )}

        {open && coords !== null && typeof document !== "undefined" &&
          createPortal(
            <div
              role="menu"
              style={{
                position: "fixed",
                left: coords.left,
                top: coords.top,
                bottom: coords.bottom,
                maxHeight: coords.maxHeight,
              }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false) }}
              className={cn("z-[70] flex w-60 flex-col overflow-hidden p-1.5", RAIL_FLOATING_SURFACE)}
            >
              <p className="shrink-0 px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 select-none">
                {label}
              </p>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">{list}</div>
            </div>,
            document.body,
          )}
      </div>
    )
  }

  // ---- Labeled (expanded) rail: inline accordion ----
  const toggle = () => {
    setOpen((v) => {
      const next = !v
      if (next) ensureLoaded()
      return next
    })
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "group/exp relative flex h-9 w-full items-center rounded-md transition-colors duration-150",
          isActive
            ? "bg-[var(--accent-surface-strong)] text-[var(--accent-text)] font-medium ring-1 ring-inset ring-[var(--border-accent)]"
            : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
        )}
      >
        {/* Leading slot: the item's own icon at rest (whether open or closed);
            the chevron reveals only on hover (rotated down when open). Toggles the list. */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Icon
            className="h-[17px] w-[17px] shrink-0 opacity-100 transition-opacity duration-150 group-hover/exp:opacity-0"
          />
          <ChevronRightIcon
            className={cn(
              "absolute h-4 w-4 opacity-0 transition-all duration-150 group-hover/exp:opacity-100",
              open && "rotate-90",
            )}
          />
        </button>

        {/* Label: navigates when `href` is set, otherwise toggles the list. */}
        {href ? (
          <Link
            href={href}
            to={href}
            onClick={onNavigate}
            className="flex h-9 min-w-0 flex-1 items-center pr-2.5 text-[13.5px] font-medium"
          >
            <span className="truncate">{label}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 min-w-0 flex-1 items-center pr-2.5 text-left text-[13.5px] font-medium"
          >
            <span className="truncate">{label}</span>
          </button>
        )}
      </div>

      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-3">{list}</div>
      )}
    </div>
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
        "transition-[opacity] duration-150 h-full overflow-hidden border-l border-[var(--md3-outline-variant)] bg-surface-container-low",
        panelOpen ? "w-[268px] opacity-100" : "w-0 opacity-0 pointer-events-none",
        className,
      )}
    >
      <div className="flex flex-col h-full w-[268px]">
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
    <div className={cn("flex h-14 items-center px-4 border-b border-[var(--md3-outline-variant)] shrink-0", className)}>
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
  /**
   * When provided, the menu renders an Appearance section (Light/Dark/System)
   * driven by this host-supplied controller. Omit to hide it.
   */
  appearance?: AppearanceController
  // biome-ignore lint/suspicious/noExplicitAny: Support various router Link components
  LinkComponent?: React.ComponentType<any>
}

// Appearance (theme) picker rendered inside the profile dropdown. A single
// "Appearance" row shows the current theme; hovering it opens a submenu with
// Light / Dark / System (à la Claude / ChatGPT). Selecting a mode calls
// `onSelect` with `preventDefault()` so the menu stays open and the active
// check updates live.
const APPEARANCE_META: Record<ThemeMode, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  light: { label: "Light", Icon: SunIcon },
  dark: { label: "Dark", Icon: MoonIcon },
  system: { label: "System", Icon: Monitor },
}

function AppearanceMenuSection({ appearance, divider = true }: { appearance: AppearanceController; divider?: boolean }) {
  const modes = appearance.modes ?? ["light", "dark", "system"]
  // Resolve "system" → light/dark from the OS, but only after mount and via
  // state (not a bare `matchMedia()` call in render): the server/first-client
  // render is deterministic (`systemDark` starts false → no hydration mismatch
  // for the caption), then it updates after mount and tracks live OS changes.
  const [systemDark, setSystemDark] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemDark(mq.matches)
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  const resolved = appearance.value === "system" ? (systemDark ? "dark" : "light") : appearance.value
  const TriggerIcon = resolved === "dark" ? MoonIcon : SunIcon
  const caption =
    appearance.value === "system"
      ? `System (${resolved === "dark" ? "Dark" : "Light"})`
      : APPEARANCE_META[appearance.value].label

  return (
    <>
      {divider && <DropdownMenuSeparator />}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          {/* Icons are decorative — the text labels carry the meaning, so they're
              hidden from the a11y tree (also keeps menu-item names clean). */}
          <span aria-hidden="true" className="mr-2 inline-flex shrink-0">
            <TriggerIcon className="h-4 w-4" />
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span>Appearance</span>
            <span className="text-xs text-muted-foreground">{caption}</span>
          </div>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent sideOffset={6} className="min-w-[12rem]">
          {modes.map((m) => {
            const { label, Icon } = APPEARANCE_META[m]
            const active = appearance.value === m
            return (
              <DropdownMenuItem
                key={m}
                onSelect={(e) => { e.preventDefault(); appearance.onChange(m) }}
                className="gap-3 py-2 text-[14px]"
              >
                <span aria-hidden="true" className="inline-flex shrink-0">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1">{label}</span>
                {active && (
                  <span aria-hidden="true" className="inline-flex shrink-0 text-[var(--accent-text)]">
                    <Check className="h-[18px] w-[18px]" />
                  </span>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
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
  appearance,
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
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
                <Skeleton className="h-3.5 w-24" />
              ) : (
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.name ?? user?.email ?? "Not signed in"}
                </p>
              )}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-72">
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
        {appearance && <AppearanceMenuSection appearance={appearance} divider={Boolean(children)} />}
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
