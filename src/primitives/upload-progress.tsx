/**
 * UploadProgress — file upload status indicators.
 *
 * Shows a list of files being uploaded with progress bars,
 * completion checkmarks, and error states.
 */

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
              ? "border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5"
              : file.status === "complete"
                ? "border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5"
                : "border-[hsl(var(--border))] bg-[hsl(var(--card))]",
          )}
        >
          {/* Icon */}
          <span
            className={cn(
              "material-symbols-outlined text-base shrink-0",
              file.status === "complete" && "text-[hsl(var(--success))]",
              file.status === "error" && "text-[hsl(var(--destructive))]",
              file.status === "uploading" && "text-[hsl(var(--primary))] animate-pulse",
              file.status === "pending" && "text-[hsl(var(--muted-foreground))]",
            )}
            style={file.status === "complete" ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            {file.status === "complete"
              ? "check_circle"
              : file.status === "error"
                ? "error"
                : file.status === "uploading"
                  ? "progress_activity"
                  : "description"}
          </span>

          {/* Name + size */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-[hsl(var(--foreground))]">{file.name}</span>
              <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{formatSize(file.size)}</span>
            </div>
            {/* Progress bar */}
            {file.status === "uploading" && file.progress !== undefined && (
              <div className="mt-1 h-1 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[hsl(var(--primary))] transition-all"
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            )}
            {/* Error message */}
            {file.status === "error" && file.error && (
              <p className="mt-0.5 text-xs text-[hsl(var(--destructive))]">{file.error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {file.status === "error" && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(file.id)}
                className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(file.id)}
                className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
