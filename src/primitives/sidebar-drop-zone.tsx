/**
 * SidebarDropZone — compact scoped drop zone for sidebar panels and narrow containers.
 *
 * Unlike the full-window DropZone, this renders as an inline element
 * that can be placed inside sidebar panels, file trees, or any container.
 * Shows a subtle drop target when files are dragged over it.
 *
 * Usage:
 *   <SidebarPanelContent>
 *     <FileTree ... />
 *     <SidebarDropZone onDrop={uploadToWorkspace} title="Upload to workspace" />
 *   </SidebarPanelContent>
 */

import { useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { cn } from "../lib/utils";

export interface SidebarDropZoneProps {
  /** Called with dropped files */
  onDrop: (files: File[]) => void;
  /** Accepted file types (e.g. ".pdf,.csv") */
  accept?: string;
  /** Whether drop zone is active */
  disabled?: boolean;
  /** Title shown in the drop zone */
  title?: string;
  /** Description shown below the title */
  description?: string;
  /** Custom icon (replaces default upload icon) */
  icon?: ReactNode;
  /** Always visible (not just on drag). Useful as a persistent upload area. */
  persistent?: boolean;
  className?: string;
}

export function SidebarDropZone({
  onDrop,
  accept,
  disabled,
  title = "Drop files here",
  description,
  icon,
  persistent = false,
  className,
}: SidebarDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const counter = useRef(0);

  const isAccepted = useCallback(
    (file: File) => {
      if (!accept) return true;
      const extensions = accept.split(",").map((ext) => ext.trim().toLowerCase());
      const fileName = file.name.toLowerCase();
      return extensions.some((ext) => fileName.endsWith(ext));
    },
    [accept],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      counter.current++;
      if (e.dataTransfer?.types.includes("Files")) setDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counter.current--;
    if (counter.current === 0) setDragOver(false);
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) e.dataTransfer.dropEffect = "copy";
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      counter.current = 0;
      setDragOver(false);
      if (disabled) return;

      const allFiles = Array.from(e.dataTransfer?.files || []);
      const accepted = accept ? allFiles.filter(isAccepted) : allFiles;
      if (accepted.length > 0) onDrop(accepted);
    },
    [disabled, accept, isAccepted, onDrop],
  );

  const isVisible = persistent || dragOver;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border-2 border-dashed transition-all duration-150",
        isVisible ? "p-4" : "p-0 border-transparent",
        dragOver
          ? "border-[var(--brand-cool,hsl(var(--ring)))] bg-[var(--accent-surface-soft)]"
          : persistent
            ? "border-[var(--border-subtle,hsl(var(--border)))] bg-transparent hover:border-[var(--border-default,hsl(var(--border)))] hover:bg-[var(--bg-hover,hsl(var(--accent)))]"
            : "",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {isVisible && (
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            dragOver
              ? "bg-[var(--brand-cool,hsl(var(--primary)))]/15 text-[var(--brand-cool,hsl(var(--primary)))]"
              : "text-[var(--text-muted,hsl(var(--muted-foreground)))]",
          )}>
            {icon ?? <Upload className="h-4 w-4" />}
          </div>
          <p className={cn(
            "text-xs font-medium",
            dragOver
              ? "text-[var(--text-primary,hsl(var(--foreground)))]"
              : "text-[var(--text-muted,hsl(var(--muted-foreground)))]",
          )}>
            {title}
          </p>
          {description && (
            <p className="text-[10px] text-[var(--text-muted,hsl(var(--muted-foreground)))]">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
