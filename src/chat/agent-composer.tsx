"use client";

import {
  ArrowUp,
  Folder,
  Loader2,
  Paperclip,
  RotateCcw,
  Square,
  Upload,
  X,
} from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import {
  validateComposerFiles,
  type ComposerFileRejection,
} from "./attachment-validation";

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

/** Matches the generic names browsers give clipboard-pasted bitmaps. */
function isGenericImageName(name: string): boolean {
  return /^(image)?(\.[a-z0-9]+)?$/i.test(name.trim());
}

function imageExtension(file: File): string {
  const fromMime = IMAGE_EXTENSION_BY_MIME[file.type.toLowerCase()];
  if (fromMime) return fromMime;
  const fromName = /\.([a-z0-9]+)$/i.exec(file.name)?.[1];
  return fromName?.toLowerCase() ?? "png";
}

/** A selectable item in the `@`-mention popover. Generic — file semantics live
 * in the consuming app, not here. */
export interface MentionItem {
  id: string;
  label: string;
  detail?: string;
  kind?: string;
}

/**
 * Opt-in `@`-mention support. Present ⇒ the composer swaps its textarea for a
 * TipTap rich input that renders mentions as atomic pills; absent ⇒ exactly
 * today's plain-textarea behavior. Data-agnostic: the app supplies items.
 */
export interface AgentComposerMention {
  /** The character that opens the popover. Default "@". */
  trigger?: string;
  /** Async provider called with the query typed after the trigger. */
  fetchItems: (query: string) => Promise<MentionItem[]>;
  /** Fired with the mentions currently in the document whenever they change. */
  onMentionsChange?: (mentions: MentionItem[]) => void;
  /** Custom row renderer for a popover item. */
  renderItem?: (item: MentionItem) => React.ReactNode;
  /** Shown when a fetch resolves to zero items. Default "No matches". */
  emptyText?: string;
  /**
   * Extra classes merged onto the suggestion popover's root element
   * (`role="listbox"`), applied last so they win over the component's own —
   * the supported way to retheme the popover instead of targeting it by its
   * ARIA attributes.
   */
  popoverClassName?: string;
}

/**
 * The TipTap editor is a lazy chunk: only consumers that pass `mention` pull
 * the editor stack into their bundle, and only when the mention path renders.
 */
const MentionEditor = React.lazy(() => import("./mention-editor"));

/** A staged attachment shown as a chip above the input. */
export interface ComposerFile {
  id: string;
  name: string;
  size?: number;
  kind: "file" | "folder";
  /** File count for a folder chip. */
  fileCount?: number;
  status: "pending" | "uploading" | "ready" | "error";
  /**
   * Object URL for an image thumbnail. The app owns creation and revocation
   * (e.g. `URL.createObjectURL` on stage, `URL.revokeObjectURL` on remove) —
   * the composer only ever reads it.
   */
  previewUrl?: string;
  /** Shown on the chip when `status === "error"`. */
  errorMessage?: string;
}

export interface AgentComposerProps {
  /** Composer text (controlled). */
  value: string;
  onChange: (value: string) => void;
  /** Fired on Enter (without Shift) or the send button. */
  onSubmit: () => void;
  placeholder?: string;
  /** Disables typing and sending — e.g. while restoring. */
  disabled?: boolean;
  /**
   * A turn is in flight. Spins the send button; paired with `onCancel` it
   * becomes a Stop button instead, so the user can interrupt the stream.
   */
  busy?: boolean;
  /** Stop the in-flight turn. With `busy`, replaces send with a Stop button. */
  onCancel?: () => void;
  /**
   * The composer's control strip (profile · harness · model · effort pickers,
   * token meters, …), rendered in the bottom row. Required — the legacy
   * built-in strip was removed with the legacy pickers: pass
   * `AgentSessionControls` from `@tangle-network/agent-app/web-react` (or your
   * own composition), or `null` for a bare composer.
   */
  controls: React.ReactNode;
  /** Extra content left of the send button (token meter, cost, status). */
  trailing?: React.ReactNode;

