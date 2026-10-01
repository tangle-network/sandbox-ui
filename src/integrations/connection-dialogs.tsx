"use client";

import * as React from "react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@tangle-network/ui/primitives";
import { cn, focusRing } from "@tangle-network/ui/utils";
import type {
  ApiKeyConnectDialogProps, IntegrationConnectDialogProps, OAuthConnectionParameterDialogProps,
} from "./types";

const fieldClass = cn("h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm disabled:opacity-50", focusRing);

function ConnectionDialog({ children, complete, submitLabel, ...props }: IntegrationConnectDialogProps & {
  complete: boolean; submitLabel: string;
}) {
  const opener = React.useRef<HTMLElement | null>(null);
  const errorId = React.useId();
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto"
      onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
      onCloseAutoFocus={(event) => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); }}
      onEscapeKeyDown={(event) => event.stopPropagation()}>
      <DialogHeader>
        <DialogTitle>Connect {props.title}</DialogTitle>
        <DialogDescription>{props.description ?? "Enter the connection details requested by this application."}</DialogDescription>
      </DialogHeader>
      <form className="min-w-0 space-y-4" aria-busy={props.busy || undefined} aria-describedby={props.error ? errorId : undefined}
        onSubmit={(event) => { event.preventDefault(); if (complete && !props.busy && props.canSubmit !== false) props.onSubmit(); }}>
        {children}
        {props.error ? <p id={errorId} role="alert" className="text-sm text-destructive">{props.error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={!complete || props.busy || props.canSubmit === false}>{props.busy ? "Connecting…" : submitLabel}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function ApiKeyField({ value, onValueChange, busy, error }: Pick<ApiKeyConnectDialogProps, "value" | "onValueChange" | "busy" | "error">) {
  const id = React.useId();
  const [revealed, setRevealed] = React.useState(false);
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-medium">API key</label>
    <div className="flex min-w-0 gap-2">
      <input id={id} type={revealed ? "text" : "password"} value={value} required
        onChange={(event) => onValueChange(event.target.value)} disabled={busy}
        autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={!!error || undefined}
        className={cn(fieldClass, "font-mono")} />
      <Button type="button" variant="outline" aria-label={revealed ? "Hide API key" : "Show API key"}
        aria-pressed={revealed} onClick={() => setRevealed((current) => !current)} disabled={busy}>
        {revealed ? "Hide" : "Show"}
      </Button>
    </div>
  </div>;
}

/** Key bytes remain in owner-controlled value/onValueChange; no request or storage. */
export function ApiKeyConnectDialog(props: ApiKeyConnectDialogProps) {
  return <ConnectionDialog {...props} complete={props.value.trim().length > 0} submitLabel="Connect">
    <ApiKeyField key={props.providerId} value={props.value} onValueChange={props.onValueChange} busy={props.busy} error={props.error} />
    {props.children}
  </ConnectionDialog>;
}

function ParameterFields({ parameters, values, onValueChange, busy, error }: OAuthConnectionParameterDialogProps) {
  const prefix = React.useId();
  return <>{parameters.map((parameter) => {
    const id = `${prefix}-${parameter.key}`;
    return <div key={parameter.key} className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">{parameter.label}</label>
      <input id={id} type="text" value={values[parameter.key] ?? ""}
        onChange={(event) => onValueChange(parameter.key, event.target.value)} required={parameter.required}
        disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false}
        placeholder={parameter.placeholder} aria-invalid={!!error || undefined}
        aria-describedby={parameter.description ? `${id}-hint` : undefined} className={fieldClass} />
      {parameter.description ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{parameter.description}</p> : null}
    </div>;
  })}</>;
}

/** Parameter schema/values and all auth behavior belong to the owner. */
export function OAuthConnectionParameterDialog(props: OAuthConnectionParameterDialogProps) {
  const complete = props.parameters.every((parameter) => !parameter.required || !!props.values[parameter.key]?.trim());
  return <ConnectionDialog {...props} complete={complete} submitLabel="Continue">
    <ParameterFields key={props.providerId} {...props} />
    {props.children}
  </ConnectionDialog>;
}
