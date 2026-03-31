import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { usePtySession } from "../hooks/use-pty-session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalViewProps {
  /** Base URL of the sidecar. */
  apiUrl: string;
  /** Bearer token for authentication. */
  token: string;
  /** xterm color theme override. */
  theme?: Partial<TerminalTheme>;
  /** Title shown in the welcome box. Default: "Terminal". */
  title?: string;
  /** Subtitle shown in the welcome box. Default: "Connected to PTY session". */
  subtitle?: string;
  /** @deprecated No longer used — the PTY provides its own prompt. */
  prompt?: string;
}

// ---------------------------------------------------------------------------
// Default theme
// ---------------------------------------------------------------------------

export const DEFAULT_TERMINAL_THEME: TerminalTheme = {
  background: "#0c0c0e",
  foreground: "#d4d4d8",
  cursor: "#34d399",
  cursorAccent: "#0c0c0e",
  selectionBackground: "#7c3aed33",
  selectionForeground: "#d4d4d8",
  black: "#18181b",
  red: "#ef4444",
  green: "#34d399",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#a78bfa",
  cyan: "#22d3ee",
  white: "#d4d4d8",
  brightBlack: "#52525b",
  brightRed: "#f87171",
  brightGreen: "#6ee7b7",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#c4b5fd",
  brightCyan: "#67e8f9",
  brightWhite: "#fafafa",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TerminalView({
  apiUrl,
  token,
  theme,
  title = "Terminal",
  subtitle = "Connected to PTY session",
}: TerminalViewProps) {
  const resolvedTheme = { ...DEFAULT_TERMINAL_THEME, ...theme };

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const onData = useCallback((data: string) => {
    termRef.current?.write(data);
  }, []);

  const { isConnected, error, sendCommand, reconnect } = usePtySession({
    apiUrl,
    token,
    onData,
  });

  // Initialize xterm
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: resolvedTheme,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Welcome message
    const padTitle = title.padEnd(37);
    const padSubtitle = subtitle.padEnd(37);
    term.writeln(`\x1b[38;5;48m\u256d${"\u2500".repeat(41)}\u256e\x1b[0m`);
    term.writeln(`\x1b[38;5;48m\u2502\x1b[0m  \x1b[1m${padTitle}\x1b[0m\x1b[38;5;48m\u2502\x1b[0m`);
    term.writeln(`\x1b[38;5;48m\u2502\x1b[0m  ${padSubtitle}\x1b[38;5;48m\u2502\x1b[0m`);
    term.writeln(`\x1b[38;5;48m\u2570${"\u2500".repeat(41)}\u256f\x1b[0m`);

    // Forward all keyboard input to the PTY — no local echo.
    // The PTY echoes input back via SSE, so xterm only writes what
    // arrives from onData. This avoids double-displayed characters.
    term.onData((data) => {
      sendCommand(data).catch((err) => {
        termRef.current?.writeln(
          `\r\n\x1b[31m${err instanceof Error ? err.message : 'Send failed'}\x1b[0m`,
        );
      });
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sendCommand, resolvedTheme, title, subtitle]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg overflow-hidden"
        style={{ backgroundColor: resolvedTheme.background }}
      />

      {/* Connection status overlay */}
      {(!isConnected || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--depth-1)] rounded-lg">
          <div className="text-center">
            {error ? (
              <>
                <p className="text-sm text-[var(--surface-danger-text)] mb-3">{error}</p>
                <button
                  onClick={reconnect}
                  className="text-sm text-[var(--surface-success-text)] hover:opacity-80 underline cursor-pointer"
                >
                  Retry connection
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Connecting to terminal...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
