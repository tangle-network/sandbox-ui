import { Activity, AlertCircle, LoaderCircle, MessageSquareText } from "lucide-react";
import { cn } from "../lib/utils";
import {
  useActiveSessions,
  useProjectActivity,
  useTotalRunningSessions,
  type ActiveSessionRecord,
  type SessionProjectKey,
} from "../stores/active-sessions-store";

export interface SessionActivityMonitorProps {
  className?: string;
  compact?: boolean;
  sessionsById?: Record<string, ActiveSessionRecord>;
  emptyMessage?: string;
  resolveProjectLabel?: (projectId: SessionProjectKey, label?: string) => string;
  onSelectSession?: (session: ActiveSessionRecord) => void;
}

function SessionStatusDot({ session }: { session: ActiveSessionRecord }) {
  if (session.status === "error") {
    return <AlertCircle className="h-3 w-3 text-[var(--surface-danger-text)]" />;
  }

  if (session.status === "running") {
    return <LoaderCircle className="h-3 w-3 animate-spin text-[var(--brand-cool)]" />;
  }

  if (session.status === "attention-needed") {
    return <Activity className="h-3 w-3 text-[var(--surface-warning-text)]" />;
  }

  return <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-dim)]" />;
}

function navigateToSession(session: ActiveSessionRecord) {
  if (!session.href || typeof window === "undefined") return;
  window.location.assign(session.href);
}

export function SessionActivityMonitor({
  className,
  compact = false,
  sessionsById = {},
  emptyMessage = "No active sessions",
  resolveProjectLabel,
  onSelectSession,
}: SessionActivityMonitorProps) {
  const trackedSessions = useActiveSessions();
  const projectActivity = useProjectActivity();
  const totalRunning = useTotalRunningSessions();
  const sessionLookup = Object.keys(sessionsById).length > 0
    ? sessionsById
    : Object.fromEntries(trackedSessions.map((session) => [session.sessionId, session]));

  if (projectActivity.length === 0) {
    if (compact) return null;

    return (
      <div className={cn("rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--depth-2)] px-3 py-2 text-xs text-[var(--text-muted)]", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          <Activity className="h-3 w-3" />
          Active
        </div>
        {totalRunning > 0 && (
          <span className="rounded-full border border-[var(--border-accent)] bg-[var(--accent-surface-soft)] px-1.5 py-px text-[10px] font-medium text-[var(--accent-text)]">
            {totalRunning}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {projectActivity.map((project) => {
          const label = resolveProjectLabel?.(project.projectId, project.projectLabel)
            ?? project.projectLabel
            ?? String(project.projectId);

          return (
            <div
              key={String(project.projectId)}
              className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--depth-2)]"
            >
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-[var(--text-primary)]">{label}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {project.activeSessionCount} session{project.activeSessionCount === 1 ? "" : "s"}
                  </div>
                </div>
                {project.runningSessionIds.length > 0 && (
                  <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                    {project.runningSessionIds.length} live
                  </span>
                )}
              </div>

              {!compact && project.runningSessionIds.length > 0 && (
                <div className="border-t border-[var(--border-subtle)] px-1.5 py-1">
                  {project.runningSessionIds.map((sessionId) => {
                    const session = sessionLookup[sessionId];
                    if (!session) return null;

                    return (
                      <button
                        key={sessionId}
                        type="button"
                        onClick={() => {
                          if (onSelectSession) {
                            onSelectSession(session);
                            return;
                          }

                          navigateToSession(session);
                        }}
                        className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-left transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <SessionStatusDot session={session} />
                        <span className="min-w-0 truncate text-xs text-[var(--text-primary)]">
                          {session.title ?? "Untitled"}
                        </span>
                        <MessageSquareText className="ml-auto h-3 w-3 shrink-0 text-[var(--text-dim)]" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
