/**
 * Terminal — read-only terminal output panel.
 *
 * Shows agent's bash command output with basic ANSI color support.
 * Collapsible, auto-scrolls to bottom.
 */

import { useRef, useEffect, useId } from "react";
import { Terminal as TerminalIcon, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface TerminalLine {
  id: string;
  text: string;
  type: "command" | "stdout" | "stderr" | "system";
  timestamp?: number;
}

export interface TerminalProps {
  lines: TerminalLine[];
  title?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  maxHeight?: number;
  className?: string;
}

const LINE_COLORS: Record<string, string> = {
  command: "text-[var(--code-function)]",
  stdout: "text-foreground",
  stderr: "text-[var(--code-error)]",
  system: "text-muted-foreground",
};

const LINE_PREFIXES: Record<string, string> = {
  command: "$ ",
  stdout: "",
  stderr: "",
  system: "# ",
};

export function TerminalPanel({
  lines,
  title = "Terminal",
  isCollapsed = false,
  onToggle,
  onClose,
  maxHeight = 200,
  className,
}: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentId = useId();

  useEffect(() => {
    if (!isCollapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, isCollapsed]);

  return (
    <div className={cn("border-t border-[var(--md3-outline-variant)] bg-surface-container", className)}>
      {/* Header */}
      <div className="flex items-center px-1">
        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        >
          <TerminalIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium">{title}</span>
          {lines.length > 0 && (
            <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] tabular-nums">
              {lines.length}
            </span>
          )}
          <span className="flex-1" />
          {isCollapsed ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
        </button>
        {onClose && (
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Content */}
        <div
          id={contentId}
          hidden={isCollapsed}
          ref={scrollRef}
          className="overflow-auto px-3 pb-2 font-mono text-xs leading-[1.6] bg-surface-container-lowest"
          style={{ maxHeight }}
        >
          {lines.map((line) => (
            <div key={line.id} className={cn("whitespace-pre-wrap", LINE_COLORS[line.type])}>
              <span className="text-muted-foreground select-none">{LINE_PREFIXES[line.type]}</span>
              {line.text}
            </div>
          ))}
          {lines.length === 0 && (
            <div className="text-muted-foreground py-2">No output yet</div>
          )}
        </div>
    </div>
  );
}
