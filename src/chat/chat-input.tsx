/**
 * ChatInput — message input bar with file attach, drag-and-drop, send/cancel.
 *
 * - Auto-resizing textarea (up to max height)
 * - Enter to send, Shift+Enter for newline
 * - Drag-and-drop files onto the input with styled overlay
 * - File attachment button (files) + folder attachment button
 * - Pending file/folder chips
 * - Cancel button when streaming
 * - Optional model selector pill
 */

import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent, type DragEvent } from "react";
import { Send, Square, Paperclip, FolderUp, X, Upload } from "lucide-react";
import { cn } from "../lib/utils";

export interface PendingFile {
  id: string;
  name: string;
  size: number;
  type: "file" | "folder";
  /** Number of files inside (for folders) */
  fileCount?: number;
  status: "pending" | "uploading" | "ready" | "error";
}

export interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void;
  onCancel?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Currently selected model label */
  modelLabel?: string;
  onModelClick?: () => void;
  /** Pending uploaded files */
  pendingFiles?: PendingFile[];
  onRemoveFile?: (id: string) => void;
  /** Called when files are attached (via button or drag-and-drop) */
  onAttach?: (files: FileList) => void;
  /** Called when a folder is selected via the folder button */
  onAttachFolder?: (files: FileList) => void;
  /** Accepted file types for the file input (e.g. ".pdf,.csv") */
  accept?: string;
  /** Drop zone overlay title */
  dropTitle?: string;
  /** Drop zone overlay description */
  dropDescription?: string;
  className?: string;
}

export function ChatInput({
  onSend,
  onCancel,
  isStreaming,
  disabled,
  placeholder = "Ask the agent to inspect files, run commands, or explain results…",
  modelLabel,
  onModelClick,
  pendingFiles = [],
  onRemoveFile,
  onAttach,
  onAttachFolder,
  accept,
  dropTitle = "Drop files to add context",
  dropDescription = "Files will be attached to your next message.",
  className,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderClick = () => {
    folderInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onAttach?.(e.target.files);
      e.target.value = "";
    }
  };

  const handleFolderChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      (onAttachFolder ?? onAttach)?.(e.target.files);
      e.target.value = "";
    }
  };

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.types.includes("Files")) {
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragOver(false);

    const files = e.dataTransfer?.files;
    if (files?.length && onAttach) {
      onAttach(files);
    }
  }, [onAttach]);

  const fileChips = pendingFiles.filter((f) => f.type === "file" || !f.type);
  const folderChips = pendingFiles.filter((f) => f.type === "folder");

  return (
    <div
      className={cn("px-4 py-3 relative", className)}
      onDragEnter={onAttach ? handleDragEnter : undefined}
      onDragLeave={onAttach ? handleDragLeave : undefined}
      onDragOver={onAttach ? handleDragOver : undefined}
      onDrop={onAttach ? handleDrop : undefined}
    >
      {/* Drop zone overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed border-border bg-card pointer-events-none">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-surface-soft)]">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">{dropTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dropDescription}</p>
          </div>
        </div>
      )}

      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {folderChips.map((f) => (
            <span
              key={f.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border px-3 py-1.5 text-xs",
                "border-border bg-muted/50",
                f.status === "error" && "border-[var(--code-error)]/30 text-[var(--code-error)]",
                f.status !== "error" && "text-foreground",
              )}
            >
              <FolderUp className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[150px]">{f.name}</span>
              {f.fileCount !== undefined && (
                <span className="text-muted-foreground">({f.fileCount})</span>
              )}
              {f.status === "uploading" && (
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              {onRemoveFile && (
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onRemoveFile(f.id)}
                  className="rounded p-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {fileChips.map((f) => (
            <span
              key={f.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border px-3 py-1.5 text-xs",
                "border-border bg-muted/50",
                f.status === "error" && "border-[var(--code-error)]/30 text-[var(--code-error)]",
                f.status !== "error" && "text-foreground",
              )}
            >
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[150px]">{f.name}</span>
              {f.status === "uploading" && (
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              {onRemoveFile && (
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onRemoveFile(f.id)}
                  className="rounded p-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--depth-2)] shadow-[var(--shadow-card)]">
        <div className="rounded-[var(--radius-xl)] px-3 py-[var(--chat-input-py)] transition-colors focus-within:border-[var(--border-accent)]">
          <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Agent Command Deck
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isStreaming ? "Streaming response" : "Ready for next instruction"}
            </div>
          </div>
          <div className="flex items-end gap-2">
        {/* Attach buttons */}
        {onAttach && (
          <>
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={isStreaming}
              aria-label="Attach files"
              title="Attach files"
              className="mb-0.5 shrink-0 rounded-[var(--radius-md)] border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept={accept ?? ".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.txt,.json,.yaml,.yml"}
            />
          </>
        )}
        {(onAttachFolder ?? onAttach) && (
          <>
            <button
              type="button"
              onClick={handleFolderClick}
              disabled={isStreaming}
              aria-label="Attach folder"
              title="Attach folder"
              className="mb-0.5 shrink-0 rounded-[var(--radius-md)] border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <FolderUp className="h-4 w-4" />
            </button>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFolderChange}
              // @ts-ignore webkitdirectory is non-standard but widely supported
              webkitdirectory=""
            />
          </>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isStreaming || disabled}
          rows={1}
          aria-label="Message input"
          className="min-h-[32px] max-h-[120px] flex-1 resize-none bg-transparent text-[14px] leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50 focus-visible:outline-none"
        />

        {/* Send / Cancel */}
        {isStreaming ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Stop response"
            className="mb-0.5 shrink-0 rounded-[var(--radius-lg)] border border-[var(--code-error)]/20 bg-[var(--code-error)]/14 p-2.5 text-[var(--code-error)] transition-colors hover:bg-[var(--code-error)]/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--code-error)]/50"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className="mb-0.5 shrink-0 rounded-[var(--radius-lg)] border border-border bg-[var(--accent-surface-soft)] p-2.5 text-[var(--accent-text)] transition-colors hover:translate-y-[-1px] hover:bg-[var(--accent-surface-strong)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-accent)]"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
          </div>
        </div>
      </div>

      {/* Footer: model selector + shortcuts */}
      <div className="mt-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {modelLabel && (
            <button
              type="button"
              onClick={onModelClick}
              aria-label={`Select model, current model ${modelLabel}`}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--code-success)]" />
              {modelLabel}
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-[var(--bg-input)] rounded border border-border text-[10px]">Cmd</kbd>
          <kbd className="px-1 py-0.5 bg-[var(--bg-input)] rounded border border-border text-[10px] ml-0.5">L</kbd>
          <span className="ml-1">to focus</span>
        </span>
      </div>
    </div>
  );
}
