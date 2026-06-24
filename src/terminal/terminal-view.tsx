import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useCallback, useMemo } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
// `@xterm/addon-webgl` is a *true* optional peer: xterm falls back to
// its DOM/canvas renderer when the addon is absent. Keep it out of the
// static import graph so a consumer who skips installing the package
// still gets a working terminal — a missing-module error here would
// otherwise crash the whole module at load time, taking the rest of
// TerminalView with it. The dynamic import is awaited inside the
// effect below; the type-only import keeps `WebglAddon` typed without
// pulling the runtime module.
import type { WebglAddon as WebglAddonType } from "@xterm/addon-webgl";
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
  /**
   * Monospace font size in CSS pixels. Default 13. Changing it updates
   * the live terminal and refits so xterm recomputes cols/rows from the
   * new measured cell size instead of re-creating the terminal (which
   * would drop scrollback).
   */
  fontSize?: number;
  /** Whether the terminal tab is currently active and visible. */
  isActive?: boolean;
  /**
   * Stable id reused across remounts so the sidecar restores the same
   * PTY session instead of spawning a fresh shell. Omit for a new
   * session per mount.
   */
  connectionId?: string;
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
  connectionId,
  fontSize = 13,
}: TerminalViewProps) {
  const resolvedTheme = useMemo(
    () => ({ ...DEFAULT_TERMINAL_THEME, ...theme }),
    [theme],
  );

  // Reject non-positive / non-finite sizes (0, negative, NaN, Infinity)
  // before they reach xterm — those produce broken cell measurements and
  // an unusable terminal, and fall back to the default. Any positive
  // finite size is passed through; callers clamp their own upper bound.
  const resolvedFontSize =
    Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 13;

  // Read at terminal-creation time only. Kept in a ref so a fontSize
  // change does not land in the creation effect's dependency array and
  // re-create the terminal — live updates are applied by the dedicated
  // effect below, mirroring how the theme is updated in place.
  const fontSizeRef = useRef(resolvedFontSize);
  fontSizeRef.current = resolvedFontSize;

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
    connectionId,
  });

  // Initialize xterm
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: resolvedTheme,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      fontSize: fontSizeRef.current,
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
    // DOM renderer if the addon throws (no WebGL context, headless
    // test environment, etc.) OR the package is not installed at all
    // (true optional peer). Context loss disposes the addon and lets
    // xterm fall back live, rather than leaving the terminal frozen.
    //
    // The dynamic import keeps `@xterm/addon-webgl` out of the static
    // import graph so a consumer who skips installing the package
    // does not crash the whole module at load time. `webglCancelled`
    // is a flag the cleanup below flips so a late-resolving import
    // doesn't attach a renderer to a disposed terminal.
    let webglAddon: WebglAddonType | null = null;
    let webglCancelled = false;
    void (async () => {
      try {
        const mod = await import("@xterm/addon-webgl");
        if (webglCancelled) return;
        try {
          const addon = new mod.WebglAddon();
          addon.onContextLoss(() => {
            webglAddon?.dispose();
            webglAddon = null;
          });
          // Track before loadAddon so a thrown attach (rare but
          // theoretically possible if xterm rejects the addon) still
          // gets cleaned up by the dispose path on unmount.
          webglAddon = addon;
          term.loadAddon(addon);
        } catch {
          // No WebGL context (headless / blocked GPU). xterm's
          // default renderer takes over silently.
        }
      } catch {
        // Package not installed — not an error, fall through to the
        // default renderer.
      }
    })();

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
      // Block a late-resolving WebGL import from attaching a renderer
      // to the about-to-be-disposed terminal. If the import already
      // resolved, `webglAddon` holds the addon and the dispose call
      // below tears it down.
      webglCancelled = true;
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

  // Update font size in place and refit. xterm derives cell metrics
  // (and therefore cols/rows) from the font size, so the fit must run
  // after the option changes to keep wrapping and box-drawing aligned.
  // The deferred fit is canceled on unmount (and before a newer change
  // supersedes it), matching the write-coalescing rAF above, so a
  // pending fit never fires against a disposed addon.
  useEffect(() => {
    const term = termRef.current;
    if (!term || term.options.fontSize === resolvedFontSize) return;
    term.options.fontSize = resolvedFontSize;
    const rafId = requestAnimationFrame(() => fitAddonRef.current?.fit());
    return () => cancelAnimationFrame(rafId);
  }, [resolvedFontSize]);

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
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest">
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
