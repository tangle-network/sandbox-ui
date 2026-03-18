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
  placeholder = "Ask about your taxes, build a model, or give instructions...",
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
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingFiles.map((f) => (
            <span
              key={f.id}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-full)] text-xs",
                "bg-[var(--bg-input)] border border-[var(--border-subtle)]",
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
                  onClick={() => onRemoveFile(f.id)}
                  className="hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[var(--radius-lg)] px-3 py-2 focus-within:border-[var(--border-accent)] transition-colors">
        {/* Attach button */}
        {onAttach && (
          <>
            <button
              onClick={handleAttachClick}
              disabled={isStreaming}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50 shrink-0 mb-0.5"
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
          className="flex-1 bg-transparent text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] resize-none outline-none min-h-[24px] max-h-[160px] leading-relaxed disabled:opacity-50"
        />

        {/* Send / Cancel */}
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--code-error)]/15 hover:bg-[var(--code-error)]/25 text-[var(--code-error)] transition-colors shrink-0 mb-0.5"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--brand-cool)]/15 hover:bg-[var(--brand-cool)]/25 text-[var(--brand-cool)] transition-colors disabled:opacity-30 shrink-0 mb-0.5"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Footer: model selector + shortcuts */}
      <div className="flex items-center justify-between mt-1.5 px-1">
        <div className="flex items-center gap-2">
          {modelLabel && (
            <button
              onClick={onModelClick}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:border-[var(--border-accent)] hover:text-[var(--text-secondary)] transition-colors"
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
