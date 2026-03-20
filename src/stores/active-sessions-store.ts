import { useStore } from "@nanostores/react";
import { atom } from "nanostores";
import { useMemo } from "react";

export type SessionProjectKey = string | number;
export type ActiveSessionStatus = "idle" | "running" | "attention-needed" | "error";
export type ActiveSessionReconnectState = "idle" | "reconnecting" | "failed";
export type ActiveSessionConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";
export type ActiveSessionTransportMode = "websocket" | "sse" | "polling" | "custom";

export interface ActiveSessionRecord {
  sessionId: string;
  projectId: SessionProjectKey | null;
  projectLabel?: string;
  title?: string;
  href?: string;
  registeredAt: number;
  lastActivityAt: number;
  lastEventAt: number | null;
  status: ActiveSessionStatus;
  isRunning: boolean;
  isForeground: boolean;
  needsAttention: boolean;
  connectionState: ActiveSessionConnectionState;
  reconnectState: ActiveSessionReconnectState;
  transportMode: ActiveSessionTransportMode | null;
  lastError: string | null;
  metadata?: Record<string, unknown>;
}

export interface ActiveSessionsState {
  sessions: Record<string, ActiveSessionRecord>;
  lastUpdatedAt: number;
}

export interface RegisterActiveSessionOptions {
  sessionId: string;
  projectId?: SessionProjectKey | null;
  projectLabel?: string;
  title?: string;
  href?: string;
  metadata?: Record<string, unknown>;
}

export interface ActiveSessionConnectionOptions {
  connectionState: ActiveSessionConnectionState;
  reconnectState?: ActiveSessionReconnectState;
  transportMode?: ActiveSessionTransportMode | null;
  lastError?: string | null;
  lastEventAt?: number | null;
}

export interface ActiveSessionActivityOptions {
  lastEventAt?: number | null;
}

export interface ActiveProjectActivity {
  projectId: SessionProjectKey;
  projectLabel?: string;
  activeSessionCount: number;
  runningSessionIds: string[];
  lastActivityAt: number;
}

const INITIAL_STATE: ActiveSessionsState = {
  sessions: {},
  lastUpdatedAt: 0,
};

const STATUS_PRIORITY: Record<ActiveSessionStatus, number> = {
  running: 0,
  error: 1,
  "attention-needed": 2,
  idle: 3,
};

const DEFAULT_RECORD = {
  status: "idle",
  isRunning: false,
  isForeground: false,
  needsAttention: false,
  connectionState: "disconnected",
  reconnectState: "idle",
  transportMode: null,
  lastError: null,
  lastEventAt: null,
} satisfies Pick<
  ActiveSessionRecord,
  | "status"
  | "isRunning"
  | "isForeground"
  | "needsAttention"
  | "connectionState"
  | "reconnectState"
  | "transportMode"
  | "lastError"
  | "lastEventAt"
>;

export const activeSessionsAtom = atom<ActiveSessionsState>(INITIAL_STATE);

let foregroundSessionId: string | null = null;

function createRecord(
  options: RegisterActiveSessionOptions,
  now: number,
): ActiveSessionRecord {
  return {
    sessionId: options.sessionId,
    projectId: options.projectId ?? null,
    projectLabel: options.projectLabel,
    title: options.title,
    href: options.href,
    registeredAt: now,
    lastActivityAt: now,
    metadata: options.metadata,
    ...DEFAULT_RECORD,
    isForeground: options.sessionId === foregroundSessionId,
  };
}

function resolveStatus(session: ActiveSessionRecord): ActiveSessionStatus {
  if (session.isRunning) return "running";
  if (session.lastError || session.reconnectState === "failed") return "error";
  if (session.needsAttention) return "attention-needed";
  return "idle";
}

function normalizeSession(session: ActiveSessionRecord): ActiveSessionRecord {
  return {
    ...session,
    status: resolveStatus(session),
  };
}

function updateSession(
  sessionId: string,
  updater: (record: ActiveSessionRecord, now: number) => ActiveSessionRecord,
): void {
  const current = activeSessionsAtom.get();
  const existing = current.sessions[sessionId];
  if (!existing) return;

  const now = Date.now();
  activeSessionsAtom.set({
    sessions: {
      ...current.sessions,
      [sessionId]: normalizeSession(updater(existing, now)),
    },
    lastUpdatedAt: now,
  });
}

