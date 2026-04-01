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
  /** Whether the terminal tab is currently active and visible. */
  isActive?: boolean;
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
  isActive = true,
}: TerminalViewProps) {
  const resolvedTheme = { ...DEFAULT_TERMINAL_THEME, ...theme };

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const onData = useCallback((data: string) => {
    termRef.current?.write(data);
  }, []);

  const { isConnected, error, sendCommand, resizeTerminal, reconnect } = usePtySession({
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

    // We now use a React-rendered glassmorphic overlay for the welcome message instead of term.writeln

    // Forward all keyboard input to the PTY — no local echo.
    // The PTY echoes input back via SSE, so xterm only writes what
    // arrives from onData. This avoids double-displayed characters.
    term.onData((data) => {
      // Manually handle CTRL+L (form feed) to clear the screen
      // since the fallback shell might not correctly implement clear line via readline.
      if (data === '\x0c') {
        termRef.current?.clear();
        // Send a carriage return to force the prompt to redraw at the top
        sendCommand('\r').catch(console.error);
        return;
      }

      sendCommand(data).catch((err) => {
        termRef.current?.writeln(
          `\r\n\x1b[31m${err instanceof Error ? err.message : 'Send failed'}\x1b[0m`,
        );
      });
    });

    term.onResize(({ cols, rows }) => {
      resizeTerminal(cols, rows).catch(console.error);
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
  }, [sendCommand, resizeTerminal, resolvedTheme, title, subtitle]);

  // Synchronize size with sidecar once connected to trigger SIGWINCH and prompt redraw
  useEffect(() => {
    if (isConnected && termRef.current) {
      resizeTerminal(termRef.current.cols, termRef.current.rows).catch(console.error);
      // Wait a tick for the connection to fully stabilize, then ping a carriage return
      // to force the bash prompt to render if it was waiting
      setTimeout(() => {
        sendCommand("\r").catch(console.error);
        if (isActive) {
          termRef.current?.focus();
        }
      }, 150);
    }
  }, [isConnected, resizeTerminal, sendCommand, isActive]);

  // Handle visibility changes from tab switches
  useEffect(() => {
    if (isActive && termRef.current && fitAddonRef.current) {
      // Small delay allows CSS visibility transition to complete so 
      // dimensions are accurate before fitting
      setTimeout(() => {
        fitAddonRef.current?.fit();
        termRef.current?.focus();
      }, 50);
    }
  }, [isActive]);

  return (
    <div 
      className="relative h-full w-full group cursor-text"
      onClick={() => termRef.current?.focus()}
    >
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden relative z-0"
        style={{ backgroundColor: resolvedTheme.background }}
      />

      {/* Connection status overlay */}
      {(!isConnected || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
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
              <p className="text-[13px] text-muted-foreground">Connecting to terminal...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
