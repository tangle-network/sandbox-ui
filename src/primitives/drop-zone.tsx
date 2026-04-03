/**
 * DropZone — full-window drag-and-drop file upload overlay.
 *
 * Detects when files are dragged over the browser window and shows a
 * customizable overlay. Products provide the onDrop handler and optional
 * custom overlay content.
 *
 * Usage:
 *   <DropZone onDrop={files => uploadToR2(files)} accept=".pdf,.csv">
 *     <YourApp />
 *   </DropZone>
 */

import { useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "../lib/utils";

export interface DropZoneProps {
  /** Called with dropped files */
  onDrop: (files: File[]) => void;
  /** Accepted file types (e.g. ".pdf,.csv,.xlsx") */
  accept?: string;
  /** Whether drop zone is active */
  disabled?: boolean;
  /** Custom overlay content (replaces default) */
  overlay?: ReactNode;
  /** Overlay title */
  title?: string;
  /** Overlay description */
  description?: string;
  /** Overlay icon (Material Symbols name or ReactNode) */
  icon?: string | ReactNode;
  /** Children wrapped by the drop zone */
  children: ReactNode;
  className?: string;
}

export function DropZone({
  onDrop,
  accept,
  disabled,
  overlay,
  title = "Drop files to upload",
  description = "Your files will be securely stored in the workspace.",
  icon = "cloud_upload",
  children,
  className,
}: DropZoneProps) {
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
      if (disabled) return;
      counter.current++;
      if (e.dataTransfer?.types.includes("Files")) setDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    counter.current--;
    if (counter.current === 0) setDragOver(false);
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!disabled) e.dataTransfer.dropEffect = "copy";
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      counter.current = 0;
      setDragOver(false);
      if (disabled) return;

      const allFiles = Array.from(e.dataTransfer?.files || []);
      const accepted = accept ? allFiles.filter(isAccepted) : allFiles;
      if (accepted.length > 0) onDrop(accepted);
    },
    [disabled, accept, isAccepted, onDrop],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn("relative", className)}
    >
      {dragOver &&
        (overlay || (
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-background">
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-16 text-center shadow-[var(--shadow-dropdown)] max-w-lg mx-auto">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-[var(--accent-surface-soft)]">
                {typeof icon === "string" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-[var(--accent-text)]">
                    <title>Upload</title>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                ) : (
                  icon
                )}
              </div>
              <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      {children}
    </div>
  );
}
