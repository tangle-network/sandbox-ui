import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

export interface ThinkingIndicatorProps {
  className?: string;
}

export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className={cn("flex gap-3 px-4 py-3", className)}>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-glow)]/15 text-[var(--brand-glow)]">
        <div className="flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--text-muted)]">
          {elapsed < 10 ? "Thinking..." : elapsed < 60 ? "Thinking deeply..." : "Still working..."}
        </span>
        {elapsed > 5 && (
          <span className="text-xs tabular-nums text-[var(--text-muted)]">
            {elapsed}s
          </span>
        )}
      </div>
    </div>
  );
}
