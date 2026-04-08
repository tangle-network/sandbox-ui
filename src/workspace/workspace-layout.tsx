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
  bottomHeight?: number;
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
  /** Bottom panel header */
  bottomHeader?: ReactNode;
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
  /** Default bottom panel height in px */
  defaultBottomHeight?: number;
  /** Minimum left panel width in px */
  minLeftWidth?: number;
  /** Maximum left panel width in px */
  maxLeftWidth?: number;
  /** Minimum right panel width in px */
  minRightWidth?: number;
  /** Maximum right panel width in px */
  maxRightWidth?: number;
  /** Minimum bottom panel height in px */
  minBottomHeight?: number;
  /** Maximum bottom panel height in px */
  maxBottomHeight?: number;
  /** Persist panel state and sizes in localStorage */
  persistenceKey?: string;
  /** Disable resize handles */
  resizable?: boolean;
  /** Visual theme for sandbox surfaces */
  theme?: "vault" | "ocean" | "ember" | "forest" | "dawn";
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors" />
      <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-transparent hover:bg-primary/30 focus-visible:bg-primary/40" />
    </button>
  );
}

interface HorizontalResizeHandleProps {
  label: string;
  onDragStart: (clientY: number) => void;
  onStep: (delta: number) => void;
  className?: string;
}

