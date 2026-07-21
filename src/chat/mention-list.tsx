import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import type { MentionItem } from "./agent-composer";

/** Imperative surface the editor's suggestion keymap drives. */
export interface MentionListHandle {
  /** Returns true when the key was consumed — the editor must not also act. */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export interface MentionListProps {
  items: MentionItem[];
  loading: boolean;
  error: boolean;
  /** Shown when the fetch resolved to zero items. Default "No matches". */
  emptyText?: string;
  renderItem?: (item: MentionItem) => React.ReactNode;
  onSelect: (item: MentionItem) => void;
}

/**
 * The caret-anchored suggestion list: a flat, keyboard-driven menu with
 * loading, empty, and error states. Selection is owned here so ↑/↓ and
 * Enter/Tab resolve against the highlighted row; every key it handles is
 * reported consumed so the composer's Enter-to-send never fires while open.
 */
export const MentionList = React.forwardRef<MentionListHandle, MentionListProps>(
  function MentionList(
    { items, loading, error, emptyText = "No matches", renderItem, onSelect },
    ref,
  ) {
    const [selected, setSelected] = React.useState(0);
    // Mirrors `selected` so the key handler reads the live index even when keys
    // arrive faster than React commits (e.g. synchronous test-driven calls).
    const selectedRef = React.useRef(0);
    const move = (next: number) => {
      selectedRef.current = next;
      setSelected(next);
    };

    // A new result set re-homes the highlight to the top.
    React.useEffect(() => {
      move(0);
    }, [items]);

    React.useImperativeHandle(
      ref,
      () => ({
        onKeyDown(event) {
          const count = items.length;
          switch (event.key) {
            case "ArrowDown":
              if (count > 0) move((selectedRef.current + 1) % count);
              return true;
            case "ArrowUp":
              if (count > 0) move((selectedRef.current - 1 + count) % count);
              return true;
            case "Enter":
            case "Tab":
              // Consume regardless of results so the message never submits
              // while the popover is open.
              if (count > 0) onSelect(items[selectedRef.current]!);
              return true;
            default:
              return false;
          }
        },
      }),
      [items, onSelect],
    );

    return (
      <div
        role="listbox"
        aria-label="File mentions"
        className={cn(
          "max-h-64 min-w-[16rem] max-w-sm overflow-y-auto rounded-xl border border-[var(--md3-outline-variant)]",
          "bg-surface-container-high p-1 shadow-lg",
        )}
      >
        {loading && (
          <div className="flex items-center gap-2 px-2.5 py-2 text-muted-foreground text-sm">
            <Loader2 className="size-3.5 animate-spin" />
            Searching…
          </div>
        )}

        {!loading && error && (
          <div className="px-2.5 py-2 text-[var(--status-error,#ff4d6d)] text-sm">
            Couldn’t load matches
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="px-2.5 py-2 text-muted-foreground text-sm">
            {emptyText}
          </div>
        )}

        {!loading &&
          !error &&
          items.map((item, index) => {
            const active = index === selected;
            return (
              <button
                type="button"
                key={item.id}
                role="option"
                aria-selected={active}
                // Pointer down (not click) so selecting never blurs the editor
                // first, which would tear down the suggestion mid-select.
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(item);
                }}
                // Routes through the same path arrows use so the imperative
                // Enter/Tab handler (which reads `selectedRef`, not `selected`)
                // agrees with the row the pointer is over.
                onMouseEnter={() => move(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm",
                  active
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {renderItem ? (
                  renderItem(item)
                ) : (
                  <>
                    <span className="truncate text-foreground">
                      {item.label}
                    </span>
                    {item.detail && (
                      <span className="ml-auto truncate text-muted-foreground text-xs">
                        {item.detail}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
      </div>
    );
  },
);
