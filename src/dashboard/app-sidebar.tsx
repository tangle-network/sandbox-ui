"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "../lib/utils"
import { MOTION_CONTROL, MOTION_SURFACE } from "../lib/motion"
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
import { Skeleton } from "@tangle-network/ui/primitives"
import { Check, ChevronRight as ChevronRightIcon, LogOut as LogOutIcon, Monitor, Moon as MoonIcon, MoreHorizontal, PanelLeft, Settings as SettingsIcon, Sun as SunIcon } from "lucide-react"
import {
  SIDEBAR_PANEL_WIDTH,
  useSidebar,
} from "./sidebar-context"
import { RailTooltip, RAIL_FLOATING_SURFACE } from "./rail-tooltip"
import { focusRing } from "@tangle-network/ui/utils"
import { ShellHeader } from "../workspace/shell-header"

export interface SidebarUser {
  email: string
  name?: string
  tier?: string
  avatarUrl?: string
}

export type ThemeMode = "light" | "dark" | "system"

export interface AppearanceController {
  value: ThemeMode
  onChange: (mode: ThemeMode) => void
  modes?: ThemeMode[]
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
  return <a href={href ?? to} className={className} {...rest}>{children}</a>
}

function getInitials(name?: string, email?: string): string {
  if (name) return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
  if (email) return email[0].toUpperCase()
  return "?"
}

export interface RailHeaderProps {
  brand?: React.ReactNode
  brandHref?: string
  children?: React.ReactNode
  collapsed: boolean
  onToggle: () => void
  collapsible?: boolean
  // biome-ignore lint/suspicious/noExplicitAny: support various router Link components
  LinkComponent?: React.ComponentType<any>
  className?: string
}

// Empty React nodes and fragments do not reserve the brand slot.
function isRenderable(node: React.ReactNode): boolean {
  return React.Children.toArray(node).some((child) =>
    React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === React.Fragment
      ? isRenderable(child.props.children)
      : true,
  )
}

export function RailHeader({ brand, brandHref, children, collapsed, onToggle, collapsible = true, LinkComponent, className }: RailHeaderProps) {
  const Link = LinkComponent ?? DefaultLink
  const hasBrand = isRenderable(brand)
  const hasChildren = isRenderable(children)
  const overlay = collapsed && !hasBrand && hasChildren
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar"
  const brandNode = brandHref !== undefined
    ? <Link href={brandHref} to={brandHref} aria-label="Home" className={cn("flex items-center justify-center rounded-md p-1 transition-colors hover:bg-[var(--accent-surface-soft)]", MOTION_CONTROL)}>{brand}</Link>
    : <span className="flex items-center justify-center p-1">{brand}</span>

  return (
    <ShellHeader
      divider={false}
      className={cn(
        "border-b border-[var(--md3-outline-variant)] bg-transparent",
        collapsed ? "justify-center px-2" : "gap-2 px-3",
        className,
      )}
    >
      {hasBrand && !collapsed && brandNode}
      <div className={collapsed ? "relative flex min-w-0 items-center justify-center" : "contents"}>
        {(!collapsed || !hasBrand) && <div className={collapsed ? undefined : "min-w-0 flex-1"}>{children}</div>}
        {/* One mounted button retains focus across collapse and expand. */}
        {collapsible ? (
          <RailTooltip label={label} disabled={!collapsed || overlay} className={overlay ? "pointer-events-none absolute inset-0 m-auto items-center justify-center" : undefined}>
            <button
              type="button"
              onClick={onToggle}
              aria-label={label}
              aria-pressed={collapsed}
              title={collapsed ? undefined : label}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--accent-surface-soft)]",
                MOTION_CONTROL,
                focusRing,
                collapsed && hasBrand ? "group/brand relative h-9 w-9" : "h-8 w-8 text-muted-foreground hover:text-foreground",
                overlay && "pointer-events-none bg-background opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100",
              )}
            >
              {collapsed && hasBrand && <span className={cn("flex items-center justify-center transition-opacity group-hover/brand:opacity-0 group-focus-visible/brand:opacity-0", MOTION_CONTROL)}>{brand}</span>}
              <span className={collapsed && hasBrand ? cn("pointer-events-none absolute inset-0 flex items-center justify-center text-foreground opacity-0 transition-opacity group-hover/brand:opacity-100 group-focus-visible/brand:opacity-100", MOTION_CONTROL) : undefined}>
                <PanelLeft className="h-[18px] w-[18px] shrink-0" />
              </span>
            </button>
          </RailTooltip>
        ) : collapsed && hasBrand ? brandNode : null}
      </div>
    </ShellHeader>
  )
}

