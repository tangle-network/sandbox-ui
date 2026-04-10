import { type ReactNode, useMemo } from "react";
import { cn } from "../lib/utils";

// ── Types ──

export interface TaskBoardItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  tags?: string[];
  dueDate?: Date | null;
  assigneeId?: string | null;
  meta?: Record<string, unknown>;
}

export interface TaskBoardColumn {
  id: string;
  label: string;
  accent?: string;
}

export interface TaskBoardProps {
  items: TaskBoardItem[];
  columns: TaskBoardColumn[];
  className?: string;

  onMoveItem?: (itemId: string, toColumnId: string) => void;
  onClickItem?: (item: TaskBoardItem) => void;

  renderItemMeta?: (item: TaskBoardItem) => ReactNode;
  renderColumnAction?: (column: TaskBoardColumn) => ReactNode;
  renderBadge?: (value: string, type: "priority" | "tag") => ReactNode;
  columnEmptyState?: ReactNode;
  header?: ReactNode;

  /**
   * Wrap each column's item list container. Use this to inject a DnD
   * droppable zone (e.g. Droppable from @hello-pangea/dnd).
   *
   * Receives the column ID, the default item list element, and the column's items.
   * Return a ReactNode that wraps/replaces the default element.
   *
   * If not provided, the default unstyled div is rendered.
   */
  renderColumnBody?: (
    columnId: string,
    defaultChildren: ReactNode,
    items: TaskBoardItem[],
  ) => ReactNode;

  /**
   * Wrap each item card. Use this to inject a DnD draggable
   * (e.g. Draggable from @hello-pangea/dnd).
   *
   * Receives the item, its index, and the default card element.
   * Return a ReactNode that wraps/replaces the default element.
   *
   * If not provided, the default button card is rendered.
   */
  renderItemWrapper?: (
    item: TaskBoardItem,
    index: number,
    defaultCard: ReactNode,
  ) => ReactNode;
}

// ── Component ──

export function TaskBoard({
  items,
  columns,
  className,
  onMoveItem,
  onClickItem,
  renderItemMeta,
  renderColumnAction,
  renderBadge,
  columnEmptyState,
  header,
  renderColumnBody,
  renderItemWrapper,
}: TaskBoardProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, TaskBoardItem[]>();
    for (const col of columns) map.set(col.id, []);
    for (const item of items) {
      const list = map.get(item.status);
      if (list) list.push(item);
      else map.get(columns[columns.length - 1]?.id)?.push(item);
    }
    return map;
  }, [items, columns]);

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
      {header}
      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {columns.map((col) => {
          const colItems = grouped.get(col.id) ?? [];

          const itemCards = (
            <>
              {colItems.length === 0 && columnEmptyState}
              {colItems.map((item, index) => {
                const card = (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onClickItem?.(item)}
                    className="group w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-accent/50"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {(item.priority || item.tags?.length) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.priority &&
                          (renderBadge ? (
                            renderBadge(item.priority, "priority")
                          ) : (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {item.priority}
                            </span>
                          ))}
                        {item.tags?.map((tag) =>
                          renderBadge ? (
                            <span key={tag}>{renderBadge(tag, "tag")}</span>
                          ) : (
                            <span
                              key={tag}
                              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                    {renderItemMeta?.(item)}
                  </button>
                );

                return renderItemWrapper
                  ? <span key={item.id}>{renderItemWrapper(item, index, card)}</span>
                  : card;
              })}
            </>
          );

          const columnBody = (
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 min-h-[80px]">
              {renderColumnBody
                ? renderColumnBody(col.id, itemCards, colItems)
                : itemCards}
            </div>
          );

          return (
            <div
              key={col.id}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card/50 border-t-2",
                col.accent ?? "border-t-muted-foreground/30",
              )}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </h3>
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-border px-1.5 text-[10px] font-medium text-muted-foreground">
                    {colItems.length}
                  </span>
                </div>
                {renderColumnAction?.(col)}
              </div>
              {columnBody}
            </div>
          );
        })}
      </div>
    </div>
  );
}