  /**
   * Attachments are opt-in: pass `onAttach` to show the attach button, accept
   * drag-and-drop onto the composer, and render `attachments` as chips.
   */
  onAttach?: (files: FileList) => void;
  /** Show a folder-attach button; falls back to `onAttach` if unset. */
  onAttachFolder?: (files: FileList) => void;
  attachments?: ReadonlyArray<ComposerFile>;
  onRemoveFile?: (id: string) => void;
  /** When set, chips with `status === "error"` render a retry button. */
  onRetryFile?: (id: string) => void;
  /**
   * File types the composer takes, in the native `<input accept>` grammar.
   * Enforced on every ingress path — the picker dialog, drag-and-drop, and
   * clipboard paste — so a type the picker won't offer can't arrive by another
   * route. Non-matching files go to `onRejectFiles` and never reach
   * `onAttach`. Folder attach is exempt (directory selection has no native
   * accept semantics); size/count limits are the app's job in `onAttach`.
   */
  accept?: string;
  /**
   * Called with the files `accept` filtered out of a drop/paste/pick, each
   * with a human-readable reason. Without it rejection is silent — the same
   * feedback the native picker gives for a type it won't offer.
   */
  onRejectFiles?: (rejections: ComposerFileRejection[]) => void;
  dropTitle?: string;
  dropDescription?: string;

  /**
   * `canSend` ignores `busy` so Enter/onSubmit keep firing while a turn is
   * streaming. For composers that queue the next turn instead of blocking on
   * the current one — the Stop-button rendering rule (`busy && onCancel`) is
   * unaffected, so the button still flips to Stop while this is set. Default
   * false.
   */
  canSubmitWhileBusy?: boolean;

  /**
   * Allow submitting with empty text when at least one attachment is staged
   * (an image-only message). Counts attachments of ANY status — a gate on
   * `ready` would make Enter silently dead while an upload is in flight,
   * with no way for the app to explain why. The app's onSubmit owns the send
   * policy (block, queue, or toast on pending/errored files) and what the
   * message body becomes. Default false.
   */
  canSubmitAttachmentsOnly?: boolean;

  /**
   * Opt-in `@`-mentions. When set, the textarea is replaced by a rich input
   * that renders mentions as atomic pills and serializes them to `@<id>` in
   * `value`. Omit for exactly today's plain-textarea behavior.
   */
  mention?: AgentComposerMention;

