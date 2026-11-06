import { Button } from "@tangle-network/ui/primitives";
import { Terminal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

export interface SystemLogsViewerProps {
  apiUrl: string;
  token: string;
  className?: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  scope: string;
  message: string;
}

interface LogsResponse {
  count: number;
  logs: LogEntry[];
}

export function SystemLogsViewer({ apiUrl, token, className }: SystemLogsViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let backoff = 2000;
    const controller = new AbortController();

    async function fetchLogs() {
      try {
        // `/logs` is the ungated sidecar log reader. The operator `/debug/logs`
        // surface is capability-gated (cap:["debug"]) and deploy-switched, so a
        // customer proxy carrying the master token can never reach it — fetching
        // it always failed. Both endpoints return the same redacted buffer.
        const res = await fetch(`${apiUrl}/logs`, {
          headers: {
             Authorization: `Bearer ${token}`
          },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = (await res.json()) as LogsResponse;

        if (!controller.signal.aborted) {
          setLogs(data.logs || []);
          setError(null);
          backoff = 2000;
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to fetch logs");
          backoff = Math.min(backoff * 2, 30000);
        }
      }

      if (!controller.signal.aborted) {
        timeoutId = setTimeout(fetchLogs, backoff);
      }
    }

    fetchLogs();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [apiUrl, token]);

  useEffect(() => {
    if (isFollowing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isFollowing]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

    // If we're within 20px of the bottom, turn following ON, otherwise OFF
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setIsFollowing((prev) => prev === isAtBottom ? prev : isAtBottom);
  };

  return (
    <div className={cn("flex flex-col h-full bg-surface-dim text-foreground font-mono text-sm leading-relaxed overflow-hidden rounded-lg border border-[var(--md3-outline-variant)]", className)}>
      <div className="flex-none flex items-center justify-between border-b border-[var(--md3-outline-variant)] bg-surface-container-high px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">System traces</span>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-destructive text-xs flex items-center gap-2"><span className="size-2 rounded-full bg-destructive"></span> Error fetching logs</span>}
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={isFollowing}
            onClick={() => {
              setIsFollowing(!isFollowing);
              if (!isFollowing && scrollRef.current) {
                // Instantly align to bottom on re-activation
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
          >
            {isFollowing ? "Auto-scroll on" : "Auto-scroll off"}
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
         {logs.length === 0 && !error ? (
           <div className="flex h-full items-center justify-center text-muted-foreground">
             Waiting for orchestrator logs…
           </div>
         ) : (
           logs.map((log, i) => (
             <div key={`${log.timestamp}-${log.scope}-${i}`} className="break-words">
                <span className="text-muted-foreground mr-3 select-none">[{log.timestamp || i.toString().padStart(4, '0')}]</span>
                <span className="text-[var(--text-secondary)] mr-2">[{log.level}]</span>
                <span className="text-muted-foreground mr-2">[{log.scope}]</span>
                <span className={log.level.toUpperCase() === "ERROR" || log.message.toLowerCase().includes("failed") ? "text-destructive" : log.level.toUpperCase() === "WARN" ? "text-[var(--surface-warning-text)]" : "text-foreground"}>
                  {log.message}
                </span>
             </div>
           ))
         )}
      </div>
    </div>
  );
}
