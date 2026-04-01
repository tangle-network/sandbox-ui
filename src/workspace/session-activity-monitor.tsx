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
    return <AlertCircle className="h-3.5 w-3.5 text-[var(--status-danger)]" />;
  }

  if (session.status === "running") {
    return <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />;
  }

  if (session.status === "attention-needed") {
    return <Activity className="h-3.5 w-3.5 text-[var(--status-warning)]" />;
  }

  return <span className="h-2 w-2 rounded-full bg-[var(--text-dim)]" />;
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
      <div className={cn("rounded-[var(--radius-lg)] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] p-3 text-sm text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Active Sessions
        </div>
        {totalRunning > 0 && (
          <span className="rounded-full border border-border bg-[var(--accent-surface-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-text)]">
            {totalRunning} running
          </span>
        )}
      </div>

      <div className="space-y-2">
        {projectActivity.map((project) => {
          const label = resolveProjectLabel?.(project.projectId, project.projectLabel)
            ?? project.projectLabel
            ?? String(project.projectId);

          return (
            <div
              key={String(project.projectId)}
              className="rounded-[var(--radius-md)] border border-border bg-muted p-3 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground">
                    {project.activeSessionCount} tracked session{project.activeSessionCount === 1 ? "" : "s"}
                  </div>
                </div>
                {project.runningSessionIds.length > 0 && (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">
                    {project.runningSessionIds.length} live
                  </span>
                )}
              </div>

              {!compact && project.runningSessionIds.length > 0 && (
                <div className="mt-3 space-y-2">
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
                        className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-border bg-muted px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/50"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <SessionStatusDot session={session} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {session.title ?? "Untitled Session"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {session.href ?? session.sessionId}
                            </div>
                          </div>
                        </div>
                        <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground" />
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
