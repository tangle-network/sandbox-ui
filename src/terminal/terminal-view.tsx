import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useCallback, useMemo } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
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
  const resolvedTheme = useMemo(
    () => ({ ...DEFAULT_TERMINAL_THEME, ...theme }),
    [theme],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Coalesce PTY output into one xterm.write per animation frame.
  // The transport (SSE or WS) delivers many small chunks under burst output
  // (e.g. `ls /usr/bin`, `tail -f`); writing each one immediately drives the
  // xterm parser through its state machine N times. Joining within a frame
  // lets the parser process a single contiguous string and lets xterm's
  // renderer schedule one paint per frame instead of many.
  const pendingWritesRef = useRef<string[]>([]);
  const writeRafRef = useRef<number | null>(null);

  const onData = useCallback((data: string) => {
    if (!data) return;
    pendingWritesRef.current.push(data);
    if (writeRafRef.current !== null) return;
    writeRafRef.current = requestAnimationFrame(() => {
      writeRafRef.current = null;
      const chunks = pendingWritesRef.current;
      if (chunks.length === 0) return;
      pendingWritesRef.current = [];
      termRef.current?.write(chunks.length === 1 ? chunks[0] : chunks.join(""));
    });
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

    // Try to enable GPU-accelerated rendering. xterm falls back to its
    // DOM renderer if the addon throws (no WebGL context, headless test
    // environment, etc.). Context loss disposes the addon and lets xterm
    // fall back live, rather than leaving the terminal frozen.
    let webglAddon: WebglAddon | null = null;
    try {
      webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon?.dispose();
        webglAddon = null;
      });
      term.loadAddon(webglAddon);
    } catch {
      webglAddon = null;
    }

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
      if (writeRafRef.current !== null) {
        cancelAnimationFrame(writeRafRef.current);
        writeRafRef.current = null;
      }
      pendingWritesRef.current = [];
      webglAddon?.dispose();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sendCommand, resizeTerminal, title, subtitle]);

  // Update theme without re-creating the terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = resolvedTheme;
    }
  }, [resolvedTheme]);

  // Synchronize size with sidecar once connected to trigger SIGWINCH
  useEffect(() => {
    if (isConnected && termRef.current) {
      resizeTerminal(termRef.current.cols, termRef.current.rows).catch(console.error);
      if (isActive) {
        termRef.current.focus();
      }
    }
  }, [isConnected, resizeTerminal, isActive]);

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