export function registerActiveSession(options: RegisterActiveSessionOptions): void {
  const now = Date.now();
  const current = activeSessionsAtom.get();
  const existing = current.sessions[options.sessionId];

  activeSessionsAtom.set({
    sessions: {
      ...current.sessions,
      [options.sessionId]: normalizeSession(
        existing
          ? {
              ...existing,
              projectId: existing.projectId ?? options.projectId ?? null,
              projectLabel: options.projectLabel ?? existing.projectLabel,
              title: options.title ?? existing.title,
              href: options.href ?? existing.href,
              metadata: options.metadata ?? existing.metadata,
              lastActivityAt: now,
              isForeground: options.sessionId === foregroundSessionId || existing.isForeground,
            }
          : createRecord(options, now),
      ),
    },
    lastUpdatedAt: now,
  });
}

export function unregisterActiveSession(sessionId: string): void {
  const current = activeSessionsAtom.get();
  if (!current.sessions[sessionId]) return;

  const { [sessionId]: _removed, ...remaining } = current.sessions;
  if (foregroundSessionId === sessionId) {
    foregroundSessionId = null;
  }

  activeSessionsAtom.set({
    sessions: remaining,
    lastUpdatedAt: Date.now(),
  });
}

export function setForegroundActiveSession(sessionId: string | null): void {
  foregroundSessionId = sessionId;
  const current = activeSessionsAtom.get();
  const now = Date.now();
  let changed = false;

  const sessions = Object.fromEntries(
    Object.entries(current.sessions).map(([id, session]) => {
      const isForeground = id === sessionId;
      if (session.isForeground !== isForeground) {
        changed = true;
      }

      return [
        id,
        {
          ...session,
          isForeground,
          lastActivityAt: isForeground ? now : session.lastActivityAt,
        },
      ];
    }),
  );

  if (!changed) return;

  activeSessionsAtom.set({
    sessions,
    lastUpdatedAt: now,
  });
}

export function updateActiveSessionMeta(
  sessionId: string,
  meta: Partial<Pick<ActiveSessionRecord, "title" | "href" | "projectId" | "projectLabel" | "metadata">>,
): void {
  updateSession(sessionId, (session, now) => ({
    ...session,
    ...meta,
    lastActivityAt: now,
  }));
}

export function setActiveSessionConnection(
  sessionId: string,
  options: ActiveSessionConnectionOptions,
): void {
  updateSession(sessionId, (session, now) => ({
    ...session,
    connectionState: options.connectionState,
    reconnectState: options.reconnectState ?? session.reconnectState,
    transportMode: options.transportMode ?? session.transportMode,
    lastError: options.lastError === undefined ? session.lastError : options.lastError,
    lastEventAt: options.lastEventAt ?? session.lastEventAt,
    lastActivityAt: now,
  }));
}

export function setActiveSessionRunning(
  sessionId: string,
  isRunning: boolean,
  options?: ActiveSessionActivityOptions,
): void {
  updateSession(sessionId, (session, now) => ({
    ...session,
    isRunning,
    needsAttention: isRunning ? false : session.needsAttention,
    lastError: isRunning ? null : session.lastError,
    lastEventAt: options?.lastEventAt ?? session.lastEventAt,
    lastActivityAt: now,
  }));
}

export function setActiveSessionAttention(
  sessionId: string,
  needsAttention: boolean,
  options?: ActiveSessionActivityOptions,
): void {
  updateSession(sessionId, (session, now) => ({
    ...session,
    needsAttention,
    isRunning: needsAttention ? false : session.isRunning,
    lastEventAt: options?.lastEventAt ?? session.lastEventAt,
    lastActivityAt: now,
  }));
}

export function setActiveSessionError(sessionId: string, error: string | null): void {
  updateSession(sessionId, (session, now) => ({
    ...session,
    isRunning: false,
    needsAttention: false,
    lastError: error,
    reconnectState: error ? "failed" : "idle",
    connectionState: error ? "error" : session.connectionState,
    lastEventAt: now,
    lastActivityAt: now,
  }));
}

export function bumpActiveSessionActivity(
  sessionId: string,
  options?: ActiveSessionActivityOptions,
): void {
  updateSession(sessionId, (session, now) => ({
    ...session,
    lastEventAt: options?.lastEventAt ?? session.lastEventAt ?? now,
    lastActivityAt: now,
  }));
}

export function resetActiveSessions(): void {
  foregroundSessionId = null;
  activeSessionsAtom.set(INITIAL_STATE);
}

