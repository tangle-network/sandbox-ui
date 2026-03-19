/**
 * WorkspaceLayout — reusable sandbox shell with desktop resizable panels and
 * mobile overlay drawers.
 *
 * Left: navigation / files / context
 * Center: chat, timeline, or primary workspace
 * Right: artifacts / previews / inspectors
 * Bottom: optional runtime panel
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";

const DESKTOP_BREAKPOINT = "(min-width: 1024px)";

interface WorkspaceLayoutStorage {
  leftOpen?: boolean;
  rightOpen?: boolean;
  bottomOpen?: boolean;
  leftWidth?: number;
  rightWidth?: number;
}

interface ResizeHandleProps {
  label: string;
  onDragStart: (clientX: number) => void;
  onStep: (delta: number) => void;
  className?: string;
}

export interface WorkspaceLayoutProps {
  /** Left sidebar content (file tree, navigation) */
  left?: ReactNode;
  /** Left sidebar header */
  leftHeader?: ReactNode;
  /** Center main content */
  center: ReactNode;
  /** Center header (session name, etc.) */
  centerHeader?: ReactNode;
  /** Center footer (input bar) */
  centerFooter?: ReactNode;
  /** Right panel content (preview, editor) */
  right?: ReactNode;
  /** Right panel header */
  rightHeader?: ReactNode;
  /** Bottom panel (terminal) */
  bottom?: ReactNode;
  /** Default left panel state */
  defaultLeftOpen?: boolean;
  /** Default right panel state */
  defaultRightOpen?: boolean;
  /** Default bottom panel state */
  defaultBottomOpen?: boolean;
  /** Default left panel width in px */
  defaultLeftWidth?: number;
  /** Default right panel width in px */
  defaultRightWidth?: number;
  /** Minimum left panel width in px */
  minLeftWidth?: number;
  /** Maximum left panel width in px */
  maxLeftWidth?: number;
  /** Minimum right panel width in px */
  minRightWidth?: number;
  /** Maximum right panel width in px */
  maxRightWidth?: number;
  /** Persist panel state and sizes in localStorage */
  persistenceKey?: string;
  /** Disable resize handles */
  resizable?: boolean;
  /** Visual theme for sandbox surfaces */
  theme?: "operator" | "builder" | "consumer";
  /** Density mode for control sizing */
  density?: "comfortable" | "compact";
  /** Accessible label for the left panel */
  leftLabel?: string;
  /** Accessible label for the right panel */
  rightLabel?: string;
  /** Accessible label for the bottom panel */
  bottomLabel?: string;
  className?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredLayout(key: string): WorkspaceLayoutStorage | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceLayoutStorage;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function useDesktopMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function ResizeHandle({ label, onDragStart, onStep, className }: ResizeHandleProps) {
  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onDragStart(event.clientX);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onStep(-24);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onStep(24);
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative hidden w-3 shrink-0 cursor-col-resize lg:flex",
        "items-stretch justify-center bg-transparent touch-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60",
        className,
      )}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border-subtle)] transition-colors" />
      <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-transparent hover:bg-[var(--brand-cool)]/30 focus-visible:bg-[var(--brand-cool)]/40" />
    </button>
  );
}

interface MobileDrawerProps {
  side: "left" | "right";
  title: string;
  header?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

function MobileDrawer({ side, title, header, onClose, children }: MobileDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex lg:hidden" aria-modal="true" role="dialog" aria-label={title}>
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <aside
        className={cn(
          "relative flex h-full w-[min(88vw,24rem)] flex-col border-[var(--border-default)] bg-[var(--bg-dark)] shadow-[var(--shadow-dropdown)]",
          side === "left" ? "border-r" : "ml-auto border-l",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="min-w-0 flex-1">{header ?? <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>}</div>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </aside>
    </div>
  );
}

export function WorkspaceLayout({
  left,
  leftHeader,
  center,
  centerHeader,
  centerFooter,
  right,
  rightHeader,
  bottom,
  defaultLeftOpen = true,
  defaultRightOpen = false,
  defaultBottomOpen = false,
  defaultLeftWidth = 280,
  defaultRightWidth = 480,
  minLeftWidth = 220,
  maxLeftWidth = 420,
  minRightWidth = 320,
  maxRightWidth = 720,
  persistenceKey,
  resizable = true,
  theme = "operator",
  density = "comfortable",
  leftLabel = "Left workspace panel",
  rightLabel = "Right workspace panel",
  bottomLabel = "Bottom runtime panel",
  className,
}: WorkspaceLayoutProps) {
  const desktop = useDesktopMediaQuery(DESKTOP_BREAKPOINT);
  const dragStateRef = useRef<{
    side: "left" | "right";
    pointerStartX: number;
    widthStart: number;
  } | null>(null);

  const storedLayout = useMemo(
    () => (persistenceKey ? readStoredLayout(persistenceKey) : null),
    [persistenceKey],
  );

  const [leftOpen, setLeftOpen] = useState(storedLayout?.leftOpen ?? defaultLeftOpen);
  const [rightOpen, setRightOpen] = useState(storedLayout?.rightOpen ?? defaultRightOpen);
  const [bottomOpen, setBottomOpen] = useState(storedLayout?.bottomOpen ?? defaultBottomOpen);
  const [leftWidth, setLeftWidth] = useState(
    clamp(storedLayout?.leftWidth ?? defaultLeftWidth, minLeftWidth, maxLeftWidth),
  );
  const [rightWidth, setRightWidth] = useState(
    clamp(storedLayout?.rightWidth ?? defaultRightWidth, minRightWidth, maxRightWidth),
  );

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") return;

    const payload: WorkspaceLayoutStorage = {
      leftOpen,
      rightOpen,
      bottomOpen,
      leftWidth,
      rightWidth,
    };

    window.localStorage.setItem(persistenceKey, JSON.stringify(payload));
  }, [bottomOpen, leftOpen, leftWidth, persistenceKey, rightOpen, rightWidth]);

