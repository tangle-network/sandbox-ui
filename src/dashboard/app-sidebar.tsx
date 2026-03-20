"use client"

import * as React from "react"
import { cn } from "../lib/utils"
import { Logo } from "../primitives/logo"

export interface SidebarNavItem {
  id: string
  label: string
  href: string
  icon: string
  badge?: string
}

export interface SidebarSandbox {
  id: string
  name: string
  label?: string
}

export interface AppSidebarProps {
  navItems: SidebarNavItem[]
  activeNavId?: string
  sandboxes?: SidebarSandbox[]
  activeSandboxId?: string
  onSandboxChange?: (id: string) => void
  onNewAgent?: () => void
  className?: string
  // biome-ignore lint/suspicious/noExplicitAny: Support various router Link components
  LinkComponent?: React.ComponentType<any>
}

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
    >
      {name}
    </span>
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

export function AppSidebar({
  navItems,
  activeNavId,
  sandboxes = [],
  activeSandboxId,
  onSandboxChange,
  onNewAgent,
  className,
  LinkComponent = DefaultLink,
}: AppSidebarProps) {
  const Link = LinkComponent
  const activeSandbox = sandboxes.find((s) => s.id === activeSandboxId) ?? sandboxes[0]

  return (
    <aside
      className={cn(
        "h-screen w-64 fixed left-0 top-0 flex flex-col py-6 bg-slate-800/40 z-40 pt-20",
        className,
      )}
    >
      {/* Sandbox selector */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center">
            <MaterialIcon name="terminal" className="text-on-primary-container text-sm" />
          </div>
          <div className="min-w-0">
            {activeSandbox ? (
              <>
                <div className="font-mono text-xs text-white font-bold tracking-tight truncate">
                  {activeSandbox.name}
                </div>
                {activeSandbox.label && (
                  <div className="font-mono text-[10px] text-slate-500 truncate">
                    {activeSandbox.label}
                  </div>
                )}
              </>
            ) : (
              <div className="font-mono text-xs text-slate-500">No sandbox selected</div>
            )}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = activeNavId === item.id
          return (
            <Link
              key={item.id}
              href={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-xs transition-colors",
                isActive
                  ? "bg-violet-500/10 text-violet-300 border-r-4 border-violet-500"
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-300",
              )}
            >
              <MaterialIcon name={item.icon} className="text-lg" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-primary-container text-on-primary text-[9px] font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-4 py-4 mt-auto space-y-1 border-t border-outline-variant/10">
        {onNewAgent && (
          <button
            type="button"
            onClick={onNewAgent}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-md3-primary to-primary-container text-on-primary font-bold py-2.5 rounded-lg mb-4 text-xs active:scale-95 duration-200 transition-transform"
          >
            <MaterialIcon name="add" className="text-sm" />
            New Agent
          </button>
        )}
        <Link
          href="/docs"
          to="/docs"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors font-mono text-xs"
        >
          <MaterialIcon name="menu_book" className="text-sm" />
          Documentation
        </Link>
        <Link
          href="/support"
          to="/support"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors font-mono text-xs"
        >
          <MaterialIcon name="contact_support" className="text-sm" />
          Support
        </Link>
      </div>
    </aside>
  )
}
