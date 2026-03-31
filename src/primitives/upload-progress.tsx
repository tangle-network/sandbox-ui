/**
 * UploadProgress — file upload status indicators.
 *
 * Shows a list of files being uploaded with progress bars,
 * completion checkmarks, and error states.
 */

import { AlertCircle, CheckCircle2, FileText, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface UploadFile {
  id: string;
  name: string;
  size: number;
  status: "pending" | "uploading" | "complete" | "error";
  progress?: number; // 0-100
  error?: string;
}

export interface UploadProgressProps {
  files: UploadFile[];
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function UploadProgress({ files, onRemove, onRetry, className }: UploadProgressProps) {
  if (files.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {files.map((file) => (
        <div
          key={file.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
            file.status === "error"
              ? "border-[var(--surface-danger-border)] bg-[var(--surface-danger-bg)]"
              : file.status === "complete"
                ? "border-[var(--surface-success-border)] bg-[var(--surface-success-bg)]"
                : "border-[var(--border-subtle)] bg-[var(--depth-2)]",
          )}
        >
          {/* Icon */}
          {file.status === "complete" && (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--surface-success-text)]" />
          )}
          {file.status === "error" && (
            <AlertCircle className="h-4 w-4 shrink-0 text-[var(--surface-danger-text)]" />
          )}
          {file.status === "uploading" && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--brand-cool)]" />
          )}
          {file.status === "pending" && (
            <FileText className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          )}

          {/* Name + size */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-[var(--text-primary)]">{file.name}</span>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{formatSize(file.size)}</span>
            </div>
            {/* Progress bar */}
            {file.status === "uploading" && file.progress !== undefined && (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--depth-3)]">
                <div
                  className="h-full rounded-full bg-[var(--brand-cool)] transition-all"
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            )}
            {/* Error message */}
            {file.status === "error" && file.error && (
              <p className="mt-0.5 text-xs text-[var(--surface-danger-text)]">{file.error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {file.status === "error" && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(file.id)}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(file.id)}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