function HorizontalResizeHandle({ label, onDragStart, onStep, className }: HorizontalResizeHandleProps) {
  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onDragStart(event.clientY);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onStep(24);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onStep(-24);
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      role="separator"
      aria-orientation="horizontal"
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative hidden h-3 shrink-0 cursor-row-resize lg:flex",
        "items-center justify-center bg-transparent touch-none w-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
    >
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border transition-colors" />
      <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-transparent hover:bg-primary/30 focus-visible:bg-primary/40" />
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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <aside
        className={cn(
          "relative flex h-full w-[min(88vw,24rem)] flex-col border-border bg-background shadow-[var(--shadow-dropdown)]",
          side === "left" ? "border-r" : "ml-auto border-l",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <div className="min-w-0 flex-1">{header ?? <span className="text-[13px] font-medium text-foreground">{title}</span>}</div>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
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
  bottomHeader,
  defaultLeftOpen = true,
  defaultRightOpen = false,
  defaultBottomOpen = false,
  defaultLeftWidth = 280,
  defaultRightWidth = 480,
  defaultBottomHeight = 224,
  minLeftWidth = 220,
  maxLeftWidth = 420,
  minRightWidth = 320,
  maxRightWidth = 720,
  minBottomHeight = 100,
  maxBottomHeight = 500,
  persistenceKey,
  resizable = true,
  theme,
  density = "comfortable",
  leftLabel = "Left workspace panel",
  rightLabel = "Right workspace panel",
  bottomLabel = "Bottom runtime panel",
  className,
}: WorkspaceLayoutProps) {
  const desktop = useDesktopMediaQuery(DESKTOP_BREAKPOINT);
  const dragStateRef = useRef<{
    side: "left" | "right" | "bottom";
    pointerStartX: number;
    pointerStartY: number;
    widthStart: number;
    heightStart: number;
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
  const [bottomHeight, setBottomHeight] = useState(
    clamp(storedLayout?.bottomHeight ?? defaultBottomHeight, minBottomHeight, maxBottomHeight),
  );

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") return;

    const payload: WorkspaceLayoutStorage = {
      leftOpen,
      rightOpen,
      bottomOpen,
      leftWidth,
      rightWidth,
      bottomHeight,
    };

    window.localStorage.setItem(persistenceKey, JSON.stringify(payload));
  }, [bottomHeight, bottomOpen, leftOpen, leftWidth, persistenceKey, rightOpen, rightWidth]);

  useEffect(() => {
    if (!desktop) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      if (dragState.side === "bottom") {
        const delta = dragState.pointerStartY - event.clientY;
        setBottomHeight(clamp(dragState.heightStart + delta, minBottomHeight, maxBottomHeight));
      } else if (dragState.side === "left") {
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
  }, [desktop, maxBottomHeight, maxLeftWidth, maxRightWidth, minBottomHeight, minLeftWidth, minRightWidth]);

  const leftStyle = useMemo<CSSProperties>(() => ({ width: `${leftWidth}px` }), [leftWidth]);
  const rightStyle = useMemo<CSSProperties>(() => ({ width: `${rightWidth}px` }), [rightWidth]);

  const startResize = (side: "left" | "right", pointerStartX: number) => {
    dragStateRef.current = {
      side,
      pointerStartX,
      pointerStartY: 0,
      widthStart: side === "left" ? leftWidth : rightWidth,
      heightStart: 0,
    };
  };

  const startBottomResize = (pointerStartY: number) => {
    dragStateRef.current = {
      side: "bottom",
      pointerStartX: 0,
      pointerStartY,
      widthStart: 0,
      heightStart: bottomHeight,
    };
  };

  const stepLeftWidth = (delta: number) => {
    setLeftWidth((current) => clamp(current + delta, minLeftWidth, maxLeftWidth));
  };

  const stepRightWidth = (delta: number) => {
    setRightWidth((current) => clamp(current + delta, minRightWidth, maxRightWidth));
  };

  const stepBottomHeight = (delta: number) => {
    setBottomHeight((current) => clamp(current + delta, minBottomHeight, maxBottomHeight));
  };

  return (
    <div
      {...(theme ? { "data-sandbox-ui": "true", "data-sandbox-theme": theme } : {})}
      data-density={density}
      className={cn(
        "flex h-screen flex-col overflow-hidden bg-[var(--bg-root)] text-foreground font-sans",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1">
        {desktop && left && leftOpen && (
          <>
            <aside
              aria-label={leftLabel}
              style={leftStyle}
              className="hidden shrink-0 border-r border-border bg-background lg:flex lg:flex-col"
            >
              {leftHeader && (
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 bg-muted/20">
                  <div className="min-w-0 flex-1">{leftHeader}</div>
                  <button
                    type="button"
                    aria-label="Collapse left panel"
                    onClick={() => setLeftOpen(false)}
                    className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
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
            <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-1.5">
              {left && !leftOpen && (
                <button
                  type="button"
                  aria-label="Open left panel"
                  onClick={() => setLeftOpen(true)}
                  className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
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
                  className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                >
                  <PanelBottomOpen className="h-4 w-4" />
                </button>
              )}
              {right && !rightOpen && (
                <button
                  type="button"
                  aria-label="Open right panel"
                  onClick={() => setRightOpen(true)}
                  className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">{center}</div>

          {bottom && bottomOpen && (
            <>
              {resizable && (
                <HorizontalResizeHandle
                  label="Resize bottom panel"
                  onDragStart={startBottomResize}
                  onStep={stepBottomHeight}
                />
              )}
              <section
                aria-label={bottomLabel}
                className="border-t border-border bg-card shrink-0"
                style={{ height: `${bottomHeight}px` }}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 bg-muted/20 shrink-0">
                    <div className="min-w-0 flex-1">
                      {bottomHeader ?? (
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Runtime
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Collapse bottom panel"
                      onClick={() => setBottomOpen(false)}
                      className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                    >
                      <PanelBottomClose className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">{bottom}</div>
                </div>
              </section>
            </>
          )}

          {centerFooter && (
            <div className="shrink-0 border-t border-border bg-background">
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
              className="hidden shrink-0 border-l border-border bg-background lg:flex lg:flex-col"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 bg-muted/20">
                <div className="min-w-0 flex-1">
                  {rightHeader ?? <span className="text-[13px] font-medium text-foreground">Artifacts</span>}
                </div>
                <button
                  type="button"
                  aria-label="Collapse right panel"
                  onClick={() => setRightOpen(false)}
                  className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
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