  useEffect(() => {
    if (!desktop) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      if (dragState.side === "left") {
        const delta = event.clientX - dragState.pointerStartX;
        setLeftWidth(clamp(dragState.widthStart + delta, minLeftWidth, maxLeftWidth));
      } else {
        const delta = dragState.pointerStartX - event.clientX;
        setRightWidth(clamp(dragState.widthStart + delta, minRightWidth, maxRightWidth));
      }
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [desktop, maxLeftWidth, maxRightWidth, minLeftWidth, minRightWidth]);

  const leftStyle = useMemo<CSSProperties>(() => ({ width: `${leftWidth}px` }), [leftWidth]);
  const rightStyle = useMemo<CSSProperties>(() => ({ width: `${rightWidth}px` }), [rightWidth]);

  const startResize = (side: "left" | "right", pointerStartX: number) => {
    dragStateRef.current = {
      side,
      pointerStartX,
      widthStart: side === "left" ? leftWidth : rightWidth,
    };
  };

  const stepLeftWidth = (delta: number) => {
    setLeftWidth((current) => clamp(current + delta, minLeftWidth, maxLeftWidth));
  };

  const stepRightWidth = (delta: number) => {
    setRightWidth((current) => clamp(current + delta, minRightWidth, maxRightWidth));
  };

  return (
    <div
      data-sandbox-ui="true"
      data-sandbox-theme={theme}
      data-density={density}
      className={cn(
        "flex h-screen flex-col overflow-hidden bg-[var(--bg-root)] text-[var(--text-primary)] font-[var(--font-sans)]",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1">
        {desktop && left && leftOpen && (
          <>
            <aside
              aria-label={leftLabel}
              style={leftStyle}
              className="hidden shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-dark)] lg:flex lg:flex-col"
            >
              {leftHeader && (
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                  <div className="min-w-0 flex-1">{leftHeader}</div>
                  <button
                    type="button"
                    aria-label="Collapse left panel"
                    onClick={() => setLeftOpen(false)}
                    className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto py-1">{left}</div>
            </aside>
            {resizable && (
              <ResizeHandle
                label="Resize left panel"
                onDragStart={(clientX) => startResize("left", clientX)}
                onStep={stepLeftWidth}
              />
            )}
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {(centerHeader || left || right || bottom) && (
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-dark)] px-3 py-2">
              {left && !leftOpen && (
                <button
                  type="button"
                  aria-label="Open left panel"
                  onClick={() => setLeftOpen(true)}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0 flex-1">{centerHeader}</div>
              {bottom && !bottomOpen && (
                <button
                  type="button"
                  aria-label="Open bottom panel"
                  onClick={() => setBottomOpen(true)}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
                >
                  <PanelBottomOpen className="h-4 w-4" />
                </button>
              )}
              {right && !rightOpen && (
                <button
                  type="button"
                  aria-label="Open right panel"
                  onClick={() => setRightOpen(true)}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">{center}</div>

          {bottom && bottomOpen && (
            <section
              aria-label={bottomLabel}
              className="border-t border-[var(--border-subtle)] bg-[var(--bg-card)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Runtime
                </span>
                <button
                  type="button"
                  aria-label="Collapse bottom panel"
                  onClick={() => setBottomOpen(false)}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
                >
                  <PanelBottomClose className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-56 overflow-auto">{bottom}</div>
            </section>
          )}

          {centerFooter && (
            <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-dark)]">
              {centerFooter}
            </div>
          )}
        </main>

        {desktop && right && rightOpen && (
          <>
            {resizable && (
              <ResizeHandle
                label="Resize right panel"
                onDragStart={(clientX) => startResize("right", clientX)}
                onStep={stepRightWidth}
              />
            )}
            <aside
              aria-label={rightLabel}
              style={rightStyle}
              className="hidden shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-dark)] lg:flex lg:flex-col"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                <div className="min-w-0 flex-1">
                  {rightHeader ?? <span className="text-sm font-semibold text-[var(--text-primary)]">Artifacts</span>}
                </div>
                <button
                  type="button"
                  aria-label="Collapse right panel"
                  onClick={() => setRightOpen(false)}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">{right}</div>
            </aside>
          </>
        )}
      </div>

      {!desktop && left && leftOpen && (
        <MobileDrawer
          side="left"
          title={leftLabel}
          header={leftHeader}
          onClose={() => setLeftOpen(false)}
        >
          {left}
        </MobileDrawer>
      )}

      {!desktop && right && rightOpen && (
        <MobileDrawer
          side="right"
          title={rightLabel}
          header={rightHeader}
          onClose={() => setRightOpen(false)}
        >
          {right}
        </MobileDrawer>
      )}
    </div>
  );
}
