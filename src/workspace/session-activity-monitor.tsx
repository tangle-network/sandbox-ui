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
    return <AlertCircle className="h-3 w-3 text-destructive" />;
  }
  if (session.status === "running") {
    return <LoaderCircle className="h-3 w-3 animate-spin text-primary" />;
  }
  if (session.status === "attention-needed") {
    return <Activity className="h-3 w-3 text-warning" />;
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />;
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
      <div className={cn("rounded-md border border-dashed border-border bg-muted px-3 py-2.5 text-xs text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Activity className="h-3 w-3" />
          Active
        </span>
        {totalRunning > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
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
              className="rounded-md border border-border bg-muted"
            >
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-foreground">{label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {project.activeSessionCount} session{project.activeSessionCount === 1 ? "" : "s"}
                  </div>
                </div>
                {project.runningSessionIds.length > 0 && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {project.runningSessionIds.length} live
                  </span>
                )}
              </div>

              {!compact && project.runningSessionIds.length > 0 && (
                <div className="border-t border-border px-1 py-0.5">
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
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left transition-colors hover:bg-accent"
                      >
                        <SessionStatusDot session={session} />
                        <span className="min-w-0 truncate text-xs text-foreground">
                          {session.title ?? "Untitled"}
                        </span>
                        <MessageSquareText className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
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