export interface SidebarProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Sidebar({ children, className, style }: SidebarProps) {
  const { panelOpen, hidden, hasPanels, railWidth } = useSidebar()

  return <div data-sidebar="true" className={cn(
    "fixed inset-y-0 left-0 z-40 flex bg-surface-container-low transition-none border-r border-[var(--md3-outline-variant)]",
    hidden && "-translate-x-full", className,
  )} style={{ width: (panelOpen && hasPanels) ? railWidth + SIDEBAR_PANEL_WIDTH : railWidth, ...style }}>{children}</div>
}

export interface SidebarRailProps {
  children: React.ReactNode
  className?: string
  wide?: boolean
}

export function SidebarRail({ children, className, wide = false }: SidebarRailProps) {
  const { railWidth } = useSidebar()
  return <div className={cn("flex flex-col h-full shrink-0 bg-transparent", wide && "w-full", className)} style={wide ? undefined : { width: railWidth }}>{children}</div>
}

export interface SidebarRailNavProps {
  children: React.ReactNode
  className?: string
  onClick?: React.MouseEventHandler<HTMLElement>
}

export function SidebarRailNav({ children, className, onClick }: SidebarRailNavProps) {
  return <nav onClick={onClick} className={cn("flex flex-col items-center gap-1 py-3 flex-1 min-h-0 overflow-y-auto", className)}>{children}</nav>
}

export interface SidebarRailFooterProps {
  children: React.ReactNode
  className?: string
}

export function SidebarRailFooter({ children, className }: SidebarRailFooterProps) {
  return <div className={cn("flex flex-col items-center gap-1 pb-3 shrink-0", className)}>{children}</div>
}

export interface RailSeparatorProps {
  className?: string
}

export function RailSeparator({ className }: RailSeparatorProps) {
  return <div className={cn("my-2 h-px w-10 bg-[var(--md3-outline-variant)]", className)} />
}

export interface RailButtonProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  isActive?: boolean
  badge?: number
  badgeLabel?: (count: number) => string
  onClick?: () => void
  className?: string
  showLabel?: boolean
  description?: string
  asChild?: boolean
  children?: React.ReactNode
  variant?: "normal" | "primary"
  style?: React.CSSProperties
}

const defaultBadgeLabel = (count: number) => `${count} new`

export function RailButton({ icon: Icon, label, isActive, badge, badgeLabel = defaultBadgeLabel, onClick, className, showLabel, description, asChild, children, variant = "normal", style }: RailButtonProps) {
  const classes = cn(
    "relative flex shrink-0 items-center justify-center rounded-md transition-colors",
    MOTION_CONTROL,
    showLabel ? "w-full justify-start px-2.5 h-9 gap-2.5" : "w-9 h-9 justify-center",
    focusRing,
    variant === "primary" || isActive
      ? "bg-[var(--accent-surface-strong)] text-[var(--accent-text)] font-medium ring-1 ring-inset ring-[var(--border-accent)]"
      : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
    className,
  )
  const hasBadge = badge !== undefined && badge > 0
  const badgeDot = hasBadge && !showLabel && badge > 9
  const badgeDescription = hasBadge ? badgeLabel(badge) : undefined
  const tooltipLabel = hasBadge ? `${label} · ${badgeDescription}` : label
  const accessibleDescription = [badgeDescription, description].filter(Boolean).join(". ") || undefined
  const tooltipDisabled = showLabel && !description
  const iconWithBadge = (
    <span className="relative flex shrink-0 items-center justify-center">
      <Icon className="h-[17px] w-[17px] shrink-0" />
      {badgeDot ? (
        <span aria-hidden="true" data-badge="dot" className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--accent-text)] ring-2 ring-surface-container-low" />
      ) : hasBadge && (
        <span aria-hidden="true" data-badge="count" className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-xs leading-none font-bold text-[var(--md3-on-primary)] px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </span>
  )

  const content = (
    <>
      {iconWithBadge}
      {showLabel && <span className="text-sm font-medium">{label}</span>}
    </>
  )

  let trigger = <button type="button" onClick={onClick} aria-label={label} aria-description={accessibleDescription} className={classes} style={style}>{content}</button>
  if (asChild && React.isValidElement(children)) {
    // biome-ignore lint/suspicious/noExplicitAny: merge onto an unknown child element (Link/anchor)
    const child = children as React.ReactElement<any>
    trigger = React.cloneElement(
      child,
      {
        className: cn(classes, child.props.className),
        "aria-label": child.props["aria-label"] ?? label,
        "aria-description": child.props["aria-description"] ?? accessibleDescription,
        "aria-current": child.props["aria-current"] ?? (isActive ? "page" : undefined),
        style: { ...child.props.style, ...style },
      },
      content,
    )
  }
  return (
    <RailTooltip label={tooltipLabel} description={description} disabled={tooltipDisabled} className={showLabel ? "w-full" : undefined}>
      {trigger}
    </RailTooltip>
  )
}