export function getAllActiveSessions(state: ActiveSessionsState): ActiveSessionRecord[] {
  return Object.values(state.sessions);
}

export function getActiveSession(
  state: ActiveSessionsState,
  sessionId: string,
): ActiveSessionRecord | null {
  return state.sessions[sessionId] ?? null;
}

export function getSessionsForProject(
  state: ActiveSessionsState,
  projectId: SessionProjectKey,
): ActiveSessionRecord[] {
  return Object.values(state.sessions).filter((session) => session.projectId === projectId);
}

export function getSessionsForNavbar(
  state: ActiveSessionsState,
  projectId?: SessionProjectKey | null,
): ActiveSessionRecord[] {
  const sessions =
    projectId == null ? Object.values(state.sessions) : getSessionsForProject(state, projectId);

  return [...sessions].sort((left, right) => {
    if (left.isForeground !== right.isForeground) {
      return Number(right.isForeground) - Number(left.isForeground);
    }

    const statusDiff = STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    return right.lastActivityAt - left.lastActivityAt;
  });
}

export function getSessionsByActivity(state: ActiveSessionsState): ActiveSessionRecord[] {
  return [...Object.values(state.sessions)].sort(
    (left, right) => right.lastActivityAt - left.lastActivityAt,
  );
}

export function getTotalRunningSessionCount(state: ActiveSessionsState): number {
  return Object.values(state.sessions).filter((session) => session.isRunning).length;
}

export function hasBackgroundRunningSessions(state: ActiveSessionsState): boolean {
  return Object.values(state.sessions).some(
    (session) => session.isRunning && !session.isForeground,
  );
}

export function getAllProjectActivity(state: ActiveSessionsState): ActiveProjectActivity[] {
  const grouped = new Map<SessionProjectKey, ActiveProjectActivity>();

  for (const session of Object.values(state.sessions)) {
    if (session.projectId == null) continue;

    const existing = grouped.get(session.projectId);
    if (existing) {
      existing.activeSessionCount += 1;
      existing.lastActivityAt = Math.max(existing.lastActivityAt, session.lastActivityAt);
      if (session.isRunning) {
        existing.runningSessionIds.push(session.sessionId);
      }
      if (!existing.projectLabel && session.projectLabel) {
        existing.projectLabel = session.projectLabel;
      }
      continue;
    }

    grouped.set(session.projectId, {
      projectId: session.projectId,
      projectLabel: session.projectLabel,
      activeSessionCount: 1,
      runningSessionIds: session.isRunning ? [session.sessionId] : [],
      lastActivityAt: session.lastActivityAt,
    });
  }

  return [...grouped.values()].sort((left, right) => right.lastActivityAt - left.lastActivityAt);
}

export function useActiveSessionsState(): ActiveSessionsState {
  return useStore(activeSessionsAtom);
}

export function useActiveSessions(): ActiveSessionRecord[] {
  const state = useStore(activeSessionsAtom);
  return useMemo(() => getAllActiveSessions(state), [state]);
}

export function useActiveSession(sessionId: string | null): ActiveSessionRecord | null {
  const state = useStore(activeSessionsAtom);
  return useMemo(
    () => (sessionId ? getActiveSession(state, sessionId) : null),
    [sessionId, state],
  );
}

export function useProjectSessions(
  projectId: SessionProjectKey | null,
): ActiveSessionRecord[] {
  const state = useStore(activeSessionsAtom);
  return useMemo(
    () => (projectId == null ? [] : getSessionsForProject(state, projectId)),
    [projectId, state],
  );
}

export function useNavbarSessions(
  projectId?: SessionProjectKey | null,
): ActiveSessionRecord[] {
  const state = useStore(activeSessionsAtom);
  return useMemo(() => getSessionsForNavbar(state, projectId), [projectId, state]);
}

export function useSessionsByActivity(): ActiveSessionRecord[] {
  const state = useStore(activeSessionsAtom);
  return useMemo(() => getSessionsByActivity(state), [state]);
}

export function useProjectActivity(): ActiveProjectActivity[] {
  const state = useStore(activeSessionsAtom);
  return useMemo(() => getAllProjectActivity(state), [state]);
}

export function useTotalRunningSessions(): number {
  const state = useStore(activeSessionsAtom);
  return useMemo(() => getTotalRunningSessionCount(state), [state]);
}

export function useHasBackgroundRunningSessions(): boolean {
  const state = useStore(activeSessionsAtom);
  return useMemo(() => hasBackgroundRunningSessions(state), [state]);
}
