"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import {
  AgentSessionControls,
  type AgentSessionHarnessControl,
  type AgentSessionModelControl,
  type AgentSessionProfileControl,
  type AgentSessionReasoningControl,
} from "./agent-session-controls";

export interface AgentComposerProps {
  /** Composer text (controlled). */
  value: string;
  onChange: (value: string) => void;
  /** Fired on Enter (without Shift) or the send button. */
  onSubmit: () => void;
  placeholder?: string;
  /** Disables typing and sending — e.g. while a turn is streaming. */
  disabled?: boolean;
  /** Spins the send button and blocks submit, without disabling the textarea. */
  busy?: boolean;
  /**
   * Agent backend. Present → sandbox-backed (the harness pill shows and snaps
   * with the model); omitted → router-backed (no harness, just model/effort).
   */
  harness?: AgentSessionHarnessControl;
  /** Agent profile (mode / toolset / persona) — universal across both modes. */
  profile?: AgentSessionProfileControl;
  model?: AgentSessionModelControl;
  reasoning?: AgentSessionReasoningControl;
  /** Forwarded to the control strip (chat hides shell-only harnesses). */
  context?: "chat" | "all";
  /** Extra content left of the send button (token meter, cost, status). */
  trailing?: React.ReactNode;
  /** Minimum textarea rows before it grows. Default 2. */
  minRows?: number;
  /** Max pixel height before the textarea scrolls. Default 200. */
  maxHeight?: number;
  className?: string;
  sendLabel?: string;
  autoFocus?: boolean;
}

/**
 * The canonical agent chat input: one rounded surface holding an auto-growing
 * textarea, the embedded control strip (profile · harness · model · effort) at
 * the bottom-left, and the send button at the bottom-right. The strip's pickers
 * snap the harness↔model pair automatically; which controls appear is driven
 * purely by which control objects are passed, so the same component is the
 * router-backed composer (no harness) and the sandbox-backed one (with harness).
 */
export function AgentComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Send a message…",
  disabled,
  busy,
  harness,
  profile,
  model,
  reasoning,
  context = "chat",
  trailing,
  minRows = 2,
  maxHeight = 200,
  className,
  sendLabel = "Send",
  autoFocus,
}: AgentComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resize = React.useCallback(
    (el: HTMLTextAreaElement) => {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    },
    [maxHeight],
  );

  // Keep the height in sync when the value changes from outside (e.g. cleared
  // after send) — not just on user input.
  React.useEffect(() => {
    if (textareaRef.current) resize(textareaRef.current);
  }, [value, resize]);

  const canSend = !disabled && !busy && value.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSubmit();
  };

  return (
    <div
      data-testid="agent-composer"
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-[var(--md3-outline-variant)] bg-surface-container-high p-2.5 shadow-sm transition-colors",
        "focus-within:border-primary/60",
        disabled && "opacity-60",
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        rows={minRows}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onInput={(event) => resize(event.currentTarget)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== 229
          ) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full resize-none bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground outline-none",
          "placeholder:text-muted-foreground",
        )}
      />
      <div className="flex items-end gap-2">
        <AgentSessionControls
          className="min-w-0 flex-1"
          context={context}
          harness={harness}
          profile={profile}
          model={model}
          reasoning={reasoning}
        />
        {trailing && (
          <div className="flex shrink-0 items-center gap-2">{trailing}</div>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={sendLabel}
          className={cn(
            "ml-auto flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
            "transition-opacity hover:opacity-90 disabled:opacity-40",
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
