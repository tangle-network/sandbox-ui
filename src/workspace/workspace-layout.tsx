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
  useCallback,
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
import { WorkspacePaneHeader } from "./workspace-pane-header";

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
  theme?: "vault";
  /** Density mode for control sizing */
  density?: "comfortable" | "compact";
  /** Accessible label for the left panel */
  leftLabel?: string;
  /** Accessible label for the right panel */
  rightLabel?: string;
  /** Accessible label for the bottom panel */
  bottomLabel?: string;
  /**
   * Controlled open state for the left pane. Omit to keep the pane
   * uncontrolled (`defaultLeftOpen`, persisted under `persistenceKey`).
   */
  leftOpen?: boolean;
  /** Called with the next state whenever the layout would open or close the left pane. */
  onLeftOpenChange?: (open: boolean) => void;
  /** Controlled open state for the right pane; see `leftOpen`. */
  rightOpen?: boolean;
  /** Called with the next state whenever the layout would open or close the right pane. */
  onRightOpenChange?: (open: boolean) => void;
  /**
   * ⌘B / Ctrl+B toggles the left pane and ⌘E / Ctrl+E the right pane. A
   * chord with Alt or Shift, or one fired while an input, textarea, select, or
   * contentEditable has focus, is left to the page. Off by default.
   */
  keyboardShortcuts?: boolean;
  /**
   * Replaces the default "Open left panel" button at the top-left of the
   * center pane while a left pane is provided but closed.
   */
  leftCollapsedControl?: ReactNode;
  /** Extra classes for the left pane's scrolling content wrapper, e.g. `py-0` so a rail owns its own gutter. */
  leftContentClassName?: string;
  /** Extra classes for the right pane's scrolling content wrapper. */
  rightContentClassName?: string;
  /**
   * `always` (default) keeps the center header row whenever a side or bottom
   * pane exists, so pane headers line up across the shell even while the row
   * is empty. `auto` renders the row only while it has content: a
   * `centerHeader`, or an open-pane toggle for a closed pane.
   */
  centerHeaderVisibility?: "always" | "auto";
  className?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * True while a keystroke belongs to a text field. `isContentEditable` is
 * missing from jsdom, so the attribute is checked too — through `closest`,
 * because the target inside an editable region is usually a descendant.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const editable = target.closest("[contenteditable]");
  return editable !== null && editable.getAttribute("contenteditable") !== "false";
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
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--md3-outline-variant)] transition-colors" />
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
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--md3-outline-variant)] transition-colors" />
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
          "relative flex h-full w-[min(88vw,24rem)] flex-col border-[var(--md3-outline-variant)] bg-surface-container-highest shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
          side === "left" ? "border-r" : "ml-auto border-l",
        )}
      >
        <WorkspacePaneHeader className="justify-between gap-3">
          <div className="min-w-0 flex-1">{header ?? <span className="text-[13px] font-medium text-foreground">{title}</span>}</div>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          >
            <X className="h-4 w-4" />
          </button>
        </WorkspacePaneHeader>
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
  leftOpen: leftOpenProp,
  onLeftOpenChange,
  rightOpen: rightOpenProp,
  onRightOpenChange,
  keyboardShortcuts = false,
  leftCollapsedControl,
  leftContentClassName,
  rightContentClassName,
  centerHeaderVisibility = "always",
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

  const [uncontrolledLeftOpen, setUncontrolledLeftOpen] = useState(storedLayout?.leftOpen ?? defaultLeftOpen);
  const [uncontrolledRightOpen, setUncontrolledRightOpen] = useState(storedLayout?.rightOpen ?? defaultRightOpen);
  // A controlled pane reads the prop and only reports; the uncontrolled one
  // keeps its own state. Both notify, so a consumer can mirror without owning.
  const leftControlled = leftOpenProp !== undefined;
  const rightControlled = rightOpenProp !== undefined;
  const leftOpen = leftControlled ? leftOpenProp : uncontrolledLeftOpen;
  const rightOpen = rightControlled ? rightOpenProp : uncontrolledRightOpen;
  const setLeftOpen = useCallback(
    (open: boolean) => {
      if (!leftControlled) setUncontrolledLeftOpen(open);
      onLeftOpenChange?.(open);
    },
    [leftControlled, onLeftOpenChange],
  );
  const setRightOpen = useCallback(
    (open: boolean) => {
      if (!rightControlled) setUncontrolledRightOpen(open);
      onRightOpenChange?.(open);
    },
    [rightControlled, onRightOpenChange],
  );
  const hasLeft = Boolean(left);
  const hasRight = Boolean(right);
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
  const centerHeaderHasContent =
    Boolean(centerHeader) || (hasLeft && !leftOpen) || (hasRight && !rightOpen) || (Boolean(bottom) && !bottomOpen);
  const showCenterHeader =
    centerHeaderVisibility === "auto"
      ? centerHeaderHasContent
      : Boolean(centerHeader || left || right || bottom);

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
    if (!keyboardShortcuts || typeof window === "undefined") return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "b" && hasLeft) {
        event.preventDefault();
        setLeftOpen(!leftOpen);
      } else if (key === "e" && hasRight) {
        event.preventDefault();
        setRightOpen(!rightOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasLeft, hasRight, keyboardShortcuts, leftOpen, rightOpen, setLeftOpen, setRightOpen]);

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
              className="hidden shrink-0 border-r border-[var(--md3-outline-variant)] bg-surface-container-low lg:flex lg:flex-col"
            >
              {leftHeader && (
                <WorkspacePaneHeader className="justify-between gap-2">
                  <div className="min-w-0 flex-1">{leftHeader}</div>
                  <button
                    type="button"
                    aria-label="Collapse left panel"
                    onClick={() => setLeftOpen(false)}
                    className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </WorkspacePaneHeader>
              )}
              <div className={cn("min-h-0 flex-1 overflow-auto py-1", leftContentClassName)}>{left}</div>
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
          {showCenterHeader && (
            <WorkspacePaneHeader className="gap-2">
              {left && !leftOpen && (
                leftCollapsedControl ?? (
                  <button
                    type="button"
                    aria-label="Open left panel"
                    onClick={() => setLeftOpen(true)}
                    className="rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                )
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
            </WorkspacePaneHeader>
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
                className="border-t border-[var(--md3-outline-variant)] bg-surface-container shrink-0"
                style={{ height: `${bottomHeight}px` }}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--md3-outline-variant)] px-3 py-1.5 bg-surface-container-high shrink-0">
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
            <div className="shrink-0 border-t border-[var(--md3-outline-variant)] bg-surface-container-low">
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
              className="hidden shrink-0 border-l border-[var(--md3-outline-variant)] bg-surface-container-low lg:flex lg:flex-col"
            >
              <WorkspacePaneHeader className="justify-between gap-2">
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
              </WorkspacePaneHeader>
              <div className={cn("min-h-0 flex-1 overflow-auto", rightContentClassName)}>{right}</div>
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
