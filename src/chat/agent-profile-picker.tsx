"use client";

import { Bot, Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import { useClickOutside } from "../lib/use-click-outside";
import { InformativeLock } from "./informative-lock";

/**
 * An agent profile: a named bundle of toolset + persona layered over the same
 * model and session. `builtin` profiles are the product's shipped modes (e.g.
 * Studio / Assistant); the rest are user-saved custom agents. The concept is
 * backend-agnostic — it applies to a router-backed agent and a sandbox-backed
 * one alike, which is why it lives beside the model control rather than under
 * the harness.
 */
export interface AgentProfileOption {
  id: string;
  name: string;
  /** Builtin: a one-line description. Custom: derived "N tools" if omitted. */
  description?: string;
  /** Capability/tool-group ids this profile enables. */
  capabilities?: ReadonlyArray<string>;
  /** Persona / extra system instructions. */
  instructions?: string;
  /** A shipped mode vs a user-saved custom agent. */
  builtin?: boolean;
}

/** A selectable tool group offered by the create/edit form. */
export interface AgentProfileCapability {
  id: string;
  label: string;
  description?: string;
}

/** The editable shape the create/edit form emits. */
export interface AgentProfileDraft {
  id?: string;
  name: string;
  capabilities: string[];
  instructions: string;
}

export interface AgentProfilePickerProps {
  /** Selected profile id. */
  value: string;
  onChange: (id: string) => void;
  profiles: ReadonlyArray<AgentProfileOption>;
  /**
   * Tool catalog for the create/edit form. Provide together with at least one
   * write callback to enable authoring custom agents; omit for a
   * selection-only picker (the New / edit / delete affordances stay hidden).
   */
  capabilities?: ReadonlyArray<AgentProfileCapability>;
  onCreate?: (draft: AgentProfileDraft) => void | Promise<void>;
  onUpdate?: (id: string, draft: AgentProfileDraft) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  disabled?: boolean;
  /** Keep the pinned profile visible while preventing profile selection. */
  locked?: boolean;
  /** Tooltip shown on the locked trigger when no `onNewChat` is provided. */
  lockReason?: string;
  /** Offer a fresh chat from the informative lock popover. */
  onNewChat?: () => void;
  className?: string;
  /** Additional classes for the picker trigger. */
  triggerClassName?: string;
  /** Additional classes for the profile popover. */
  popoverClassName?: string;
  /** Side the menu opens toward. Defaults to up (composer-anchored). */
  side?: "top" | "bottom";
}

function profileSubtitle(profile: AgentProfileOption): string {
  if (profile.description) return profile.description;
  const count = profile.capabilities?.length ?? 0;
  return `${count} ${count === 1 ? "tool group" : "tool groups"}`;
}

/**
 * Agent / mode switcher styled to match the chat control strip's pills
 * (harness, model, effort). The pill shows the active profile; the menu lists
 * builtin modes and saved custom agents. When a capability catalog and a write
 * callback are supplied it also authors agents inline (name + tool toggles +
 * persona) — a self-contained click-outside popover rather than a Radix menu,
 * because the inline form needs its own focus and typing without the menu
 * stealing keystrokes.
 */
export function AgentProfilePicker({
  value,
  onChange,
  profiles,
  capabilities,
  onCreate,
  onUpdate,
  onDelete,
  disabled,
  locked,
  lockReason,
  onNewChat,
  className,
  triggerClassName,
  popoverClassName,
  side = "top",
}: AgentProfilePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [composing, setComposing] = React.useState<AgentProfileOption | "new" | null>(
    null,
  );
  const ref = useClickOutside<HTMLDivElement>(() => {
    setOpen(false);
    setComposing(null);
  });

  const canAuthor = Boolean(capabilities && (onCreate || onUpdate));
  const builtins = profiles.filter((profile) => profile.builtin);
  const custom = profiles.filter((profile) => !profile.builtin);
  const selected = profiles.find((profile) => profile.id === value);
  const selectedName = selected?.name ?? value;

  React.useEffect(() => {
    if (!locked) return;
    setOpen(false);
    setComposing(null);
  }, [locked]);

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  async function save(draft: AgentProfileDraft) {
    if (draft.id) await onUpdate?.(draft.id, draft);
    else await onCreate?.(draft);
    setComposing(null);
  }

  if (locked && onNewChat) {
    return (
      <InformativeLock
        ariaLabel="Agent profile (locked)"
        lockTitle={`Profile fixed to ${selectedName} for this conversation.`}
        lockBody="Conversations stay on one profile."
        newChatLabel="New chat to switch profile"
        onNewChat={onNewChat}
        className={className}
        triggerClassName={triggerClassName}
        popoverClassName={popoverClassName}
        side={side}
      >
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-[140px] truncate">{selectedName}</span>
      </InformativeLock>
    );
  }

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        disabled={disabled || locked}
        title={locked ? lockReason : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container px-2.5",
          "text-xs font-medium text-foreground shadow-sm transition-colors",
          "hover:border-[var(--md3-outline-variant)] hover:bg-surface-container-high focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "data-[state=open]:border-[var(--md3-outline-variant)] data-[state=open]:bg-surface-container-high",
          "disabled:cursor-not-allowed disabled:opacity-60",
          triggerClassName,
        )}
        data-state={open ? "open" : "closed"}
        aria-label="Agent profile"
      >
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-[140px] truncate">{selectedName}</span>
        {!locked && (
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && !locked && (
        <div
          className={cn(
            "absolute left-0 z-50 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-md)] border border-[var(--md3-outline-variant)] bg-surface-container-highest p-1",
            "shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-[#ffffff14]",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
            popoverClassName,
          )}
          data-testid="agent-profile-popover"
        >
          {composing ? (
            <ProfileForm
              capabilities={capabilities ?? []}
              initial={composing === "new" ? undefined : composing}
              onCancel={() => setComposing(null)}
              onSave={save}
            />
          ) : (
            <div className="max-h-[min(60vh,420px)] overflow-y-auto">
              <SectionHeader>Modes</SectionHeader>
              {builtins.map((profile) => (
                <ProfileRow
                  key={profile.id}
                  active={profile.id === value}
                  title={profile.name}
                  subtitle={profileSubtitle(profile)}
                  onSelect={() => select(profile.id)}
                />
              ))}
              {custom.length > 0 && <SectionHeader>Your agents</SectionHeader>}
              {custom.map((profile) => (
                <ProfileRow
                  key={profile.id}
                  active={profile.id === value}
                  title={profile.name}
                  subtitle={profileSubtitle(profile)}
                  onSelect={() => select(profile.id)}
                  onEdit={canAuthor ? () => setComposing(profile) : undefined}
                  onDelete={onDelete ? () => void onDelete(profile.id) : undefined}
                />
              ))}
              {canAuthor && (
                <button
                  type="button"
                  onClick={() => setComposing("new")}
                  className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-[var(--accent-text)] transition-colors hover:bg-accent/40"
                >
                  <Plus className="h-4 w-4" /> New agent…
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
      {children}
    </div>
  );
}

function ProfileRow({
  active,
  title,
  subtitle,
  onSelect,
  onEdit,
  onDelete,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-[var(--accent-surface-soft)] text-[var(--accent-text)]"
          : "hover:bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {active && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </button>
      {(onEdit || onDelete) && (
        <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="rounded p-1 text-muted-foreground hover:text-[var(--status-error,#ff4d6d)]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function ProfileForm({
  capabilities,
  initial,
  onCancel,
  onSave,
}: {
  capabilities: ReadonlyArray<AgentProfileCapability>;
  initial?: AgentProfileOption;
  onCancel: () => void;
  onSave: (draft: AgentProfileDraft) => void;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [caps, setCaps] = React.useState<string[]>(
    initial?.capabilities ? [...initial.capabilities] : capabilities.map((c) => c.id),
  );
  const [instructions, setInstructions] = React.useState(initial?.instructions ?? "");

  const toggle = (id: string) =>
    setCaps((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  return (
    <div className="space-y-3 p-2.5">
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Agent name (e.g. Tax Reviewer)"
        className="w-full rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {capabilities.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Tools
          </p>
          <div className="space-y-0.5">
            {capabilities.map((cap) => (
              <label
                key={cap.id}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40"
              >
                <input
                  type="checkbox"
                  checked={caps.includes(cap.id)}
                  onChange={() => toggle(cap.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{cap.label}</span>
                  {cap.description && (
                    <span className="block text-xs text-muted-foreground">
                      {cap.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <textarea
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        rows={2}
        placeholder="Instructions (optional) — how this agent should behave"
        className="w-full resize-none rounded-lg border border-[var(--md3-outline-variant)] bg-surface-container px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              id: initial?.id,
              name: name.trim(),
              capabilities: caps,
              instructions: instructions.trim(),
            })
          }
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Save agent
        </button>
      </div>
    </div>
  );
}