export interface RailFlyoutProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  isActive?: boolean
  showLabel?: boolean
  title?: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function RailFlyout({ icon: Icon, label, description, isActive, showLabel, title, children, className, style }: RailFlyoutProps) {
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
    "relative flex shrink-0 items-center rounded-md transition-colors",
    MOTION_CONTROL,
    showLabel ? "w-full justify-start px-2.5 h-9 gap-2.5" : "w-9 h-9 justify-center",
    focusRing,
    active
      ? "bg-[var(--accent-surface-strong)] text-[var(--accent-text)]"
      : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
    className,
  )

  return (
    <div ref={ref} className={cn("relative", showLabel && "w-full")} style={style}>
      <RailTooltip label={label} description={description} disabled={open || (showLabel && !description)} className={showLabel ? "w-full" : undefined}>
      <button
        type="button"
        aria-label={label}
        aria-description={description}
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
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
              MOTION_CONTROL,
              open && "rotate-180",
            )}
          />
        )}
      </button>
      </RailTooltip>

      {open && (
        <div
          role="menu"
          onClickCapture={(e) => {
            const el = e.target as HTMLElement
            if (el.closest("a,button")) setOpen(false)
          }}
          className={cn(
            "absolute left-full top-0 z-50 ml-2 min-w-[12rem] p-1.5",
            "agent-pop-in",
            RAIL_FLOATING_SURFACE,
          )}
        >
          <p className="px-2 pb-1 pt-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70 select-none">
            {title ?? label}
          </p>
          {description && <p className="px-2 pb-2 text-xs text-muted-foreground">{description}</p>}
          {children}
        </div>
      )}
    </div>
  )
}

export interface RailSubItemAction {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  destructive?: boolean
  onSelect: () => void
}

export interface RailExpandableSubItem {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  href: string
  prefetch?: "none" | "intent" | "render" | "viewport"
  isLoading?: boolean
  emphasis?: boolean
  unread?: boolean
  actions?: RailSubItemAction[]
}

