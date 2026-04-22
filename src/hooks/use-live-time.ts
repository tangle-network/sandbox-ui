"use client";

import * as React from "react";

/**
 * Returns `Date.now()` and re-renders every `intervalMs` so derived
 * values like "uptime" tick forward without polling upstream data.
 */
export function useLiveTime(intervalMs: number = 1000): number {
  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const delay = Math.max(intervalMs, 100);
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, delay);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}
