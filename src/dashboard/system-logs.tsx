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
    const controller = new AbortController();

    async function fetchLogs() {
      try {
        const res = await fetch(`${apiUrl}/debug/logs`, {
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
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to fetch logs");
      }

      if (!controller.signal.aborted) {
        timeoutId = setTimeout(fetchLogs, 2000);
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
    setIsFollowing(isAtBottom);
  };

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground font-mono text-sm leading-relaxed overflow-hidden rounded-lg border border-border", className)}>
      <div className="flex-none flex items-center justify-between border-b border-border bg-muted/50 backdrop-blur-md px-4 py-2">
        <div className="flex items-center gap-2">
           <Terminal className="h-4 w-4 text-primary animate-pulse" />
           <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">System Traces</span>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-destructive text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive animate-ping"></span> Error fetching logs</span>}
          <button
            onClick={() => {
              setIsFollowing(!isFollowing);
              if (!isFollowing && scrollRef.current) {
                // Instantly align to bottom on re-activation
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-colors", isFollowing ? "bg-primary/20 text-primary border border-primary/20" : "bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-foreground")}
          >
            {isFollowing ? "Auto-Scroll ON" : "Auto-Scroll OFF"}
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
         {logs.length === 0 && !error ? (
           <div className="flex h-full items-center justify-center text-muted-foreground italic">
             Waiting for orchestrator logs...
           </div>
         ) : (
           logs.map((log, i) => (
             <div key={`${log.timestamp}-${log.scope}-${i}`} className="break-words">
                <span className="text-muted-foreground mr-3 select-none">[{log.timestamp || i.toString().padStart(4, '0')}]</span>
                <span className="text-primary/70 mr-2">[{log.level}]</span>
                <span className="text-muted-foreground mr-2">[{log.scope}]</span>
                <span className={log.level.toUpperCase() === "ERROR" || log.message.toLowerCase().includes("failed") ? "text-destructive" : log.level.toUpperCase() === "WARN" ? "text-warning" : "text-foreground"}>
                  {log.message}
                </span>
             </div>
           ))
         )}
      </div>
    </div>
  );
}