export interface RailExpandableProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  href?: string
  isActive?: boolean
  showLabel?: boolean
  subItems?: RailExpandableSubItem[]
  loadSubItems?: () => Promise<RailExpandableSubItem[]>
  defaultOpen?: boolean
  activeSubIds?: string[]
  emptyLabel?: string
  onNavigate?: () => void
  // biome-ignore lint/suspicious/noExplicitAny: support various router Link components
  LinkComponent?: React.ComponentType<any>
  className?: string
  style?: React.CSSProperties
}
function useExpandableItems(
  subItems?: RailExpandableSubItem[],
  loadSubItems?: () => Promise<RailExpandableSubItem[]>,
) {
  const [items, setItems] = React.useState<RailExpandableSubItem[] | null>(subItems ?? null)
  const [loading, setLoading] = React.useState(false)
  const loadedRef = React.useRef(subItems !== undefined)
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

export function RailExpandable({
  icon: Icon, label, description, href, isActive, showLabel, subItems, loadSubItems,
  activeSubIds, emptyLabel = "Nothing here yet", defaultOpen, onNavigate, LinkComponent, className, style,
}: RailExpandableProps) {
  const Link = LinkComponent ?? DefaultLink
  const [open, setOpen] = React.useState(defaultOpen ?? false)
  const { items, loading, ensureLoaded } = useExpandableItems(subItems, loadSubItems)
  React.useEffect(() => { if (defaultOpen) ensureLoaded() }, [defaultOpen, ensureLoaded])
  const [everOpened, setEverOpened] = React.useState(defaultOpen ?? false)
  const discloseRef = React.useRef<HTMLDivElement>(null)
  const discloseId = React.useId()
  React.useEffect(() => {
    const el = discloseRef.current
    if (!el) return
    // React 18 and 19 disagree on the inert prop; set the DOM attribute.
    if (open) el.removeAttribute("inert")
    else el.setAttribute("inert", "")
  }, [open])
  const activeSet = React.useMemo(() => new Set(activeSubIds ?? []), [activeSubIds])
  const rowCurrent = isActive && activeSet.size === 0 ? "page" : undefined
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
        aria-current={active ? "page" : undefined}
        {...(item.prefetch !== undefined ? { prefetch: item.prefetch } : {})}
        className={cn(
          "flex h-8 min-w-0 items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
          MOTION_CONTROL,
          showLabel && item.actions?.length ? "flex-1" : "w-full flex-none",
          active
            ? "bg-[var(--accent-surface-strong)] font-medium text-[var(--accent-text)]"
            : item.emphasis
              ? "font-medium text-[var(--accent-text)] hover:underline"
              : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
        )}
      >
        {item.unread && !item.isLoading && !active && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        )}
        {FIcon ? <FIcon className="h-4 w-4 shrink-0" /> : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            item.isLoading && "agent-shimmer",
            item.unread && !active && "font-medium text-foreground",
          )}
          {...(item.isLoading
            ? {
                role: "status",
                "aria-label": "Agent responding",
              }
            : {})}
        >
          {item.label}
        </span>
        {item.isLoading && (
          <span aria-hidden="true" className="sr-only shrink-0 text-xs text-muted-foreground motion-reduce:not-sr-only">Responding</span>
        )}
      </Link>
    )
    if (!showLabel || !item.actions?.length) return link

    return (
      <div key={item.id} className="group/sub relative flex items-center">
        {link}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Chat actions"
              className={cn(
                "absolute right-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent-surface-soft)] text-muted-foreground opacity-0 transition hover:text-foreground focus-visible:opacity-100 group-hover/sub:opacity-100 data-[state=open]:bg-[var(--accent-surface-strong)] data-[state=open]:opacity-100",
                MOTION_CONTROL,
              )}
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
      : <p className="px-2.5 py-1.5 text-sm text-muted-foreground">{emptyLabel}</p>
  if (!showLabel) {
    const triggerClasses = cn(
      "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
      MOTION_CONTROL,
      focusRing,
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
        style={style}
        onMouseEnter={openFlyout}
        onMouseLeave={scheduleClose}
        onFocusCapture={openFlyout}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) scheduleClose() }}
      >
        {href ? (
          <Link href={href} to={href} onClick={onNavigate} aria-label={label} aria-description={description} aria-current={rowCurrent} className={triggerClasses}>
            <Icon className="h-[17px] w-[17px] shrink-0" />
          </Link>
        ) : (
          <button type="button" aria-label={label} aria-description={description} aria-haspopup="menu" aria-expanded={open} className={triggerClasses}>
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
              className={cn("agent-pop-in z-[70] flex w-60 flex-col overflow-hidden p-1.5", RAIL_FLOATING_SURFACE)}
            >
              <p className="shrink-0 px-2 pb-1 pt-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70 select-none">
                {label}
              </p>
              {description && <p className="shrink-0 px-2 pb-2 text-xs text-muted-foreground">{description}</p>}
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">{list}</div>
            </div>,
            document.body,
          )}
      </div>
    )
  }
  const toggle = () => {
    setOpen((v) => {
      const next = !v
      if (next) {
        ensureLoaded()
        setEverOpened(true)
      }
      return next
    })
  }

  return (
    <div className={cn("w-full", className)} style={style}>
      <RailTooltip label={label} description={description} disabled={!description} className="w-full">
      <div
        className={cn(
          "group/exp relative flex h-9 w-full items-center rounded-md transition-colors",
          MOTION_CONTROL,
          isActive
            ? "bg-[var(--accent-surface-strong)] text-[var(--accent-text)] font-medium ring-1 ring-inset ring-[var(--border-accent)]"
            : "text-muted-foreground hover:bg-[var(--accent-surface-soft)] hover:text-foreground",
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={discloseId}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          aria-description={description}
          className={`flex h-9 w-12 shrink-0 items-center gap-1 rounded-md pl-2 pr-1 ${focusRing}`}
        >
          <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden />
          <ChevronRightIcon
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              MOTION_CONTROL,
              open && "rotate-90",
            )}
            aria-hidden
          />
        </button>
        {React.createElement(href ? Link : "button", {
          ...(href ? { href, to: href, onClick: onNavigate, "aria-current": rowCurrent } : { type: "button", onClick: toggle }),
          "aria-description": description,
          className: cn("flex h-9 min-w-0 flex-1 items-center pr-2.5 text-sm font-medium", !href && "text-left"),
        }, <span className="truncate">{label}</span>)}
      </div>
      </RailTooltip>
      <div ref={discloseRef} id={discloseId} className="grid transition-none" style={{ gridTemplateRows: open ? "1fr" : "0fr" }} data-open={open ? "true" : "false"}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5 pl-3 pt-0.5">{everOpened ? list : null}</div>
        </div>
      </div>
    </div>
  )
}

