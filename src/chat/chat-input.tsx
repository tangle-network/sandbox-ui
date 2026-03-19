/**
 * ChatInput — message input bar with file attach, send/cancel, model selector.
 *
 * - Auto-resizing textarea (up to max height)
 * - Enter to send, Shift+Enter for newline
 * - File attachment button with pending file chips
 * - Cancel button when streaming
 * - Optional model selector pill
 */

import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from "react";
import { Send, Square, Paperclip, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface PendingFile {
  id: string;
  name: string;
  size: number;
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
  onAttach?: (files: FileList) => void;
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
  className,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
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
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onAttach?.(e.target.files);
      e.target.value = ""; // Reset so same file can be re-selected
    }
  };

  return (
    <div className={cn("px-4 py-3", className)}>
      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pendingFiles.map((f) => (
            <span
              key={f.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border px-3 py-1.5 text-xs shadow-[var(--shadow-card)]",
                "border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]",
                f.status === "error" && "border-[var(--code-error)]/30 text-[var(--code-error)]",
                f.status !== "error" && "text-[var(--text-secondary)]",
              )}
            >
              <span className="truncate max-w-[150px]">{f.name}</span>
              {f.status === "uploading" && (
                <span className="w-3 h-3 border-2 border-[var(--brand-cool)] border-t-transparent rounded-full animate-spin" />
              )}
              {onRemoveFile && (
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onRemoveFile(f.id)}
                  className="rounded p-0.5 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="rounded-[calc(var(--radius-xl)+2px)] border border-[var(--border-subtle)] bg-[linear-gradient(135deg,rgba(98,114,243,0.08),rgba(255,255,255,0.02)_40%,transparent)] p-[1px] shadow-[var(--shadow-card)]">
        <div className="flex items-end gap-2 rounded-[var(--radius-xl)] border border-white/4 bg-[var(--bg-card)] px-3 py-3 transition-colors focus-within:border-[var(--border-accent)]">
        {/* Attach button */}
        {onAttach && (
          <>
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={isStreaming}
              aria-label="Attach files"
              className="mb-0.5 shrink-0 rounded-[var(--radius-md)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.txt,.json,.yaml,.yml"
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
          className="min-h-[28px] max-h-[160px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50 focus-visible:outline-none"
        />

        {/* Send / Cancel */}
        {isStreaming ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Stop response"
            className="mb-0.5 shrink-0 rounded-[var(--radius-md)] bg-[var(--code-error)]/15 p-2 text-[var(--code-error)] transition-colors hover:bg-[var(--code-error)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--code-error)]/50"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className="mb-0.5 shrink-0 rounded-[var(--radius-md)] bg-[var(--brand-cool)]/15 p-2 text-[var(--brand-cool)] transition-colors hover:bg-[var(--brand-cool)]/25 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
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
              className="inline-flex items-center gap-1 rounded-[var(--radius-full)] border border-[var(--border-subtle)] bg-[var(--bg-section)]/55 px-2.5 py-1 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-accent)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-cool)]/60"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--code-success)]" />
              {modelLabel}
            </button>
          )}
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          <kbd className="px-1 py-0.5 bg-[var(--bg-input)] rounded border border-[var(--border-subtle)] text-[10px]">Cmd</kbd>
          <kbd className="px-1 py-0.5 bg-[var(--bg-input)] rounded border border-[var(--border-subtle)] text-[10px] ml-0.5">L</kbd>
          <span className="ml-1">to focus</span>
        </span>
      </div>
    </div>
  );
}
