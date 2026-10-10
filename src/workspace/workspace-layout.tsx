/**
 * WorkspaceLayout — reusable sandbox shell with desktop resizable panels and
 * mobile overlay drawers.
 *
 * Left: navigation / files / context
 * Center: chat, timeline, or primary workspace
 * Right: artifacts / previews / inspectors
 * Bottom: optional runtime panel
 */

import { type CSSProperties, type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
import { ShellHeader } from "./shell-header";
import { focusRing } from "@tangle-network/ui/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@tangle-network/ui/primitives";

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
  /**
   * Width in px the center column keeps on desktop. When the shell is too
   * narrow for the stored pane widths, the right pane yields down to its
   * minimum first, then the left; the stored widths return when room does.
   */
  minCenterWidth?: number;
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
   * `auto` (default) reserves the center row only for `centerHeader`.
   * Closed panes get narrow edge controls beside the content instead of a
   * full-width row. `always` aligns every pane to the 56px header row.
   */
  centerHeaderVisibility?: "always" | "auto";
  /** Retain visited right content across closure and desktop/mobile relocation. */
  keepRightMounted?: boolean;
  /** Closed controls use edge columns by default; overlay preserves center width. */
  collapsedControlsPlacement?: "edge" | "overlay";
  /**
   * `flat` (default) fills the shell edge to edge. `inset` raises the center
   * and right panes as one surface on the recessed backdrop, inside an even
   * gutter on every side. The center always has a header row: closed-pane
   * controls sit flat in it, an open right pane shares its height and a
   * divider, and a closed pane leaves nothing at the shell's edge.
   * `collapsedControlsPlacement` and `centerHeaderVisibility` do not apply.
   */
  surface?: "flat" | "inset";
  /** Accessible name and tooltip of the control that opens the right pane. */
  rightOpenLabel?: string;
  /** Accessible name and tooltip of the control that closes the right pane. */
  rightCloseLabel?: string;
  /** Second tooltip line for both right-pane controls, such as the tools the pane holds. */
  rightControlHint?: string;
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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

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
        "group relative z-10 hidden w-px shrink-0 cursor-col-resize overflow-visible bg-transparent p-0 touch-none lg:flex",
        focusRing,
        className,
      )}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 z-10 w-[9px] -translate-x-1/2 cursor-col-resize bg-transparent" />
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/20 group-focus-visible:bg-primary/30" />
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
        "group relative z-10 hidden h-px w-full shrink-0 cursor-row-resize overflow-visible bg-transparent p-0 touch-none lg:flex",
        focusRing,
        className,
      )}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 z-10 h-[9px] w-full -translate-y-1/2 cursor-row-resize bg-transparent" />
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border transition-colors group-hover:bg-primary/20 group-focus-visible:bg-primary/30" />
    </button>
  );
}

interface MobileDrawerProps {
  side: "left" | "right";
  title: string;
  header?: ReactNode;
  onClose: () => void;
  onReturnFocus: () => void;
  theme?: string;
  density: "comfortable" | "compact";
  children: ReactNode;
}

