"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives";
import type { SshKeyOption } from "./provisioning-wizard";

/** Draft handed to the host app's key-creation callback. */
export interface AddSshKeyInput {
  name: string;
  publicKey: string;
}

export interface AddSshKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Persists the key on the host side (POST). Returning the created key
   * — with its id — lets the dialog auto-select it in the wizard.
   */
  onCreateKey: (input: AddSshKeyInput) => Promise<SshKeyOption | void>;
  /**
   * Optional refresh of the host's key list. Called after a successful
   * create so the parent's `keys` source-of-truth includes the new key
   * before we try to select it.
   */
  onRefreshKeys?: () => Promise<SshKeyOption[] | void>;
  /**
   * Fired with the newly created key's id (only when onCreateKey returns
   * one) so the host can select it through onSelectedKeyIdsChange.
   */
  onCreatedKeyId?: (id: string) => void;
}

const NAME_INPUT_ID = "add-ssh-key-name";
const KEY_INPUT_ID = "add-ssh-key-public-key";

// Lightweight SSH public-key shape: `<algorithm> <base64> [comment]`.
// Matches every key type OpenSSH writes to authorized_keys. Intentionally
// lenient on the base64 body (no internal padding decode) — the host's
// POST is the authority; this just catches obvious paste errors.
const SSH_PUBLIC_KEY_PATTERN =
  /^(ssh-rsa|ssh-dss|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ecdsa-sha2-nistp256@openssh\.com|sk-ssh-ed25519@openssh\.com)\s+[A-Za-z0-9+/]+={0,3}(\s+.+)?$/;

/** Validates an SSH public key string; returns an error message or null. */
export function validateSshPublicKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Public key is required";
  if (!SSH_PUBLIC_KEY_PATTERN.test(trimmed))
    return "Enter a valid public key, e.g. ssh-ed25519 AAAAC3NzaC1lZDI1NTE5...";
  return null;
}

interface FieldErrors {
  name: string | null;
  publicKey: string | null;
}

export function AddSshKeyDialog({
  open,
  onOpenChange,
  onCreateKey,
  onRefreshKeys,
  onCreatedKeyId,
}: AddSshKeyDialogProps) {
  const [name, setName] = React.useState("");
  const [publicKey, setPublicKey] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors>({
    name: null,
    publicKey: null,
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const resetForm = React.useCallback(() => {
    setName("");
    setPublicKey("");
    setErrors({ name: null, publicKey: null });
    setSubmitError(null);
  }, []);

  const handleSave = async () => {
    const nameError = name.trim() ? null : "Name is required";
    const keyError = validateSshPublicKey(publicKey);
    if (nameError || keyError) {
      setErrors({ name: nameError, publicKey: keyError });
      return;
    }
    setIsSaving(true);
    setSubmitError(null);
    try {
      const created = await onCreateKey({
        name: name.trim(),
        publicKey: publicKey.trim(),
      });
      // Refresh the parent's list first so the new key is present before
      // we ask to select it. The parent owns the `keys` prop — we never
      // mutate it directly, only signal the selection by id.
      if (onRefreshKeys) {
        await onRefreshKeys();
      }
      if (created && created.id) {
        onCreatedKeyId?.(created.id);
      }
      resetForm();
      onOpenChange(false);
    } catch (err) {
      // Keep the dialog open and the draft intact so the user can retry.
      setSubmitError(
        err instanceof Error ? err.message : "Failed to add SSH key",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSaving) handleSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add SSH key</DialogTitle>
          <DialogDescription>
            Save a public key to your account. It will be available to select
            for this and future sandboxes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor={NAME_INPUT_ID}
              className="block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
            >
              Name
            </label>
            <input
              id={NAME_INPUT_ID}
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My laptop"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={KEY_INPUT_ID}
              className="block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
            >
              Public key
            </label>
            <textarea
              id={KEY_INPUT_ID}
              name="public-key"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
              autoComplete="off"
              spellCheck={false}
              aria-invalid={errors.publicKey ? true : undefined}
              className="min-h-24 w-full resize-y rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {errors.publicKey && (
              <p className="text-xs text-destructive">{errors.publicKey}</p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}

          {/* Hidden submit keeps implicit Enter-key submission working
              even though the visible action button lives in the footer. */}
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">
            Submit
          </button>
        </form>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : "Add key"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
