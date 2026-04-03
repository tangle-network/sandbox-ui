import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeft, FolderTree, GripVertical, MessageSquareText, Plus, Search, Settings, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { useNavbarSessions, type ActiveSessionRecord, type ActiveSessionStatus, type SessionProjectKey } from "../stores/active-sessions-store";

export interface SessionSidebarItem {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  updatedAt?: string | number | Date;
  projectId?: SessionProjectKey | null;
  status?: ActiveSessionStatus;
  category?: string;
  isPinned?: boolean;
  badges?: SessionSidebarBadge[];
}

export interface SessionSidebarBadge {
  id: string;
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}

export interface SessionSidebarLink {
  id: string;
  label: string;
  href?: string;
  icon?: "vault" | "settings" | "back";
}

export interface SessionSidebarFilter {
  id: string;
  label: string;
  matches: (
    item: SessionSidebarItem,
    options: {
      session: ActiveSessionRecord | null;
      isActive: boolean;
    },
  ) => boolean;
}

export interface SessionSidebarProps {
  title: string;
  subtitle?: string;
  projectId?: SessionProjectKey | null;
  items: SessionSidebarItem[];
  currentItemId?: string | null;
  createLabel?: string;
  onCreate?: () => void;
  onSelectItem?: (item: SessionSidebarItem) => void;
  onSelectLink?: (link: SessionSidebarLink) => void;
  links?: SessionSidebarLink[];
  className?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  enableSearch?: boolean;
  activityMonitor?: ReactNode;
  filters?: SessionSidebarFilter[];
  defaultFilterId?: string;
  resizable?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
  renderItemActions?: (
    item: SessionSidebarItem,
    options: {
      session: ActiveSessionRecord | null;
      isActive: boolean;
    },
  ) => ReactNode;
}

function statusDot(status?: ActiveSessionStatus) {
  switch (status) {
    case "running":
      return "bg-[var(--status-running)]";
    case "error":
      return "bg-[var(--surface-danger-text)]";
    case "attention-needed":
      return "bg-[var(--surface-warning-text)]";
    default:
      return "bg-muted-foreground/40";
  }
}

function iconForLink(icon?: SessionSidebarLink["icon"]) {
  switch (icon) {
    case "vault":
      return FolderTree;
    case "settings":
      return Settings;
    case "back":
      return ArrowLeft;
    default:
      return Sparkles;
  }
}

function sortItems(
  items: SessionSidebarItem[],
  sessionStatusById: Map<string, ActiveSessionRecord>,
): SessionSidebarItem[] {
  return [...items].sort((left, right) => {
    if (Boolean(left.isPinned) !== Boolean(right.isPinned)) {
      return left.isPinned ? -1 : 1;
    }

    const leftSession = sessionStatusById.get(left.id);
    const rightSession = sessionStatusById.get(right.id);

    if (Boolean(leftSession) !== Boolean(rightSession)) {
      return leftSession ? -1 : 1;
    }

    if (leftSession && rightSession) {
      if (leftSession.isForeground !== rightSession.isForeground) {
        return Number(rightSession.isForeground) - Number(leftSession.isForeground);
      }

      const leftRunning = Number(leftSession.status === "running");
      const rightRunning = Number(rightSession.status === "running");
      if (leftRunning !== rightRunning) {
        return rightRunning - leftRunning;
      }

      if (leftSession.lastActivityAt !== rightSession.lastActivityAt) {
        return rightSession.lastActivityAt - leftSession.lastActivityAt;
      }
    }

    const leftUpdated = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    const rightUpdated = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    return rightUpdated - leftUpdated;
  });
}