function PaneControlTooltip({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block opacity-80">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function MobileDrawer({ side, title, header, onClose, onReturnFocus, theme, density, children }: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden" />
        <DialogPrimitive.Content
          {...(theme ? { "data-sandbox-ui": "true", "data-sandbox-theme": theme } : {})}
          data-density={density}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(onReturnFocus);
          }}
          className={cn(
            "fixed inset-y-0 z-50 flex h-full w-[min(88vw,24rem)] flex-col border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.18)] lg:hidden",
            side === "left" ? "left-0 border-r" : "right-0 border-l",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <ShellHeader className="justify-between gap-3">
            <div className="min-w-0 flex-1">{header ?? <span className="text-[13px] font-medium text-foreground">{title}</span>}</div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label={`Close ${title}`}
                className={`rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focusRing}`}
              >
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </ShellHeader>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
  minCenterWidth = 400,
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
  keepRightMounted = false,
  collapsedControlsPlacement = "edge",
  centerHeaderVisibility = "auto",
  surface = "flat",
  rightOpenLabel = "Open right panel",
  rightCloseLabel = "Collapse right panel",
  rightControlHint,
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
  const [rightVisited, setRightVisited] = useState(false);
  const rightParkingRef = useRef<HTMLDivElement>(null);
  const rightHost = useMemo(() => {
    if (!keepRightMounted || typeof document === "undefined") return null;
    const host = document.createElement("div");
    host.className = "flex h-full min-h-0 min-w-0 flex-col";
    return host;
  }, [keepRightMounted]);
  useEffect(() => {
    if (keepRightMounted && rightOpen && hasRight) setRightVisited(true);
  }, [keepRightMounted, rightOpen, hasRight]);
  // The portal target stays stable. Moving its host preserves terminals and
  // editors when the visible pane becomes a drawer or parks while closed.
  const mountRightHost = useCallback((node: HTMLDivElement | null) => {
    if (!rightHost) return;
    const destination = node ?? rightParkingRef.current;
    if (destination) destination.appendChild(rightHost);
  }, [rightHost]);
  const rightContent = keepRightMounted
    ? <div ref={mountRightHost} className="flex h-full min-h-0 min-w-0 flex-1 flex-col" />
    : right;

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
  const inset = surface === "inset";
  const showCenterHeader =
    inset ||
    (centerHeaderVisibility === "auto"
      ? Boolean(centerHeader)
      : Boolean(centerHeader || left || right || bottom));
  // Inset headers carry their controls as flat 32px icon buttons, so the
  // center's expander and the right pane's collapse land on the same spot.
  const paneControlClassName = inset
    ? `inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focusRing}`
    : `rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focusRing}`;
  const reopenClassName = showCenterHeader
    ? paneControlClassName
    : `flex h-10 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground ${focusRing}`;
  const leftReopenControl = left && !leftOpen
    ? leftCollapsedControl ?? (
        <button type="button" aria-label="Open left panel" onClick={() => setLeftOpen(true)} className={reopenClassName}>
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )
    : null;
  const bottomReopenControl = bottom && !bottomOpen ? (
    <button type="button" aria-label="Open bottom panel" onClick={() => setBottomOpen(true)} className={reopenClassName}>
      <PanelBottomOpen className="h-4 w-4" />
    </button>
  ) : null;
  const rightReopenControl = right && !rightOpen ? (
    <PaneControlTooltip label={rightOpenLabel} hint={rightControlHint}>
      <button type="button" aria-label={rightOpenLabel} aria-expanded={false} onClick={() => setRightOpen(true)} className={reopenClassName}>
        <PanelRightOpen className="h-4 w-4" />
      </button>
    </PaneControlTooltip>
  ) : null;
  const leftReopenRef = useRef<HTMLDivElement | null>(null);
  const rightReopenRef = useRef<HTMLDivElement | null>(null);

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

    try {
      window.localStorage.setItem(persistenceKey, JSON.stringify(payload));
    } catch {
      // Pane controls remain usable when browser storage is unavailable.
    }
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

  // The shell's width decides how much of the stored pane widths fits. Only
  // the rendered widths shrink; the stored values stay for a wider window.
  const shellRef = useRef<HTMLDivElement | null>(null);
  const focusSideControl = (side: "left" | "right") => {
    const reopen = (side === "left" ? leftReopenRef : rightReopenRef).current;
    const target = reopen?.querySelector<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
    if (target) {
      target.focus();
      return;
    }
    shellRef.current?.querySelector<HTMLElement>(`[data-pane-collapse="${side}"]`)?.focus();
  };
  const [shellWidth, setShellWidth] = useState<number | null>(null);
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === "number") setShellWidth(width);
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);
  const { leftPx, rightPx } = useMemo(() => {
    const leftShown = desktop && hasLeft && leftOpen;
    const rightShown = desktop && hasRight && rightOpen;
    let leftPx = leftWidth;
    let rightPx = rightWidth;
    if (shellWidth === null) return { leftPx, rightPx };
    const room = () => shellWidth - (leftShown ? leftPx : 0) - (rightShown ? rightPx : 0);
    if (rightShown && room() < minCenterWidth) {
      rightPx = Math.max(minRightWidth, rightPx - (minCenterWidth - room()));
    }
    if (leftShown && room() < minCenterWidth) {
      leftPx = Math.max(minLeftWidth, leftPx - (minCenterWidth - room()));
    }
    return { leftPx, rightPx };
  }, [desktop, hasLeft, hasRight, leftOpen, leftWidth, minCenterWidth, minLeftWidth, minRightWidth, rightOpen, rightWidth, shellWidth]);
  const leftStyle = useMemo<CSSProperties>(() => ({ width: `${leftPx}px` }), [leftPx]);
  const rightStyle = useMemo<CSSProperties>(() => ({ width: `${rightPx}px` }), [rightPx]);

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

  const centerPane = (
    <main className="relative flex min-w-0 flex-1 flex-col">
      {showCenterHeader && (
        <ShellHeader inset={inset} data-workspace-header="center" className={cn("gap-2", inset && "gap-1")}>
          {leftReopenControl && <div ref={leftReopenRef} className="shrink-0">{leftReopenControl}</div>}
          <div className="min-w-0 flex-1">{centerHeader}</div>
          {bottomReopenControl}
          {rightReopenControl && <div ref={rightReopenRef} className="shrink-0">{rightReopenControl}</div>}
        </ShellHeader>
      )}

      <div className="relative flex min-h-0 flex-1">
        {!showCenterHeader && leftReopenControl && (
          <div ref={leftReopenRef} className={cn("shrink-0 pt-2", collapsedControlsPlacement === "overlay" && "absolute left-2 top-2 z-20 pt-0")}>{leftReopenControl}</div>
        )}
        <div className="min-w-0 flex-1 overflow-auto">{center}</div>
        {!showCenterHeader && (bottomReopenControl || rightReopenControl) && (
          <div className={cn("flex shrink-0 flex-col gap-1 pt-2", collapsedControlsPlacement === "overlay" && "absolute right-2 top-2 z-20 pt-0")}>
            {bottomReopenControl}
            {rightReopenControl && <div ref={rightReopenRef}>{rightReopenControl}</div>}
          </div>
        )}
      </div>

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
            className={cn(
              "shrink-0 bg-card",
              !resizable && "border-t border-border",
            )}
            style={{ height: `${bottomHeight}px` }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-1.5 shrink-0">
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
                  className={`rounded-[2px] p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focusRing}`}
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
        <div className="shrink-0 border-t border-border bg-card">
          {centerFooter}
        </div>
      )}
    </main>
  );

  const rightPane = desktop && right && rightOpen && (
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
        data-workspace-pane="right"
        style={rightStyle}
        className={cn(
          "hidden shrink-0 lg:flex lg:flex-col",
          inset ? "bg-transparent" : "bg-card",
          !resizable && "border-l border-border",
        )}
      >
        <ShellHeader inset={inset} className="justify-between gap-2">
          <div className="min-w-0 flex-1">
            {rightHeader ?? <span className="text-[13px] font-medium text-foreground">Artifacts</span>}
          </div>
          <PaneControlTooltip label={rightCloseLabel} hint={rightControlHint}>
            <button
              type="button"
              aria-label={rightCloseLabel}
              aria-expanded
              data-pane-collapse="right"
              onClick={() => {
                setRightOpen(false);
                requestAnimationFrame(() => focusSideControl("right"));
              }}
              className={paneControlClassName}
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </PaneControlTooltip>
        </ShellHeader>
        <div className={cn("min-h-0 flex-1 overflow-auto", rightContentClassName)}>{rightContent}</div>
      </aside>
    </>
  );

  return (
    <TooltipProvider>
    <div
      {...(theme ? { "data-sandbox-ui": "true", "data-sandbox-theme": theme } : {})}
      data-density={density}
      data-surface={surface}
      className={cn(
        "flex h-screen flex-col overflow-hidden text-foreground font-sans",
        inset ? "bg-[var(--md3-surface-dim)]" : "bg-background",
        className,
      )}
    >
      <div ref={shellRef} className="flex min-h-0 flex-1">
        {desktop && left && leftOpen && (
          <>
            <aside
              aria-label={leftLabel}
              style={leftStyle}
              className={cn(
                "hidden shrink-0 bg-card lg:flex lg:flex-col",
                !resizable && "border-r border-border",
              )}
            >
              {leftHeader && (
                <ShellHeader className="justify-between gap-2">
                  <div className="min-w-0 flex-1">{leftHeader}</div>
                  <button
                    type="button"
                    aria-label="Collapse left panel"
                    data-pane-collapse="left"
                    onClick={() => {
                      setLeftOpen(false);
                      requestAnimationFrame(() => focusSideControl("left"));
                    }}
                    className={paneControlClassName}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </ShellHeader>
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

        {inset ? (
          // The gutter shows the recessed backdrop evenly on every side, so a
          // closed right pane ends the surface one gutter from the shell edge.
          <div className="flex min-h-0 min-w-0 flex-1 p-[var(--shell-inset-gutter,0.5rem)]">
            <div
              data-workspace-surface
              className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--md3-outline-variant)] bg-background shadow-[var(--shadow-card)]"
            >
              {centerPane}
              {rightPane}
            </div>
          </div>
        ) : (
          <>
            {centerPane}
            {rightPane}
          </>
        )}
      </div>

      {keepRightMounted && (
        <div hidden ref={rightParkingRef} aria-hidden="true">
          {rightHost && (rightOpen || rightVisited) && hasRight ? createPortal(right, rightHost) : null}
        </div>
      )}

      {!desktop && left && leftOpen && !(right && rightOpen) && (
        <MobileDrawer
          side="left"
          title={leftLabel}
          header={leftHeader}
          onClose={() => setLeftOpen(false)}
          onReturnFocus={() => focusSideControl("left")}
          theme={theme}
          density={density}
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
          onReturnFocus={() => focusSideControl("right")}
          theme={theme}
          density={density}
        >
          {rightContent}
        </MobileDrawer>
      )}
    </div>
    </TooltipProvider>
  );
}
