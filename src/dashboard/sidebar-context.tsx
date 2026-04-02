"use client"

import * as React from "react"

const PANEL_OPEN_KEY = "sandbox-sidebar-panel-open"
const SIDEBAR_MODE_KEY = "sandbox-sidebar-mode"

/** Width constants (px) matching blueprint-agent layout */
export const SIDEBAR_RAIL_WIDTH = 64
export const SIDEBAR_PANEL_WIDTH = 260
export const SIDEBAR_TOTAL_WIDTH = SIDEBAR_RAIL_WIDTH + SIDEBAR_PANEL_WIDTH

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

export interface SidebarProviderProps {
  defaultPanelOpen?: boolean
  defaultMode?: string
  hasPanels?: boolean
  children: React.ReactNode
}

export function SidebarProvider({
  defaultPanelOpen = true,
  defaultMode = "projects",
  hasPanels = true,
  children,
}: SidebarProviderProps) {
  const [panelOpen, setPanelOpenState] = React.useState(
    () => readStorage(PANEL_OPEN_KEY, String(defaultPanelOpen)) === "true",
  )
  const [mode, setModeState] = React.useState(
    () => readStorage(SIDEBAR_MODE_KEY, defaultMode),
  )
  const [hidden, setHidden] = React.useState(false)

  const setPanelOpen = React.useCallback((open: boolean) => {
    setPanelOpenState(open)
    localStorage.setItem(PANEL_OPEN_KEY, String(open))
  }, [])

  const togglePanel = React.useCallback(() => {
    setPanelOpenState((prev) => {
      const next = !prev
      localStorage.setItem(PANEL_OPEN_KEY, String(next))
      return next
    })
  }, [])

  const setMode = React.useCallback((m: string) => {
    setModeState(m)
    localStorage.setItem(SIDEBAR_MODE_KEY, m)
  }, [])

  const switchModeStable = React.useCallback((m: string) => {
    setModeState((prevMode) => {
      setPanelOpenState((prevOpen) => {
        const shouldClose = prevOpen && prevMode === m
        localStorage.setItem(PANEL_OPEN_KEY, String(!shouldClose))
        return !shouldClose
      })
      if (prevMode !== m) {
        localStorage.setItem(SIDEBAR_MODE_KEY, m)
        return m
      }
      return prevMode
    })
  }, [])

  const contentMargin = hidden ? 0 : (panelOpen && hasPanels) ? SIDEBAR_TOTAL_WIDTH : SIDEBAR_RAIL_WIDTH

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      panelOpen,
      setPanelOpen,
      togglePanel,
      mode,
      setMode,
      switchMode: switchModeStable,
      hidden,
      setHidden,
      contentMargin,
      hasPanels,
    }),
    [panelOpen, setPanelOpen, togglePanel, mode, setMode, switchModeStable, hidden, setHidden, contentMargin, hasPanels],
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