function badgeTone(tone: SessionSidebarBadge["tone"] = "neutral") {
  switch (tone) {
    case "accent":
      return "border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-primary";
    case "success":
      return "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]";
    case "warning":
      return "border-[var(--surface-warning-border)] bg-[var(--surface-warning-bg)] text-[var(--surface-warning-text)]";
    case "danger":
      return "border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] text-[var(--surface-danger-text)]";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function navigateToHref(href?: string) {
  if (!href || typeof window === "undefined") return;
  window.location.assign(href);
}

function useResizable(defaultWidth: number, min: number, max: number, onChange?: (w: number) => void) {
  const [width, setWidth] = useState(defaultWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [width]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    const next = Math.min(max, Math.max(min, startW.current + delta));
    setWidth(next);
    onChange?.(next);
  }, [min, max, onChange]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return { width, onPointerDown, onPointerMove, onPointerUp };
}

export function SessionSidebar({
  title,
  subtitle,
  projectId = null,
  items,
  currentItemId,
  createLabel = "New Session",
  onCreate,
  onSelectItem,
  onSelectLink,
  links = [],
  className,
  emptyMessage = "No sessions yet. Start a conversation.",
  searchPlaceholder = "Search sessions",
  enableSearch = true,
  activityMonitor,
  filters = [],
  defaultFilterId,
  resizable = false,
  defaultWidth = 256,
  minWidth = 200,
  maxWidth = 400,
  onWidthChange,
  renderItemActions,
}: SessionSidebarProps) {
  const [query, setQuery] = useState("");
  const [activeFilterId, setActiveFilterId] = useState(defaultFilterId ?? filters[0]?.id ?? "all");
  const activeSessions = useNavbarSessions(projectId);
  const sessionsById = useMemo(
    () => new Map(activeSessions.map((session) => [session.sessionId, session])),
    [activeSessions],
  );
  const orderedItems = useMemo(
    () => sortItems(items, sessionsById),
    [items, sessionsById],
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const selectedFilter = filters.find((filter) => filter.id === activeFilterId) ?? null;

    return orderedItems.filter((item) => {
      const session = sessionsById.get(item.id) ?? null;
      const isActive = currentItemId === item.id;
      if (selectedFilter && !selectedFilter.matches(item, { session, isActive })) {
        return false;
      }

      if (!normalizedQuery) return true;
      const haystack = `${item.title} ${item.subtitle ?? ""} ${item.category ?? ""} ${(item.badges ?? []).map((badge) => badge.label).join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeFilterId, currentItemId, filters, orderedItems, query, sessionsById]);
  const runningCount = activeSessions.filter((session) => session.status === "running").length;
  const filterCounts = useMemo(() => (
    Object.fromEntries(filters.map((filter) => [
      filter.id,
      orderedItems.filter((item) => filter.matches(item, {
        session: sessionsById.get(item.id) ?? null,
        isActive: currentItemId === item.id,
      })).length,
    ]))
  ), [currentItemId, filters, orderedItems, sessionsById]);

  const resize = useResizable(defaultWidth, minWidth, maxWidth, onWidthChange);

  return (
    <aside
      className={cn("relative flex shrink-0 flex-col border-r border-border bg-card", className)}
      style={{ width: resizable ? resize.width : defaultWidth }}
    >
      {/* Header */}
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-primary">
              <MessageSquareText className="h-3 w-3" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-foreground">{title}</div>
              {subtitle && (
                <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {runningCount > 0 && (
              <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-surface-soft)] px-1.5 py-px text-[10px] font-medium text-primary">
                {runningCount}
              </span>
            )}
            {onCreate && (
              <button
                type="button"
                onClick={onCreate}
                title={createLabel}
                className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] border border-border text-muted-foreground transition-colors hover:bg-[var(--accent-surface-soft)] hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {enableSearch && items.length > 0 && (
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-7 w-full rounded-[var(--radius-sm)] border border-border bg-muted pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-accent)]"
            />
          </div>
        )}

        {filters.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {filters.map((filter) => {
              const isSelected = activeFilterId === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilterId(filter.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-px text-[10px] font-medium transition-colors",
                    isSelected
                      ? "border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{filter.label}</span>
                  <span className="text-[9px] opacity-60">{filterCounts[filter.id] ?? 0}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Session list */}
      <nav aria-label="Sessions" className="flex-1 overflow-y-auto px-1.5 py-1.5">
        {visibleItems.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            {query.trim() ? `No sessions match "${query.trim()}".` : emptyMessage}
          </div>
        ) : (
          <ul className="space-y-px">
            {visibleItems.map((item) => {
              const session = sessionsById.get(item.id) ?? null;
              const isActive = currentItemId === item.id;
              const status = session?.status ?? item.status;
              const visibleBadges = [
                ...(item.isPinned ? [{ id: `${item.id}-pinned`, label: "Pinned", tone: "accent" as const }] : []),
                ...(item.badges ?? []),
              ];

              return (
                <li key={item.id}>
                  <div
                    className={cn(
                      "group relative flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors",
                      isActive
                        ? "bg-[var(--accent-surface-soft)] text-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectItem) {
                          onSelectItem(item);
                          return;
                        }
                        navigateToHref(item.href);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className="min-w-0 flex flex-1 items-center gap-2 text-left"
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot(status))} />
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          "truncate text-xs",
                          isActive ? "font-semibold text-foreground" : "font-medium",
                        )}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="truncate text-[10px] leading-tight text-muted-foreground">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {visibleBadges.length > 0 && visibleBadges.slice(0, 1).map((badge) => (
                        <span
                          key={badge.id}
                          className={cn(
                            "rounded-full border px-1.5 py-px text-[8px] font-semibold uppercase",
                            badgeTone(badge.tone),
                          )}
                        >
                          {badge.label}
                        </span>
                      ))}
                      {session?.isForeground && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" title="Live" />
                      )}
                      {renderItemActions ? (
                        <div
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {renderItemActions(item, { session, isActive })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Activity monitor slot */}
      {activityMonitor && (
        <div className="border-t border-border px-2 py-1.5">
          {activityMonitor}
        </div>
      )}

      {/* Bottom links */}
      {links.length > 0 && (
        <nav aria-label="Workspace sections" className="border-t border-border px-1.5 py-1.5">
          <div className="space-y-px">
            {links.map((link) => {
              const Icon = iconForLink(link.icon);
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => {
                    if (onSelectLink) {
                      onSelectLink(link);
                      return;
                    }
                    navigateToHref(link.href);
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Resize handle */}
      {resizable && (
        <div
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent-surface-soft)] active:bg-[var(--border-accent)] transition-colors"
          onPointerDown={resize.onPointerDown}
          onPointerMove={resize.onPointerMove}
          onPointerUp={resize.onPointerUp}
          title="Drag to resize"
        />
      )}
    </aside>
  );
}
