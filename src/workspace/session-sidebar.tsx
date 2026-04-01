import { type ReactNode, useMemo, useState } from "react";
import { ArrowLeft, FolderTree, MessageSquareText, Plus, Search, Settings, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
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
  renderItemActions?: (
    item: SessionSidebarItem,
    options: {
      session: ActiveSessionRecord | null;
      isActive: boolean;
    },
  ) => ReactNode;
}

function statusClasses(status?: ActiveSessionStatus) {
  switch (status) {
    case "running":
      return "bg-[var(--brand-cool)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand-cool)_18%,transparent)]";
    case "error":
      return "bg-[var(--status-danger)]";
    case "attention-needed":
      return "bg-[var(--status-warning)]";
    default:
      return "bg-[var(--text-dim)]";
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

function badgeClasses(tone: SessionSidebarBadge["tone"] = "neutral") {
  switch (tone) {
    case "accent":
      return "border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-[var(--accent-text)]";
    case "success":
      return "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)] text-[var(--surface-success-text)]";
    case "warning":
      return "border-[var(--surface-warning-border)] bg-[var(--surface-warning-bg)] text-[var(--surface-warning-text)]";
    case "danger":
      return "border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)] text-[var(--surface-danger-text)]";
    default:
      return "border-[var(--border-subtle)] bg-[var(--bg-section)] text-[var(--text-secondary)]";
  }
}

function navigateToHref(href?: string) {
  if (!href || typeof window === "undefined") return;
  window.location.assign(href);
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

  return (
    <aside className={cn("flex w-64 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-card)]", className)}>
      <div className="border-b border-[var(--border-subtle)] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-accent)]/50 bg-[var(--accent-surface-soft)] text-[var(--accent-text)]">
              <MessageSquareText className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-[0.01em] text-[var(--text-primary)]">{title}</div>
              {subtitle && (
                <div className="truncate text-[11px] text-[var(--text-muted)]">{subtitle}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {runningCount > 0 && (
              <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-surface-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-text)]">
                {runningCount}
              </span>
            )}
            {onCreate && (
              <button
                type="button"
                onClick={onCreate}
                title={createLabel}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-section)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-accent)] hover:bg-[var(--accent-surface-soft)] hover:text-[var(--accent-text)]"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {enableSearch && items.length > 0 && (
          <div className="relative mt-2.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-section)] pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-accent)]"
            />
          </div>
        )}

        {filters.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {filters.map((filter) => {
              const isSelected = activeFilterId === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilterId(filter.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    isSelected
                      ? "border-[var(--border-accent)] bg-[var(--accent-surface-soft)] text-[var(--accent-text)]"
                      : "border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                  )}
                >
                  <span>{filter.label}</span>
                  <span className="text-[9px] opacity-70">
                    {filterCounts[filter.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <nav aria-label="Sessions" className="flex-1 overflow-y-auto px-2 py-2">
        {visibleItems.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-section)] px-3 py-4 text-xs text-[var(--text-muted)]">
            {query.trim() ? `No sessions match "${query.trim()}".` : emptyMessage}
          </div>
        ) : (
          <ul className="space-y-1">
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
                      "group flex items-start gap-2 rounded-[var(--radius-md)] border px-2 py-2 transition-colors",
                      isActive
                        ? "border-[var(--border-accent)] bg-[var(--accent-surface-soft)] shadow-[var(--shadow-card)]"
                        : "border-[var(--border-subtle)] bg-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-section)]",
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
                      className="min-w-0 flex flex-1 items-start gap-2.5 text-left"
                    >
                      <span className={cn("mt-[5px] h-2 w-2 shrink-0 rounded-full", statusClasses(status))} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-[var(--text-primary)]">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="mt-0.5 truncate text-[11px] leading-tight text-[var(--text-muted)]">
                            {item.subtitle}
                          </div>
                        )}
                        {visibleBadges.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {visibleBadges.map((badge) => (
                              <span
                                key={badge.id}
                                className={cn(
                                  "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em]",
                                  badgeClasses(badge.tone),
                                )}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      {session?.isForeground && (
                        <Badge className="rounded-full border-[var(--border-subtle)] bg-[var(--bg-section)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                          Live
                        </Badge>
                      )}
                      {renderItemActions ? (
                        <div
                          className="opacity-70 transition-opacity hover:opacity-100 group-hover:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {renderItemActions(item, {
                            session,
                            isActive,
                          })}
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

      {activityMonitor && (
        <div className="border-t border-[var(--border-subtle)] px-2 py-2">
          {activityMonitor}
        </div>
      )}

      {links.length > 0 && (
        <nav aria-label="Workspace sections" className="border-t border-[var(--border-subtle)] px-2 py-2">
          <div className="space-y-0.5">
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
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-section)] hover:text-[var(--text-primary)]"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </aside>
  );
}
