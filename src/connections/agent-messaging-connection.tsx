"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@tangle-network/ui/primitives";
import { cn } from "@tangle-network/ui/utils";

/** Safe display fields for a host-resolved, authorized private agent target. */
export interface AgentTargetSummary {
  agentLabel: string;
  workspaceLabel?: string;
}

/** The host must recheck the member grant before reporting `eligible` or `enrolled`. */
export type AgentEnrollmentViewState =
  | { status: "checking" }
  | { status: "eligible" }
  | { status: "enrolling" }
  | { status: "enrolled"; target: AgentTargetSummary }
  | { status: "forbidden"; message?: string }
  | { status: "error"; message?: string };

/**
 * `ready` means the host verified this application's route for this member.
 * A globally attached provider line alone is not enough to report readiness.
 */
export type SharedMessagingRouteViewState =
  | { status: "checking" }
  | { status: "pending"; message?: string }
  | { status: "ready"; channelLabel: string; destinationLabel: string }
  | { status: "forbidden"; message?: string }
  | { status: "unavailable"; message?: string }
  | { status: "error"; message?: string };

export interface AgentMessagingConnectionProps {
  enrollment: AgentEnrollmentViewState;
  route: SharedMessagingRouteViewState;
  /** The host performs authenticated, idempotent enrollment and reloads the result. */
  onEnroll: () => void | Promise<void>;
  /** Open the host's authorized conversation. Shown only when both states are ready. */
  onOpenMessages?: () => void;
  /** Recheck a failed host read. This does not enroll or mutate a provider route. */
  onRetry?: () => void | Promise<void>;
  className?: string;
}

function AgentStatus({ enrollment }: { enrollment: AgentEnrollmentViewState }) {
  switch (enrollment.status) {
    case "checking":
      return <span>Checking access…</span>;
    case "eligible":
      return <span>Not connected</span>;
    case "enrolling":
      return <span>Connecting your agent…</span>;
    case "enrolled":
      return (
        <span>
          Connected to <strong className="font-medium text-foreground">{enrollment.target.agentLabel}</strong>
          {enrollment.target.workspaceLabel && (
            <> in {enrollment.target.workspaceLabel}</>
          )}
        </span>
      );
    case "forbidden":
      return <span>{enrollment.message ?? "You cannot connect this agent."}</span>;
    case "error":
      return <span>{enrollment.message ?? "Could not check agent access."}</span>;
  }
}

function RouteStatus({
  enrollment,
  route,
}: {
  enrollment: AgentEnrollmentViewState;
  route: SharedMessagingRouteViewState;
}) {
  switch (route.status) {
    case "checking":
      return <span>Checking messaging…</span>;
    case "pending":
      return <span>{route.message ?? "Setting up messaging…"}</span>;
    case "ready":
      return enrollment.status === "enrolled" ? (
        <span>
          Ready on <strong className="font-medium text-foreground">{route.channelLabel}</strong>
          <span className="block break-words">{route.destinationLabel}</span>
        </span>
      ) : enrollment.status === "eligible" ? (
        <span>Connect your agent to use messaging.</span>
      ) : (
        <span>Agent connection is unconfirmed.</span>
      );
    case "unavailable":
      return <span>{route.message ?? "Messaging is unavailable right now."}</span>;
    case "forbidden":
      return <span>{route.message ?? "You cannot use messaging in this app."}</span>;
    case "error":
      return <span>{route.message ?? "Could not check messaging."}</span>;
  }
}

export function AgentMessagingConnection({
  enrollment,
  route,
  onEnroll,
  onOpenMessages,
  onRetry,
  className,
}: AgentMessagingConnectionProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const submittingRef = React.useRef(false);
  const canMessage = enrollment.status === "enrolled" && route.status === "ready";
  const canRetry = enrollment.status === "error" || route.status === "error";

  React.useEffect(() => {
    setActionError(null);
  }, [enrollment.status, route.status]);

  async function enroll() {
    if (enrollment.status !== "eligible" || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await onEnroll();
    } catch {
      // The host may return a sanitized explanation through `enrollment`.
      setActionError("Could not connect the agent. Try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function retry() {
    if (!onRetry || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await onRetry();
    } catch {
      setActionError("Could not check messaging. Try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Agent messaging connection"
      className={cn("rounded-xl border border-border bg-card p-4 text-sm text-foreground sm:p-5", className)}
    >
      <h2 className="mb-4 text-base font-semibold">Agent messaging</h2>

      <div className="divide-y divide-border rounded-lg border border-border">
        <div className="flex gap-3 p-3 sm:p-4">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium">Private agent</p>
            <p aria-live="polite" className="mt-0.5 break-words text-muted-foreground">
              <AgentStatus enrollment={enrollment} />
            </p>
          </div>
          {enrollment.status === "enrolled" && (
            <CheckCircle2 aria-label="Connected" className="ml-auto h-4 w-4 shrink-0 text-[var(--code-success)]" />
          )}
        </div>

        <div className="flex gap-3 p-3 sm:p-4">
          <MessageSquare aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium">Messaging</p>
            <p aria-live="polite" className="mt-0.5 break-words text-muted-foreground">
              <RouteStatus enrollment={enrollment} route={route} />
            </p>
          </div>
          {canMessage && (
            <CheckCircle2 aria-label="Ready" className="ml-auto h-4 w-4 shrink-0 text-[var(--code-success)]" />
          )}
        </div>
      </div>

      {(enrollment.status === "eligible" || canMessage || (canRetry && onRetry)) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {enrollment.status === "eligible" && (
            <Button type="button" onClick={enroll} disabled={submitting}>
              {submitting ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Connecting agent…" : "Connect agent"}
            </Button>
          )}
          {canMessage && onOpenMessages && (
            <Button type="button" onClick={onOpenMessages}>
              Open messages
            </Button>
          )}
          {canRetry && onRetry && (
            <Button type="button" variant="outline" onClick={retry} disabled={submitting}>
              {submitting ? "Checking…" : "Check again"}
            </Button>
          )}
        </div>
      )}

      {actionError && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-[var(--code-error)]">
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          {actionError}
        </p>
      )}
    </section>
  );
}
