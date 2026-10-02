"use client";

import { Button } from "@tangle-network/ui/primitives";
import { cn, focusRing } from "@tangle-network/ui/utils";
import { ConnectionSelector } from "./integrations-catalog";
import { ProviderIcon } from "./provider-logo";
import type { IntegrationConnectionDetailProps, IntegrationPermissionGroup } from "./types";

/** Platform's permission layout, without its fetching, defaults or persistence. */
export function IntegrationConnectionDetail({
  provider, connections, selectedConnectionId, onSelectConnection, detailsByConnectionId,
  loading, error, backHref, description, onRetry, onTestConnection, onDisconnect,
  onDecisionChange, onResetDecision, className,
}: IntegrationConnectionDetailProps) {
  const connection = connections.find((item) => item.id === selectedConnectionId);
  const details = connection && Object.hasOwn(detailsByConnectionId, connection.id)
    ? detailsByConnectionId[connection.id] : undefined;
  const busy = !!details?.busy;
  const groups = details?.permissionGroups;
  const failure = error ?? details?.error;
  const renderRows = (group: IntegrationPermissionGroup) => (
    <ul className="divide-y divide-border">
      {group.rows.map((row) => {
        const known = row.decision !== null && row.decisionOptions.some((option) => option.value === row.decision);
        const editable = connection?.capabilities.editPermissions && onDecisionChange;
        return <li key={row.actionPath} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={cn("rounded border border-border px-2 py-0.5 text-xs", row.riskTone === "error" ? "text-destructive" : "text-muted-foreground")}>{row.riskLabel}</span>
              <span className="min-w-0 break-words text-sm font-medium">{row.title}</span>
            </div>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{row.actionPath}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
            <span className="text-xs text-muted-foreground">{row.sourceLabel}</span>
            {editable ? <select
              aria-label={`Decision for ${row.actionPath}`} value={known ? row.decision! : ""}
              disabled={busy || row.disabled}
              onChange={(event) => { if (connection && row.decisionOptions.some((option) => option.value === event.target.value)) onDecisionChange?.(connection.id, row.actionPath, event.target.value); }}
              className={cn("h-9 rounded-md border border-border bg-background px-2 text-sm", focusRing)}>
              {!known ? <option value="" disabled>Not available</option> : null}
              {row.decisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select> : <span className="text-sm">{known ? row.decisionOptions.find((option) => option.value === row.decision)?.label : "Not available"}</span>}
            {row.canReset && connection?.capabilities.resetPermissions && onResetDecision ?
              <Button variant="outline" disabled={busy || row.disabled} aria-label={`Reset ${row.actionPath}`} onClick={() => onResetDecision(connection.id, row.actionPath)}>Reset</Button> : null}
          </div>
        </li>;
      })}
    </ul>
  );

  return <section className={cn("w-full min-w-0 space-y-4", className)} aria-label={`${provider.title} connection settings`}
    data-testid="integration-connection-detail" aria-busy={loading || details?.loading || undefined}>
    {backHref ? <a href={backHref} className={cn("inline-flex text-sm text-muted-foreground hover:text-foreground", focusRing)}>← Integrations</a> : null}
    <header className="flex min-w-0 items-start gap-3">
      <ProviderIcon id={provider.providerId} iconUrl={provider.iconUrl} displayName={provider.title} size={48} />
      <div className="min-w-0"><h2 className="break-words text-xl font-semibold">{provider.title} connection settings</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>
    </header>
    <ConnectionSelector connections={connections} value={selectedConnectionId} onChange={onSelectConnection} label={`Account for ${provider.title}`} />
    <div className="min-h-[200px] min-w-0 space-y-4" key={connection?.id ?? "unselected"}>
      {failure ? <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
        <p>{failure}</p>{onRetry ? <Button variant="outline" onClick={() => onRetry(connection?.id ?? null)}>Retry</Button> : null}
      </div> : null}
      {loading && !connection ? <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading connections…</p> :
        !connection ? <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {connections.length ? "Select a connected account to view its settings." : "No connected accounts are available."}
        </p> : <>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="min-w-0"><p className="break-words text-sm font-medium">{connection.accountDisplay ?? connection.id}</p>
              <p className="text-sm text-muted-foreground">{connection.statusLabel}</p>
              {connection.detail ? <p className="mt-1 text-sm text-muted-foreground">{connection.detail}</p> : null}</div>
            <div className="flex flex-wrap gap-2">
              {connection.capabilities.test && onTestConnection ? <Button variant="outline" disabled={busy} onClick={() => onTestConnection(connection.id)}>Test connection</Button> : null}
              {connection.capabilities.disconnect && onDisconnect ? <Button variant="destructive" disabled={busy} onClick={() => onDisconnect(connection.id)}>Disconnect</Button> : null}
            </div>
          </div>
          {details?.testResult ? <p role={details.testResult.tone === "error" ? "alert" : "status"} className={cn("text-sm", details.testResult.tone === "error" ? "text-destructive" : "text-muted-foreground")}>{details.testResult.message}</p> : null}
          {details?.loading ? <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading connection settings…</p> :
            !groups ? <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Connection settings are not available yet.</p> :
              groups.every((group) => group.rows.length === 0) ? <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No actions are available for this connection.</p> :
                groups.map((group) => group.collapsed ? (
                  <details key={group.id} className="min-w-0 rounded-xl border border-border bg-card">
                    <summary className={cn("cursor-pointer rounded-xl p-4 font-medium", focusRing)}>{group.title} ({group.rows.length})</summary>
                    {group.description ? <p className="px-4 pb-4 text-sm text-muted-foreground">{group.description}</p> : null}
                    {renderRows(group)}
                  </details>
                ) : (
                  <section key={group.id} className="min-w-0 rounded-xl border border-border bg-card">
                    <div className="border-b border-border p-4"><h3 className="font-medium">{group.title}</h3>
                      {group.description ? <p className="mt-1 text-sm text-muted-foreground">{group.description}</p> : null}</div>
                    {renderRows(group)}
                  </section>
                ))}
        </>}
    </div>
  </section>;
}
