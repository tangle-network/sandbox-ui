/**
 * Terminal — read-only terminal output panel.
 *
 * Shows agent's bash command output with basic ANSI color support.
 * Collapsible, auto-scrolls to bottom.
 */

import { useRef, useEffect } from "react";
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

  useEffect(() => {
    if (!isCollapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, isCollapsed]);

  return (
    <div className={cn("border-t border-border bg-card", className)}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <TerminalIcon className="h-3.5 w-3.5" />
        <span className="font-medium">{title}</span>
        {lines.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--bg-input)] text-[10px] tabular-nums">
            {lines.length}
          </span>
        )}
        <div className="flex-1" />
        {onClose && (
          <X className="h-3 w-3 hover:text-foreground" onClick={(e) => { e.stopPropagation(); onClose(); }} />
        )}
        {isCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div
          ref={scrollRef}
          className="overflow-auto px-3 pb-2 font-mono text-xs leading-[1.6]"
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
      )}
    </div>
  );
}
