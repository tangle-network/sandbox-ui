import { Binary, ShieldCheck, TerminalSquare } from "lucide-react";
import { cn } from "../lib/utils";
import {
  StatusBanner,
  type StatusBannerProps,
} from "./status-banner";
import {
  StatusBar,
  type StatusBarProps,
} from "./status-bar";
import {
  TerminalPanel,
  type TerminalProps,
} from "./terminal-panel";

export interface RuntimePaneProps {
  title?: string;
  subtitle?: string;
  statusBanner?: StatusBannerProps;
  statusBar?: StatusBarProps;
  /** When provided, replaces the entire 2-column grid with custom content (e.g. a full-pane TerminalView). */
  content?: React.ReactNode;
  terminal?: TerminalProps;
  audit?: React.ReactNode;
  inspector?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * RuntimePane — shared operating surface for sandbox session state, terminal
 * output, audit results, and runtime metadata.
 */
export function RuntimePane({
  title = "Runtime",
  subtitle = "Session state, execution output, and inspection surfaces",
  statusBanner,
  statusBar,
  content,
  terminal,
  audit,
  inspector,
  footer,
  className,
}: RuntimePaneProps) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-dark)] text-[var(--text-primary)]",
        className,
      )}
    >
      <header className="border-b border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] px-4 py-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Sandbox
        </div>
        <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</div>
      </header>

      {statusBanner && <StatusBanner {...statusBanner} />}
      {statusBar && <StatusBar {...statusBar} />}

      {content ? (
        <div className="min-h-0 flex-1 overflow-hidden">{content}</div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-px bg-[var(--border-subtle)] lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
          <div className="min-h-0 overflow-auto bg-[var(--bg-card)]">
            {terminal ? (
              <TerminalPanel
                {...terminal}
                className={cn("border-t-0 bg-transparent", terminal.className)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="h-4 w-4" />
                  No terminal activity yet
                </div>
              </div>
            )}
          </div>

          <div className="grid min-h-0 gap-px bg-[var(--border-subtle)]">
            <div className="min-h-0 overflow-auto bg-[var(--bg-card)]">
              {audit ? (
                audit
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    No audit data available
                  </div>
                </div>
              )}
            </div>
            <div className="min-h-0 overflow-auto bg-[var(--bg-card)]">
              {inspector ? (
                inspector
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <Binary className="h-4 w-4" />
                    No runtime inspector attached
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {footer && (
        <footer className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
          {footer}
        </footer>
      )}
    </section>
  );
}
