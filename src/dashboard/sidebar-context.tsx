"use client"

import * as React from "react"

const PANEL_OPEN_KEY = "sandbox-sidebar-panel-open"
const SIDEBAR_MODE_KEY = "sandbox-sidebar-mode"

/** Width constants (px) — Tangle Quiet density (ChatGPT-minimal) */
export const SIDEBAR_RAIL_WIDTH = 56
export const SIDEBAR_PANEL_WIDTH = 268
export const SIDEBAR_TOTAL_WIDTH = SIDEBAR_RAIL_WIDTH + SIDEBAR_PANEL_WIDTH
/**
 * Width of the mobile drawer when the rail is rendered with labels
 * (`showLabel` on {@link RailButton}). The standard 64px rail is only
 * wide enough for icons; labels need a wider container to avoid truncation.
 */
export const SIDEBAR_MOBILE_WIDTH = 256
/**
 * Rail width when labels are shown beside icons on desktop. The default rail is
 * icon-only at {@link SIDEBAR_RAIL_WIDTH}; a labeled rail needs room for the
 * longest nav label plus its badge.
 */
export const SIDEBAR_RAIL_LABELED_WIDTH = 248

interface SidebarContextValue {
  /** Whether the content panel beside the rail is open */
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  /** Current panel mode (app-defined, e.g. "projects", "batches") */
  mode: string
  setMode: (mode: string) => void
  /** Switch mode — opens panel if closed, closes if same mode clicked */
  switchMode: (mode: string) => void
  /** Whether entire sidebar (rail + panel) is hidden (focus mode) */
  hidden: boolean
  setHidden: (hidden: boolean) => void
  /** Computed content margin in px */
  contentMargin: number
  /** Whether there are panels at all */
  hasPanels: boolean
  /** Rail width in px — 64 for the icon-only rail, wider when labels show */
  railWidth: number
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function readStorage(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(key, value) } catch { /* quota/private browsing */ }
}

export interface SidebarProviderProps {
  defaultPanelOpen?: boolean
  defaultMode?: string
  hasPanels?: boolean
  /** Rail width in px. Defaults to the 64px icon-only rail. */
  railWidth?: number
  /**
   * Controlled panel-open state. When provided, the provider treats panel
   * visibility as controlled: it never reads or writes localStorage and
   * reports changes through {@link onPanelOpenChange} instead. Use this in
   * server-rendered apps — seed it from a value the server also has (e.g. a
   * cookie) so the SSR markup matches the first client render. The localStorage
   * read in the uncontrolled path is what diverges from SSR and breaks hydration.
   */
  panelOpen?: boolean
  onPanelOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function SidebarProvider({
  defaultPanelOpen = true,
  defaultMode = "projects",
  hasPanels = true,
  railWidth = SIDEBAR_RAIL_WIDTH,
  panelOpen: controlledPanelOpen,
  onPanelOpenChange,
  children,
}: SidebarProviderProps) {
  const isControlled = controlledPanelOpen !== undefined

  // Uncontrolled keeps the original SPA behaviour (persist to localStorage).
  // Controlled never touches localStorage — the consumer owns persistence.
  const [uncontrolledPanelOpen, setUncontrolledPanelOpen] = React.useState(
    () => isControlled
      ? (controlledPanelOpen as boolean)
      : readStorage(PANEL_OPEN_KEY, String(defaultPanelOpen)) === "true",
  )
  const panelOpen = isControlled ? (controlledPanelOpen as boolean) : uncontrolledPanelOpen

  const [mode, setModeState] = React.useState(
    () => isControlled ? defaultMode : readStorage(SIDEBAR_MODE_KEY, defaultMode),
  )
  const [hidden, setHidden] = React.useState(false)

  const setPanelOpen = React.useCallback((open: boolean) => {
    if (!isControlled) {
      setUncontrolledPanelOpen(open)
      writeStorage(PANEL_OPEN_KEY, String(open))
    }
    onPanelOpenChange?.(open)
  }, [isControlled, onPanelOpenChange])

  const togglePanel = React.useCallback(() => {
    setPanelOpen(!panelOpen)
  }, [setPanelOpen, panelOpen])

  const setMode = React.useCallback((m: string) => {
    setModeState(m)
    if (!isControlled) writeStorage(SIDEBAR_MODE_KEY, m)
  }, [isControlled])

  // Open the given mode, or toggle the panel when the active mode is
  // re-selected. State is read from the current render (no nested setState),
  // so React's eager-bailout can't invoke a nested updater twice and cancel
  // the toggle.
  const switchMode = React.useCallback((m: string) => {
    if (mode === m) {
      setPanelOpen(!panelOpen)
      return
    }
    setModeState(m)
    if (!isControlled) writeStorage(SIDEBAR_MODE_KEY, m)
    setPanelOpen(true)
  }, [mode, panelOpen, isControlled, setPanelOpen])

  const contentMargin = hidden ? 0 : (panelOpen && hasPanels) ? (railWidth + SIDEBAR_PANEL_WIDTH) : railWidth

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      panelOpen,
      setPanelOpen,
      togglePanel,
      mode,
      setMode,
      switchMode,
      hidden,
      setHidden,
      contentMargin,
      hasPanels,
      railWidth,
    }),
    [panelOpen, setPanelOpen, togglePanel, mode, setMode, switchMode, hidden, setHidden, contentMargin, hasPanels, railWidth],
  )

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider")
  return ctx
}
