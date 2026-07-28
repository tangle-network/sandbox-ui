"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { cn } from "./utils";

/**
 * The shared chrome for every selector popover in the composer family — the
 * model picker and the harness picker.
 *
 * These two menus are the same control in the user's head ("configure the
 * agent"), so they have to read as one family. They drifted anyway: the model
 * menu grew a search field, brand-marked sections and a footer count while the
 * harness menu stayed a flat list of wrapping sentences. Sharing the container,
 * section, search and footer here is what stops that happening again — a change
 * to the menu's shape lands on both by construction rather than by remembering.
 *
 * Only presentation lives here. The Radix primitive and the row contents stay
 * with each picker, because they select over different data (a model catalog vs
 * a fixed harness list) and forcing one row type onto both would be a worse fit
 * than the duplication it removes.
 */

/**
 * Popover container. Width tracks the trigger but is floored so a narrow pill
 * still opens a readable menu, and the height is capped to the smaller of a
 * fixed max and the space Radix measured on the open side — so a long list
 * scrolls inside the menu instead of running off the top of the viewport.
 */
export const pickerMenuContentClass = cn(
  "z-50 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[320px] max-w-[460px]",
  "max-h-[min(440px,var(--radix-dropdown-menu-content-available-height))] overflow-hidden flex flex-col",
  "rounded-[var(--radius-md)] border border-[var(--md3-outline-variant)] bg-surface-container-highest shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
);

/** Scrolling body between the search header and the footer. */
export const pickerMenuBodyClass = "flex-1 overflow-y-auto";

/**
 * Row shell. `active` is the current selection, `featured` lifts a row into a
 * card — used for recommended entries.
 */
export function pickerMenuItemClass({
  active,
  featured,
}: { active?: boolean; featured?: boolean } = {}): string {
  return cn(
    "flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 outline-none",
    "transition-colors duration-[var(--transition-fast)]",
    "hover:bg-accent/50 focus:bg-accent/50",
    featured && "mx-1 border border-primary/10 bg-primary/[0.04] px-2.5",
    active &&
      "bg-primary/10 font-medium text-foreground ring-1 ring-inset ring-primary/25 hover:bg-primary/15 focus:bg-primary/15",
  );
}

/**
 * Search header. `onKeyDownCapture` stops printable keys reaching Radix's
 * built-in typeahead, which would otherwise move focus off the input to a
 * matching menu item as soon as the typed text matched anything.
 */
export function PickerMenuSearch({
  value,
  onChange,
  placeholder,
  loading,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  loading?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--md3-outline-variant)] bg-surface-container-high px-3 py-2">
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key.length === 1) e.stopPropagation();
        }}
        placeholder={placeholder}
        autoFocus
        className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
      />
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

/**
 * Section heading. `tone="featured"` tints a recommended group; `glyph` carries
 * a brand mark for provider-named sections.
 */
export function PickerMenuSection({
  label,
  glyph,
  tone,
  children,
}: {
  label: string;
  glyph?: React.ReactNode;
  tone?: "featured";
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 pt-1.5 pb-0.5 text-[10px] font-mono uppercase tracking-widest",
          tone === "featured" ? "text-primary" : "text-muted-foreground",
        )}
      >
        {glyph}
        <span>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Footer count — how much of the catalog the current filter is showing. */
export function PickerMenuFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--md3-outline-variant)] px-3 py-1.5 text-[10px] text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * The quiet second line of a row: short facts separated by a dim middot. Used
 * for a model's context/price and for a harness's description, so both rows
 * carry their metadata the same way.
 *
 * The first part absorbs the spare width and truncates; later parts hold their
 * full width. They are the short, high-value facts (a price, a capability note)
 * and clipping them to fit a long description would drop the very thing the line
 * is there to say.
 */
export function PickerMenuMeta({ parts }: { parts: Array<React.ReactNode> }) {
  const shown = parts.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {shown.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="shrink-0 opacity-40">·</span>}
          <span className={i === 0 ? "min-w-0 truncate" : "shrink-0"}>{part}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * A small qualifier chip sitting beside a row's title — the model row's routing
 * host ("via OpenRouter"), the harness row's autonomy note ("own model"). It
 * qualifies the NAME, so it belongs on the title line rather than competing for
 * width with the description underneath.
 */
export function PickerMenuTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-[var(--md3-outline-variant)] bg-surface-container px-1.5 py-px text-[9px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}
