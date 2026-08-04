"use client";

import { Lock, Plus } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import { useClickOutside } from "../lib/use-click-outside";
import { AnchoredPopover } from "./anchored-popover";

interface InformativeLockProps {
  children: React.ReactNode;
  ariaLabel: string;
  lockTitle: React.ReactNode;
  lockBody: React.ReactNode;
  newChatLabel: string;
  onNewChat: () => void;
  className?: string;
  triggerClassName?: string;
  popoverClassName?: string;
  side?: "top" | "bottom";
}

/**
 * Interactive locked-control shell shared by session-bound pickers. It keeps
 * the pinned selection visible while explaining how to switch in a new chat.
 */
export function InformativeLock({
  children,
  ariaLabel,
  lockTitle,
  lockBody,
  newChatLabel,
  onNewChat,
  className,
  triggerClassName,
  popoverClassName,
  side = "top",
}: InformativeLockProps) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), [popoverRef]);

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, [cancelClose]);
  React.useEffect(() => cancelClose, [cancelClose]);

  return (
    <div
      ref={ref}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-state={open ? "open" : "closed"}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container px-2.5 opacity-60",
          "text-xs font-medium text-foreground shadow-sm transition-colors",
          "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "data-[state=open]:border-[var(--md3-outline-variant)] data-[state=open]:bg-surface-container-high",
          triggerClassName,
        )}
      >
        {children}
      </button>

      {open && (
        <AnchoredPopover
          ref={popoverRef}
          anchorRef={ref}
          side={side}
          role="dialog"
          // Hover-open shell: the portaled panel is outside the trigger's DOM
          // subtree, so it re-arms the same open/close timers itself to keep
          // pointer travel between trigger and panel from closing it.
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          className={cn(
            "w-72 rounded-[var(--radius-md)] border border-[var(--md3-outline-variant)] bg-surface-container-highest p-3",
            "shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
            popoverClassName,
          )}
        >
          <p className="flex items-start gap-2 text-sm font-medium text-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{lockTitle}</span>
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">{lockBody}</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNewChat();
            }}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-foreground",
              "bg-primary/10 ring-1 ring-inset ring-primary/25 transition-colors",
              "hover:bg-primary/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <Plus className="h-4 w-4" />
            {newChatLabel}
          </button>
        </AnchoredPopover>
      )}
    </div>
  );
}
