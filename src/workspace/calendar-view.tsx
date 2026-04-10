import { type ReactNode, useState, useMemo } from "react";
import { cn } from "../lib/utils";

// ── Types ──

export interface CalendarEvent {
  id: string;
  title: string;
  type?: string;
  startAt: Date | string;
  endAt?: Date | string | null;
  allDay?: boolean;
  /** Arbitrary data passed through to render props */
  meta?: Record<string, unknown>;
}

export interface CalendarViewProps {
  events: CalendarEvent[];
  className?: string;

  /** Controlled month (0-indexed). Defaults to current month. */
  month?: number;
  year?: number;
  onMonthChange?: (year: number, month: number) => void;

  /** Which day is selected (ISO date string YYYY-MM-DD) */
  selectedDay?: string | null;
  onSelectDay?: (dateKey: string) => void;
  onDoubleClickDay?: (dateKey: string) => void;

  // ── Customization ──
  /** Render an event dot/chip inside a calendar cell */
  renderEventChip?: (event: CalendarEvent) => ReactNode;
  /** Render the day detail panel (right side) */
  renderDayDetail?: (dateKey: string, dayEvents: CalendarEvent[]) => ReactNode;
  /** Header slot (left of navigation) */
  headerLeft?: ReactNode;
  /** Header slot (right of navigation) */
  headerRight?: ReactNode;
  /** Whether to show the day detail panel. Default true. */
  showDayPanel?: boolean;
}

// ── Helpers ──

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthDays(
  year: number,
  month: number,
): { date: Date; key: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const days: { date: Date; key: string; inMonth: boolean }[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, key: toDateKey(d), inMonth: false });
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, key: toDateKey(d), inMonth: true });
  }
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, key: toDateKey(d), inMonth: false });
    }
  }
  return days;
}

// ── Component ──

/**
 * CalendarView — month grid calendar with event chips and optional day detail panel.
 *
 * Stateless by default (controlled month/selectedDay). Falls back to internal
 * state when uncontrolled. All rendering is customizable via render props.
 */
export function CalendarView({
  events,
  className,
  month: controlledMonth,
  year: controlledYear,
  onMonthChange,
  selectedDay: controlledSelectedDay,
  onSelectDay,
  onDoubleClickDay,
  renderEventChip,
  renderDayDetail,
  headerLeft,
  headerRight,
  showDayPanel = true,
}: CalendarViewProps) {
  const today = new Date();
  const todayKey = toDateKey(today);

  const [internalMonth, setInternalMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [internalSelectedDay, setInternalSelectedDay] = useState<string | null>(
    todayKey,
  );

  const viewYear = controlledYear ?? internalMonth.year;
  const viewMonth = controlledMonth ?? internalMonth.month;
  const selectedDay = controlledSelectedDay ?? internalSelectedDay;

  function setMonth(y: number, m: number) {
    if (onMonthChange) onMonthChange(y, m);
    else setInternalMonth({ year: y, month: m });
  }
  function selectDay(key: string) {
    if (onSelectDay) onSelectDay(key);
    else setInternalSelectedDay(key);
  }

  function prevMonth() {
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    setMonth(y, m);
  }
  function nextMonth() {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    setMonth(y, m);
  }

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const evt of events) {
      const d =
        typeof evt.startAt === "string"
          ? evt.startAt.slice(0, 10)
          : toDateKey(evt.startAt);
      if (!map[d]) map[d] = [];
      map[d].push(evt);
    }
    return map;
  }, [events]);

  const monthDays = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const monthLabel = new Date(viewYear, viewMonth).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedDayEvents = selectedDay ? eventsByDate[selectedDay] ?? [] : [];

  return (
    <div className={cn("flex flex-1 min-h-0 overflow-hidden", className)}>
      {/* Calendar grid */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {headerLeft}
            <button
              type="button"
              onClick={prevMonth}
              className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[160px] text-center">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setMonth(today.getFullYear(), today.getMonth());
                selectDay(todayKey);
              }}
              className="h-7 px-2 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Today
            </button>
          </div>
          {headerRight}
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-border shrink-0">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
          {monthDays.map(({ date, key, inMonth }) => {
            const dayEvents = eventsByDate[key] ?? [];
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(key)}
                onDoubleClick={() => onDoubleClickDay?.(key)}
                className={cn(
                  "flex flex-col items-start p-1.5 border-b border-r border-border text-left transition-colors min-h-[72px]",
                  !inMonth && "bg-muted/30",
                  isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                  !isSelected && "hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5",
                    isToday && "bg-primary text-primary-foreground",
                    !isToday && !inMonth && "text-muted-foreground/50",
                    !isToday && inMonth && "text-foreground",
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="flex flex-wrap gap-0.5 w-full">
                  {dayEvents.slice(0, 3).map((evt) =>
                    renderEventChip ? (
                      <span key={evt.id}>{renderEventChip(evt)}</span>
                    ) : (
                      <div
                        key={evt.id}
                        className="w-full truncate text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary"
                        title={evt.title}
                      >
                        {evt.title}
                      </div>
                    ),
                  )}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-muted-foreground px-1">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {showDayPanel && (
        <div className="w-80 shrink-0 flex flex-col overflow-hidden">
          {renderDayDetail ? (
            renderDayDetail(selectedDay ?? todayKey, selectedDayEvents)
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border shrink-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedDay === todayKey
                    ? "Today"
                    : selectedDay
                      ? new Date(selectedDay + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { weekday: "long", month: "long", day: "numeric" },
                        )
                      : "Select a day"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedDayEvents.length} event
                  {selectedDayEvents.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {selectedDayEvents.length === 0 && (
                  <div className="px-2 py-8 text-center">
                    <p className="text-xs text-muted-foreground">
                      No events this day
                    </p>
                  </div>
                )}
                {selectedDayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {evt.title}
                    </p>
                    {evt.type && (
                      <span className="mt-1 inline-block rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {evt.type}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
