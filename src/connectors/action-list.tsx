"use client";

import { Badge, Button, Input } from "@tangle-network/ui/primitives";
import { Check, ChevronDown, ChevronRight, Copy, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { integrationStepYaml } from "./integration-step-yaml";
import { SchemaTable } from "./schema-table";
import type { ConnectorAction } from "./types";

type BadgeVariant = "success" | "warning" | "destructive" | "outline";

const RISK_BADGES: Record<
  NonNullable<ConnectorAction["risk"]>,
  { label: string; variant: BadgeVariant }
> = {
  read: { label: "read", variant: "success" },
  write: { label: "write", variant: "warning" },
  destructive: { label: "destructive", variant: "destructive" },
  unknown: { label: "unclassified", variant: "outline" },
};

function RiskBadge({ risk }: { risk?: ConnectorAction["risk"] }) {
  const badge = RISK_BADGES[risk ?? "unknown"] ?? RISK_BADGES.unknown;
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

/** Copy-to-clipboard button with a transient confirmation. `navigator.clipboard`
 *  is unavailable in insecure contexts (and can reject on a permission denial),
 *  so a failure surfaces a visible "Copy failed" state rather than reverting
 *  silently — the user learns the copy didn't happen and can select the text
 *  manually. */
function CopyButton({
  text,
  label,
  title,
}: {
  text: string;
  label: string;
  title?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    let next: "copied" | "failed";
    try {
      await navigator.clipboard.writeText(text);
      next = "copied";
    } catch (err) {
      console.warn("Clipboard write failed:", err);
      next = "failed";
    }
    setState(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 2000);
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} title={title}>
      {state === "copied" ? (
        <Check className="h-3.5 w-3.5 text-[var(--surface-success-text)]" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </Button>
  );
}

/** Many catalog action titles repeat the provider ("GitHub: Issues Create");
 *  on the provider's own page that prefix is noise, so strip it. */
function actionDisplayTitle(
  action: ConnectorAction,
  providerTitle: string,
): string {
  const title = action.title ?? action.path;
  const prefix = `${providerTitle.toLowerCase()}: `;
  return title.toLowerCase().startsWith(prefix)
    ? title.slice(prefix.length)
    : title;
}

/** One expandable action row: title + risk collapsed; path, schemas, and the
 *  copy/build affordances expanded. */
function ActionRow({
  action,
  title,
  expanded,
  onToggle,
  onBuildWithAssistant,
}: {
  action: ConnectorAction;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onBuildWithAssistant?: (action: ConnectorAction) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-surface-container-high"
      >
        <div className="flex min-w-0 items-center gap-3">
          {expanded ? (
            <ChevronDown
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
            />
          ) : (
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
            />
          )}
          <div className="min-w-0">
            <p className="font-medium text-foreground">{title}</p>
            {!expanded && action.description && (
              <p className="truncate text-muted-foreground text-sm">
                {action.description}
              </p>
            )}
          </div>
        </div>
        <RiskBadge risk={action.risk} />
      </button>

      {expanded && (
        <div className="space-y-4 border-border border-t bg-surface-container-high/40 p-4 pl-11">
          {action.description && (
            <p className="text-muted-foreground text-sm">
              {action.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-surface-container-high px-2 py-1 font-mono text-sm">
              {action.path}
            </code>
            <CopyButton text={action.path} label="Copy path" />
          </div>

          <SchemaTable schema={action.inputSchema} label="Input" />

          {action.outputSchema != null && (
            <details>
              <summary className="cursor-pointer text-muted-foreground text-sm transition-colors hover:text-foreground">
                Output shape (for{" "}
                <code className="rounded bg-surface-container-high px-1 py-0.5 font-mono text-xs">
                  {"${steps[N]…}"}
                </code>{" "}
                expressions)
              </summary>
              <div className="mt-2">
                <SchemaTable schema={action.outputSchema} label="Output" />
              </div>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <CopyButton
              text={integrationStepYaml(action.path, action.inputSchema)}
              label="Copy step YAML"
              title="A ready-to-paste integration.invoke step for a workflow definition's do: list"
            />
            {onBuildWithAssistant && (
              <Button
                type="button"
                size="sm"
                onClick={() => onBuildWithAssistant(action)}
              >
                Build with assistant
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export interface ConnectorActionListProps {
  actions: ConnectorAction[];
  /** Connector display title; a leading "<title>: " prefix is stripped from action titles. */
  providerTitle: string;
  /** Renders the "Build with assistant" button when provided; called with the action. */
  onBuildWithAssistant?: (action: ConnectorAction) => void;
  /** True when the action list may be truncated at the fetch limit — the count renders "N+". */
  maybeTruncated?: boolean;
  className?: string;
}

/**
 * Searchable list of a connector's invokable actions. Each row expands to show
 * the action's path, input/output schemas, and copy/build affordances. Purely
 * presentational — the host supplies the actions and the assistant hook.
 */
export function ConnectorActionList({
  actions,
  providerTitle,
  onBuildWithAssistant,
  maybeTruncated,
  className,
}: ConnectorActionListProps) {
  const [filter, setFilter] = useState("");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  const decorated = useMemo(
    () =>
      actions
        .map((action) => ({
          action,
          title: actionDisplayTitle(action, providerTitle),
        }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [actions, providerTitle],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return decorated;
    return decorated.filter(
      ({ action, title }) =>
        title.toLowerCase().includes(q) ||
        action.path.toLowerCase().includes(q) ||
        (action.description ?? "").toLowerCase().includes(q),
    );
  }, [decorated, filter]);

  if (actions.length === 0) {
    return (
      <section
        className={cn("rounded-lg border border-border bg-card p-6", className)}
      >
        <p className="text-center text-muted-foreground text-sm">
          This connector doesn't expose any invokable actions yet.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <div className="border-border border-b p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter actions"
              aria-label="Filter actions"
              className="pl-8"
            />
          </div>
          <span
            role="status"
            aria-live="polite"
            className="text-muted-foreground text-sm"
          >
            {filtered.length} of {actions.length}
            {maybeTruncated ? "+" : ""} actions
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-muted-foreground text-sm">
            No actions match your filter.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilter("")}
            className="mt-4"
          >
            Clear filter
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map(({ action, title }) => (
            <ActionRow
              key={action.path}
              action={action}
              title={title}
              expanded={expandedPath === action.path}
              onToggle={() =>
                setExpandedPath((current) =>
                  current === action.path ? null : action.path,
                )
              }
              onBuildWithAssistant={onBuildWithAssistant}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