export interface RailModeButtonProps {
  mode: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge?: number
  badgeLabel?: (count: number) => string
  className?: string
  showLabel?: boolean
  style?: React.CSSProperties
}

export function RailModeButton({ mode, icon, label, badge, badgeLabel, className, showLabel, style }: RailModeButtonProps) {
  const { panelOpen, mode: currentMode, switchMode } = useSidebar()
  return (
    <RailButton
      icon={icon}
      label={label}
      isActive={mode === currentMode && panelOpen}
      badge={badge}
      badgeLabel={badgeLabel}
      onClick={() => switchMode(mode)}
      className={className}
      showLabel={showLabel}
      style={style}
    />
  )
}

export interface SidebarPanelProps {
  children: React.ReactNode
  className?: string
}

export function SidebarPanel({ children, className }: SidebarPanelProps) {
  const { panelOpen } = useSidebar()

  return <div className={cn(
    "transition-[opacity] h-full overflow-hidden border-l border-[var(--md3-outline-variant)] bg-surface-container-low",
    MOTION_SURFACE, panelOpen ? "w-[268px] opacity-100" : "w-0 opacity-0 pointer-events-none", className,
  )}><div className="flex flex-col h-full w-[268px]">{children}</div></div>
}

export interface SidebarPanelHeaderProps {
  children?: React.ReactNode
  title?: string
  className?: string
}

export function SidebarPanelHeader({ children, title, className }: SidebarPanelHeaderProps) {
  return <ShellHeader divider={false} className={cn("border-b border-[var(--md3-outline-variant)] bg-transparent px-4", className)}>
    {children ?? <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
  </ShellHeader>
}

export interface SidebarPanelContentProps {
  children: React.ReactNode
  className?: string
}

export function SidebarPanelContent({ children, className }: SidebarPanelContentProps) {
  return <div className={cn("flex-1 overflow-y-auto px-2 py-2", className)}>{children}</div>
}

export interface SidebarContentProps {
  children: React.ReactNode
  className?: string
}

export function SidebarContent({ children, className }: SidebarContentProps) {
  const { contentMargin } = useSidebar()
  return <main className={cn("min-h-screen transition-none lg:ml-[var(--sb-content-margin,0px)]", className)} style={{ "--sb-content-margin": `${contentMargin}px` } as React.CSSProperties}>{children}</main>
}

export interface ProfileAvatarProps {
  user?: SidebarUser | null
  isLoading?: boolean
  onLogout?: () => void
  onSettingsClick?: () => void
  settingsHref?: string | null
  children?: React.ReactNode
  className?: string
  showDetails?: boolean
  appearance?: AppearanceController
  // biome-ignore lint/suspicious/noExplicitAny: Support various router Link components
  LinkComponent?: React.ComponentType<any>
}
const APPEARANCE_META: Record<ThemeMode, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  light: { label: "Light", Icon: SunIcon },
  dark: { label: "Dark", Icon: MoonIcon },
  system: { label: "System", Icon: Monitor },
}

function AppearanceMenuSection({ appearance, divider = true }: { appearance: AppearanceController; divider?: boolean }) {
  const modes = appearance.modes ?? ["light", "dark", "system"]
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
          <span aria-hidden="true" className="mr-2 inline-flex shrink-0">
            <TriggerIcon className="h-4 w-4" />
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span>Appearance</span>
            <span className="text-sm text-muted-foreground">{caption}</span>
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

export function ProfileAvatar({ user, isLoading = false, onLogout, onSettingsClick, settingsHref = "/dashboard/settings", children, className, showDetails = false, appearance, LinkComponent }: ProfileAvatarProps) {
  const Link = LinkComponent ?? DefaultLink

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center rounded-lg transition-colors hover:bg-[var(--accent-surface-soft)]",
            MOTION_CONTROL,
            focusRing,
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
              <AvatarFallback className="text-sm font-medium bg-[var(--accent-surface-strong)] text-[var(--accent-text)]">
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
              <AvatarFallback className="text-sm bg-[var(--accent-surface-strong)] text-[var(--accent-text)]">
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
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  )}
                  {user?.tier && (
                    <p className="text-sm text-muted-foreground capitalize">{user.tier} Plan</p>
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
        ) : settingsHref !== null ? (
          <DropdownMenuItem asChild>
            <Link href={settingsHref} to={settingsHref} className="flex items-center">
              <SettingsIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              Settings
            </Link>
          </DropdownMenuItem>
        ) : null}
        {onLogout && (
          <>
            {(children || appearance || onSettingsClick || settingsHref !== null) && <DropdownMenuSeparator />}
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
