/**
 * WorkspaceLayout — three-panel workspace shell (Conductor-inspired).
 *
 * Left: file tree / navigation
 * Center: main content (chat, activity)
 * Right: preview panel (PDF, code, audit)
 *
 * Panels are collapsible. On mobile, only center is shown.
 */

import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "../lib/utils";

export interface WorkspaceLayoutProps {
  /** Left sidebar content (file tree, navigation) */
  left?: ReactNode;
  /** Left sidebar header */
  leftHeader?: ReactNode;
  /** Center main content */
  center: ReactNode;
  /** Center header (session name, etc.) */
  centerHeader?: ReactNode;
  /** Center footer (input bar) */
  centerFooter?: ReactNode;
  /** Right panel content (preview, editor) */
  right?: ReactNode;
  /** Right panel header */
  rightHeader?: ReactNode;
  /** Bottom panel (terminal) */
  bottom?: ReactNode;
  /** Default left panel state */
  defaultLeftOpen?: boolean;
  /** Default right panel state */
  defaultRightOpen?: boolean;
  /** Default bottom panel state */
  defaultBottomOpen?: boolean;
  className?: string;
}

export function WorkspaceLayout({
  left,
  leftHeader,
  center,
  centerHeader,
  centerFooter,
  right,
  rightHeader,
  bottom,
  defaultLeftOpen = true,
  defaultRightOpen = false,
  defaultBottomOpen = false,
  className,
}: WorkspaceLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(defaultLeftOpen);
  const [rightOpen, setRightOpen] = useState(defaultRightOpen);
  const [bottomOpen, setBottomOpen] = useState(defaultBottomOpen);

  return (
    <div className={cn("flex flex-col h-screen bg-[var(--bg-root)] text-[var(--text-primary)] font-[var(--font-sans)]", className)}>
      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        {left && leftOpen && (
          <aside className="w-64 shrink-0 border-r border-[var(--border-subtle)] flex flex-col bg-[var(--bg-dark)]">
            {leftHeader && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] shrink-0">
                {leftHeader}
                <button
                  onClick={() => setLeftOpen(false)}
                  className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-auto py-1">
              {left}
            </div>
          </aside>
        )}

        {/* Center panel */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Center header */}
          {(centerHeader || left) && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--bg-dark)]">
              {left && !leftOpen && (
                <button
                  onClick={() => setLeftOpen(true)}
                  className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <div className="flex-1 min-w-0">{centerHeader}</div>
              {right && !rightOpen && (
                <button
                  onClick={() => setRightOpen(true)}
                  className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Center content */}
          <div className="flex-1 overflow-auto">
            {center}
          </div>

          {/* Bottom panel (terminal) */}
          {bottom && bottomOpen && (
            <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-card)] max-h-48 overflow-auto">
              {bottom}
            </div>
          )}

          {/* Center footer (input) */}
          {centerFooter && (
            <div className="border-t border-[var(--border-subtle)] shrink-0 bg-[var(--bg-dark)]">
              {centerFooter}
            </div>
          )}
        </main>

        {/* Right panel */}
        {right && rightOpen && (
          <aside className="w-[480px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col bg-[var(--bg-dark)]">
            {rightHeader !== undefined ? (
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] shrink-0">
                {rightHeader}
                <button
                  onClick={() => setRightOpen(false)}
                  className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex justify-end px-3 py-2 border-b border-[var(--border-subtle)] shrink-0">
                <button
                  onClick={() => setRightOpen(false)}
                  className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              {right}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
