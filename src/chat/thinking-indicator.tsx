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
    <div className={cn("flex items-center gap-2 px-3 py-1.5", className)}>
      <div className="flex gap-[3px]">
        <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--brand-glow)]" style={{ animationDelay: "0ms" }} />
        <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--brand-glow)]" style={{ animationDelay: "150ms" }} />
        <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--brand-glow)]" style={{ animationDelay: "300ms" }} />
      </div>
      {elapsed > 3 && (
        <span className="text-[11px] tabular-nums text-[var(--text-dim)]">
          {elapsed}s
        </span>
      )}
    </div>
  );
}