  /** Cmd/Ctrl+L focuses the input and shows a hint. Default false. */
  focusShortcut?: boolean;
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
 * textarea and a bottom row that runs left → right — attach buttons, the
 * control strip (supplied via the required `controls` prop), trailing slot,
 * and the send button on the far right. The strip is explicit: the canonical
 * pickers are `ModelPicker` / `EffortPicker` / `AgentSessionControls` from
 * `@tangle-network/agent-app/web-react` — this component only owns the slot.
 *
 * Opt-in extras make it the superset of every app's hand-rolled composer:
 * file/folder attachments with drag-and-drop + chips + clipboard paste
 * (`onAttach` also gates pasting files onto the textarea, auto-naming
 * generic clipboard image blobs `pasted-image-<n>.<ext>`), a streaming Stop
 * button (`busy` + `onCancel`), and a Cmd/Ctrl+L focus shortcut.
 */
export function AgentComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Send a message…",
  disabled,
  busy,
  onCancel,
  controls,
  trailing,
  onAttach,
  onAttachFolder,
  attachments = [],
  onRemoveFile,
  onRetryFile,
  accept,
  onRejectFiles,
  dropTitle = "Drop files to add context",
  dropDescription = "They attach to your next message.",
  canSubmitWhileBusy = false,
  canSubmitAttachmentsOnly = false,
  mention,
  focusShortcut = false,
  minRows = 2,
  maxHeight = 200,
  className,
  sendLabel = "Send",
  autoFocus,
}: AgentComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  // Set by the mention editor so the focus shortcut reaches it in the rich path.
  const richFocusRef = React.useRef<(() => void) | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const dragDepth = React.useRef(0);
  const pastedImageCount = React.useRef(0);

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

  // Cmd/Ctrl+L focuses the composer from anywhere, matching the advertised hint.
  React.useEffect(() => {
    if (!focusShortcut || disabled) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        if (mention) richFocusRef.current?.();
        else textareaRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusShortcut, disabled, mention]);

  const canSend =
    !disabled &&
    (!busy || canSubmitWhileBusy) &&
    (value.trim().length > 0 ||
      (canSubmitAttachmentsOnly && attachments.length > 0));

  const submit = () => {
    if (!canSend) return;
    onSubmit();
  };

  // Stable identity so the mention editor's registration effect only reruns
  // when the editor instance itself changes, not on every parent render.
  const registerRichFocus = React.useCallback((focus: () => void) => {
    richFocusRef.current = focus;
  }, []);

  const dropEnabled = Boolean(onAttach);

  const handleDragEnter = (event: React.DragEvent) => {
    if (!dropEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current++;
    if (event.dataTransfer?.types.includes("Files")) setDragOver(true);
  };
  const handleDragLeave = (event: React.DragEvent) => {
    if (!dropEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current--;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragOver(false);
    }
  };
  const handleDragOver = (event: React.DragEvent) => {
    if (!dropEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };
  // Single funnel for every file ingress (picker, drop, paste): enforce
  // `accept`, report the rest, hand `onAttach` only what passed.
  const deliverFiles = (files: File[]) => {
    if (!onAttach || files.length === 0) return;
    const { accepted, rejected } = validateComposerFiles(files, { accept });
    if (rejected.length > 0) onRejectFiles?.(rejected);
    if (accepted.length === 0) return;
    const dt = new DataTransfer();
    for (const file of accepted) dt.items.add(file);
    onAttach(dt.files);
  };

  const handleDrop = (event: React.DragEvent) => {
    if (!dropEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    const files = event.dataTransfer?.files;
    if (files?.length) deliverFiles(Array.from(files));
  };

  // Auto-name generic clipboard image blobs so a paste of the same bitmap
  // twice doesn't collide on `image.png`.
  const renamePastedFiles = (files: File[]): File[] =>
    files.map((file) => {
      if (file.type.startsWith("image/") && isGenericImageName(file.name)) {
        pastedImageCount.current += 1;
        return new File(
          [file],
          `pasted-image-${pastedImageCount.current}.${imageExtension(file)}`,
          { type: file.type },
        );
      }
      return file;
    });

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onAttach) return;
    const clipboardFiles = event.clipboardData?.files;
    if (!clipboardFiles || clipboardFiles.length === 0) return;

    // Files are the payload — suppress the default text paste even when every
    // file is rejected, so a rejection never half-pastes stray text.
    event.preventDefault();
    deliverFiles(renamePastedFiles(Array.from(clipboardFiles)));
  };

  // The rich-input equivalent of `handlePaste`: returns true when clipboard
  // files were the payload so the editor suppresses its default text paste.
  const handleEditorPasteFiles = (clipboardFiles: FileList): boolean => {
    if (!onAttach || clipboardFiles.length === 0) return false;
    deliverFiles(renamePastedFiles(Array.from(clipboardFiles)));
    return true;
  };

  const folderChips = attachments.filter((file) => file.kind === "folder");
  const fileChips = attachments.filter((file) => file.kind !== "folder");

  const attachButtonClass = cn(
    "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors",
    "hover:bg-surface-container-highest hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <div className={cn("relative", className)}>
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 bg-surface-container-high/95">
          <div className="text-center">
            <span className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="size-5" />
            </span>
            <p className="font-semibold text-foreground text-sm">{dropTitle}</p>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {dropDescription}
            </p>
          </div>
        </div>
      )}

      <div
        data-testid="agent-composer"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col gap-2 rounded-2xl border border-[var(--md3-outline-variant)] bg-surface-container-high p-2.5 shadow-sm transition-colors",
          "focus-within:border-primary/60",
          disabled && "opacity-60",
        )}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...folderChips, ...fileChips].map((file) => {
              const isError = file.status === "error";
              const isPending = file.status === "pending";
              return (
                <span
                  key={file.id}
                  title={isError ? file.errorMessage : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    isError
                      ? "border-[var(--status-error,#ff4d6d)]/40 text-[var(--status-error,#ff4d6d)]"
                      : "border-[var(--md3-outline-variant)] bg-surface-container text-foreground",
                    isPending && "opacity-60",
                  )}
                >
                  {file.kind !== "folder" && file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt=""
                      className="size-8 rounded object-cover"
                    />
                  ) : file.kind === "folder" ? (
                    <Folder className="size-3 shrink-0" />
                  ) : (
                    <Paperclip className="size-3 shrink-0" />
                  )}
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  {file.fileCount !== undefined && (
                    <span className="text-muted-foreground">
                      ({file.fileCount})
                    </span>
                  )}
                  {file.status === "uploading" && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  {isError && file.errorMessage && (
                    <span className="max-w-[150px] truncate text-[var(--status-error,#ff4d6d)]/80">
                      {file.errorMessage}
                    </span>
                  )}
                  {isError && onRetryFile && (
                    <button
                      type="button"
                      aria-label={`Retry upload ${file.name}`}
                      onClick={() => onRetryFile(file.id)}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  )}
                  {onRemoveFile && (
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => onRemoveFile(file.id)}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {mention ? (
          <React.Suspense
            fallback={
              <textarea
                rows={minRows}
                value={value}
                disabled
                placeholder={placeholder}
                aria-label="Message input"
                className={cn(
                  "w-full resize-none bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground outline-none",
                  "placeholder:text-muted-foreground",
                )}
              />
            }
          >
            <MentionEditor
              value={value}
              onChange={onChange}
              onSubmit={submit}
              placeholder={placeholder}
              disabled={disabled}
              autoFocus={autoFocus}
              minRows={minRows}
              maxHeight={maxHeight}
              mention={mention}
              registerFocus={registerRichFocus}
              onPasteFiles={onAttach ? handleEditorPasteFiles : undefined}
            />
          </React.Suspense>
        ) : (
          <textarea
            ref={textareaRef}
            rows={minRows}
            value={value}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={(event) => onChange(event.target.value)}
            onInput={(event) => resize(event.currentTarget)}
            onPaste={handlePaste}
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
            aria-label="Message input"
            className={cn(
              "w-full resize-none bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground outline-none",
              "placeholder:text-muted-foreground",
            )}
          />
        )}

        {/* Bottom row, left → right: attach · folder · control strip
            (profile · harness · model · effort) · trailing · send. The attach
            buttons lead so the paperclip sits at the far left, ahead of the
            control pickers. */}
        <div className="flex items-end gap-2">
          {onAttach && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                aria-label="Attach files"
                title="Attach files"
                className={attachButtonClass}
              >
                <Paperclip className="size-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept={accept}
                onChange={(event) => {
                  // Re-filter: picker dialogs let the user override the
                  // accept filter with "All Files".
                  if (event.target.files?.length)
                    deliverFiles(Array.from(event.target.files));
                  event.target.value = "";
                }}
              />
            </>
          )}
          {onAttachFolder && (
            <>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={disabled}
                aria-label="Attach folder"
                title="Attach folder"
                className={attachButtonClass}
              >
                <Folder className="size-4" />
              </button>
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.length)
                    (onAttachFolder ?? onAttach)?.(event.target.files);
                  event.target.value = "";
                }}
                {...({ webkitdirectory: "" } as Record<string, string>)}
              />
            </>
          )}

          {/* Attach and send are pinned; everything between them shares ONE
              shrinkable, horizontally scrollable strip.

              The pickers used to sit in a `shrink-0` box, so on a narrow
              viewport they kept their full intrinsic width and pushed the send
              button past the composer's edge — where the card's `overflow-hidden`
              clipped it out of reach (measured at 390px: the strip was 347px
              wide and send landed at right:470 against a 390px viewport, with
              `scrollWidth === clientWidth`, so it could not even be scrolled to).
              Send is the one control a composer cannot afford to lose, so the
              pickers give up width first and stay reachable by swipe.

              `ml-auto` on the trailing group reproduces the previous
              right-alignment, so a desktop composer with room to spare lays out
              exactly as before. */}
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {controls}
            {trailing && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {trailing}
              </div>
            )}
          </div>

          {busy && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Stop response"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                "bg-[var(--status-error,#ff4d6d)]/15 text-[var(--status-error,#ff4d6d)] transition-colors",
                "hover:bg-[var(--status-error,#ff4d6d)]/25",
              )}
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label={sendLabel}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
                "transition-opacity hover:opacity-90 disabled:opacity-40",
              )}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {focusShortcut && (
        <div className="mt-1.5 flex justify-end px-1">
          <span className="text-muted-foreground text-xs">
            <kbd className="rounded border border-[var(--md3-outline-variant)] bg-surface-container px-1 py-0.5 text-[10px]">
              Cmd
            </kbd>
            <kbd className="ml-0.5 rounded border border-[var(--md3-outline-variant)] bg-surface-container px-1 py-0.5 text-[10px]">
              L
            </kbd>
            <span className="ml-1">to focus</span>
          </span>
        </div>
      )}
    </div>
  );
}
